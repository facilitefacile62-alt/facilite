import { createElement, useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Carte Leaflet + tuiles OpenStreetMap dans une WebView — le même moteur que
// le site (src/components/CarteBoutiques.jsx, Leaflet 1.9.4, circleMarker
// uniquement : les icônes PNG par défaut de Leaflet sont bloquées par la CSP
// du site, et inutiles ici). Aucun module de carte natif n'est installé ;
// react-native-webview, lui, l'est déjà.
//
// Les marqueurs sont mis à jour par injection (window.majMarqueurs) plutôt
// qu'en rechargeant la page : le suivi de livraison les déplace toutes les
// quelques secondes, un rechargement ferait perdre le zoom et le déplacement
// de l'utilisateur.
//
// Sur le web (aperçu local), la WebView native n'existe pas : une iframe
// srcDoc sert le même document.
export type MarqueurCarte = {
  id: string;
  lat: number;
  lng: number;
  couleur: string;
  /** Rayon en pixels (défaut 9). */
  rayon?: number;
  /** Étiquette permanente à côté du point. */
  libelle?: string;
  /** Anneau pulsé autour du point (position de l'utilisateur, du livreur). */
  halo?: boolean;
  /** Pastille à compteur (ex. nombre d'offres d'une ville) à la place du point. */
  compteur?: number;
  /**
   * Marqueur « boutique » façon site (Locaux) : avatar rond dans un anneau coloré, avec au-dessus la
   * pastille sombre « ● Nom · Quartier ». `moi` = « Vous êtes ici » (anneau bleu, pastille bleue dessous).
   */
  avatar?: {
    /** Image de l'avatar (data URI SVG de l'avatar Bitmoji de la boutique). */
    uri?: string;
    /** Photo de l'article cherché, affichée à la place de l'avatar. */
    photo?: string;
    /** Repli sans avatar : emoji (comme le site). */
    emoji?: string;
    /** Couleur de l'anneau. */
    bordure: string;
    /** Texte gris après le nom (quartier). */
    sous?: string;
    selectionne?: boolean;
    /** Pastille de statut verte (boutique active) ou grise. */
    actif?: boolean;
    moi?: boolean;
    /** Décalage horizontal en pixels (deux marqueurs posés au même endroit, ex. offres et candidatures). */
    dx?: number;
  };
};

/** Bulle d'aperçu posée AU-DESSUS du rond d'une boutique (comme la carte Locaux du site). */
export type PopupBoutique = {
  /** Identifiant du marqueur auquel la bulle est attachée (pour suivre son écartement). */
  cle?: string;
  lat: number;
  lng: number;
  /** Même décalage que le marqueur de la bulle. */
  dx?: number;
  titre: string;
  sous?: string;
  /** null = chargement des articles en cours. */
  articles: { id: string; titre: string; prix: string; photo?: string; icone?: string }[] | null;
};

/** Trajet tracé sur la carte (ex. « M'y rendre ») ; `approximatif` = ligne droite en pointillés. */
export type TrajetCarte = { points: [number, number][]; approximatif?: boolean };

export type CentreCarte = { lat: number; lng: number };

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
const TUILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function documentHtml(centre: CentreCarte, zoom: number, sombre: boolean, interactive: boolean, regrouper: boolean): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET_CSS}" />
<style>
  html, body, #carte { margin: 0; padding: 0; height: 100%; width: 100%; background: ${sombre ? '#1b2330' : '#e8e4da'}; }
  .leaflet-control-attribution { font-size: 9px; opacity: .7; }
  ${sombre ? '.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(.95) contrast(.9); }' : ''}
  .etiquette { background: rgba(0,0,0,.72); color: #fff; border: 0; border-radius: 10px; padding: 2px 7px; font: 700 11px system-ui, sans-serif; box-shadow: none; }
  .etiquette:before { display: none; }
  .bulle-regroupement { background: none; border: 0; }
  .marqueur-avatar { background: none; border: 0; }
  .marqueur-avatar.leaflet-interactive { pointer-events: none; }
  .marqueur-avatar .rond-cliquable { pointer-events: auto; }
  .popup-boutique .leaflet-popup-content-wrapper { background: #fff; border-radius: 22px; padding: 0; box-shadow: 0 14px 34px rgba(0,0,0,.5); }
  .popup-boutique .leaflet-popup-content { margin: 0; width: auto !important; }
  .popup-boutique .leaflet-popup-tip { background: #fff; }
  .pb-tete { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 12px 12px 6px 16px; }
  .pb-nom { font: 900 15px system-ui, sans-serif; color: #111; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
  .pb-lieu { font: 700 12px system-ui, sans-serif; color: #2563EB; margin-top: 2px; }
  .pb-x { width: 30px; height: 30px; border-radius: 9999px; background: #EFEDE7; color: #111; display: flex; align-items: center; justify-content: center; font: 700 15px system-ui, sans-serif; cursor: pointer; flex: none; }
  .pb-liste { touch-action: pan-x; display: flex; gap: 10px; overflow-x: auto; padding: 4px 14px 14px; max-width: 280px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .pb-liste::-webkit-scrollbar { display: none; }
  .pb-art { flex: none; width: 118px; cursor: pointer; }
  .pb-photo { position: relative; width: 118px; height: 118px; border-radius: 14px; overflow: hidden; background: #E4DED2; }
  .pb-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pb-prix { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; position: absolute; left: 6px; bottom: 6px; background: rgba(17,24,39,.88); color: #fff; border-radius: 9999px; padding: 2px 8px; font: 800 11px system-ui, sans-serif; }
  .pb-titre { margin-top: 6px; font: 800 12px system-ui, sans-serif; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pb-vide { padding: 8px 16px 16px; font: 600 12px system-ui, sans-serif; color: rgba(0,0,0,.5); }
  @keyframes pulse { 0% { r: 9; opacity: .5 } 100% { r: 26; opacity: 0 } }
</style>
</head><body>
<div id="carte"></div>
<script src="${LEAFLET_JS}"></script>
<script>
  var carte = L.map('carte', { zoomControl: false, attributionControl: true, dragging: ${interactive}, touchZoom: ${interactive}, scrollWheelZoom: ${interactive}, doubleClickZoom: ${interactive}, boxZoom: false, keyboard: false })
    .setView([${centre.lat}, ${centre.lng}], ${zoom});
  L.tileLayer('${TUILES}', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(carte);
  var couche = L.layerGroup().addTo(carte);
  function envoyer(id) {
    var msg = String(id);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    else if (window.parent) window.parent.postMessage({ marqueur: msg }, '*');
  }
  // Regroupement : des marqueurs qui se recouvrent à l'écran (moins de SEUIL px)
  // deviennent UNE pastille portant leur nombre, au barycentre ; un appui zoome
  // sur le groupe (il se sépare de lui-même). Au zoom maximal, des boutiques
  // exactement au même endroit ne se séparent jamais : l'appui renvoie alors
  // « groupe:id1,id2 » à l'application.
  var REGROUPER = ${regrouper};
  var SEUIL = 34;
  var dernier = [];
  // Boutique fixée (mode « focus ») : seules elle et « Vous êtes ici » restent affichées ; les autres
  // boutiques et leurs regroupements disparaissent jusqu'à ce que la fixation soit levée.
  var focusId = null;
  var spread = {};
  var popupCourant = null;
  var popupDonnees = null;
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function htmlAvatar(m) {
    var a = m.avatar, ring = a.bordure;
    var src = a.photo || a.uri;
    var contenu = src
      ? '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover;display:block" />'
      : '<span style="font-size:17px;line-height:1;color:#fff;font-weight:800">' + esc(a.emoji || '🏪') + '</span>';
    var rond = '<div class="rond-cliquable" style="width:38px;height:38px;border-radius:9999px;padding:2.5px;box-sizing:border-box;background:' + ring + ';box-shadow:0 4px 14px ' + ring + '60;display:flex;align-items:center;justify-content:center"><div style="width:100%;height:100%;border-radius:9999px;overflow:hidden;background:#111827;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-sizing:border-box">' + contenu + '</div></div>';
    var echelle = a.selectionne ? 'transform:scale(1.15);transform-origin:50% 100%;' : '';
    if (a.moi) {
      return '<div style="display:flex;flex-direction:column;align-items:center;' + echelle + '">' + rond
        + '<div style="margin-top:4px;padding:2px 8px;background:#1877F2;color:#fff;border-radius:9999px;font:800 10px system-ui,sans-serif;white-space:nowrap;border:1px solid rgba(255,255,255,.35);box-shadow:0 6px 16px rgba(0,0,0,.45)">Vous êtes ici</div></div>';
    }
    // Comme les cartes de commerces compactes : au repos, seul le petit rond ; le nom n'apparaît que sur la boutique touchée.
    if (!a.selectionne) return '<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer">' + rond + '</div>';
    var pastille = '<div style="margin-bottom:6px;padding:3px 10px;background:rgba(17,24,39,.95);color:#fff;border-radius:9999px;font:800 10px system-ui,sans-serif;display:flex;align-items:center;gap:6px;white-space:nowrap;border:1px solid rgba(55,65,81,.8);box-shadow:0 8px 20px rgba(0,0,0,.5);pointer-events:none">'
      + '<span style="width:8px;height:8px;border-radius:9999px;background:' + (a.actif === false ? '#9CA3AF' : '#10B981') + '"></span>'
      + '<span style="max-width:110px;overflow:hidden;text-overflow:ellipsis;font-weight:800">' + esc(m.libelle || '') + '</span>'
      + (a.sous ? '<span style="font-size:9px;font-weight:700;color:#9CA3AF">· ' + esc(a.sous) + '</span>' : '')
      + '</div>';
    var ombre = '';
    return '<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;' + echelle + '">' + pastille + rond + ombre + '</div>';
  }
  function dessiner() {
    couche.clearLayers();
    var libres = [], aGrouper = [];
    var affiches = focusId ? dernier.filter(function (m) { return m.id === focusId || m.halo || (m.avatar && m.avatar.moi); }) : dernier;
    var avatars = affiches.some(function (m) { return m.avatar && !m.avatar.moi; });
    SEUIL = avatars ? 58 : 34;
    affiches.forEach(function (m) { (m.halo || (m.avatar && m.avatar.moi) || !REGROUPER || focusId ? libres : aGrouper).push(m); });
    var pts = aGrouper.map(function (m) { return { m: m, p: carte.latLngToContainerPoint([m.lat, m.lng]) }; });
    var pris = [], groupes = [];
    pts.forEach(function (a, i) {
      if (pris[i]) return;
      pris[i] = true;
      var g = [a];
      pts.forEach(function (b, j) {
        if (pris[j]) return;
        if (Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) < SEUIL) { pris[j] = true; g.push(b); }
      });
      groupes.push(g);
    });
    groupes.forEach(function (g) {
      if (g.length === 1) { libres.push(g[0].m); return; }
      var membres = g.map(function (x) { return x.m; });
      var lat = membres.reduce(function (t, m) { return t + m.lat; }, 0) / membres.length;
      var lng = membres.reduce(function (t, m) { return t + m.lng; }, 0) / membres.length;
      var icone = L.divIcon({
        className: 'bulle-regroupement',
        html: '<div style="width:46px;height:46px;border-radius:9999px;background:#10B981;color:#04130d;border:3px solid #fff;box-shadow:0 0 0 6px rgba(16,185,129,.28),0 6px 16px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font:800 17px system-ui,sans-serif;cursor:pointer">' + membres.length + '</div>',
        iconSize: [46, 46], iconAnchor: [23, 23]
      });
      var bulle = L.marker([lat, lng], { icon: icone, zIndexOffset: 500, keyboard: false, title: membres.length + ' boutiques' }).addTo(couche);
      bulle.on('click', function () {
        var bornes = L.latLngBounds(membres.map(function (m) { return [m.lat, m.lng]; }));
        var identiques = bornes.getSouthWest().equals(bornes.getNorthEast());
        if (identiques || carte.getZoom() >= 18) envoyer('groupe:' + membres.map(function (m) { return m.id; }).join(','));
        else carte.fitBounds(bornes, { padding: [60, 60], maxZoom: 18, animate: true });
      });
    });
    // Marqueurs qui se recouvrent à l'écran (boutiques voisines, au marché) : écartés en cercle autour de leur
    // centre, à taille constante, pour que chacun reste visible et touchable. Recalculé à chaque zoom.
    spread = {};
    var cand = libres.filter(function (m) { return m.avatar && !m.compteur; }).map(function (m) { return { m: m, p: carte.latLngToContainerPoint([m.lat, m.lng]) }; });
    var vus = [];
    cand.forEach(function (a, i) {
      if (vus[i]) return;
      vus[i] = true;
      var g = [a];
      cand.forEach(function (b, j) { if (!vus[j] && Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) < 40) { vus[j] = true; g.push(b); } });
      if (g.length < 2) return;
      var i0 = 0, anneau = 0;
      while (i0 < g.length) {
        var r = 26 + anneau * 30;
        var cap = Math.max(2, Math.floor(2 * Math.PI * r / 42));
        var n = Math.min(cap, g.length - i0);
        for (var t = 0; t < n; t++) {
          var ang = 2 * Math.PI * t / n + (anneau % 2 ? Math.PI / n : 0);
          spread[g[i0 + t].m.id] = { dx: Math.cos(ang) * r, dy: Math.sin(ang) * r };
        }
        i0 += n; anneau++;
      }
    });
    libres.forEach(function (m) {
      if (m.compteur) {
        var taille = m.compteur >= 50 ? 58 : m.compteur >= 10 ? 50 : 42;
        var ic = L.divIcon({
          className: 'bulle-regroupement',
          html: '<div style="width:' + taille + 'px;height:' + taille + 'px;border-radius:9999px;background:' + m.couleur + ';color:#fff;border:3px solid #fff;box-shadow:0 0 0 6px ' + m.couleur + '33,0 6px 16px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:800 ' + (taille > 45 ? 18 : 16) + 'px system-ui,sans-serif;cursor:pointer">' + m.compteur + '</div>',
          iconSize: [taille, taille], iconAnchor: [taille / 2, taille / 2]
        });
        var mk = L.marker([m.lat, m.lng], { icon: ic, zIndexOffset: 400, keyboard: false, title: m.libelle || '' }).addTo(couche);
        if (m.libelle) mk.bindTooltip(m.libelle, { permanent: true, direction: 'bottom', offset: [0, taille / 2 - 4], className: 'etiquette' });
        mk.on('click', function () { envoyer(m.id); });
        return;
      }
      if (m.avatar) {
        if (m.avatar.moi) {
          L.circle([m.lat, m.lng], { radius: 180, color: '#38BDF8', weight: 0, fillColor: '#38BDF8', fillOpacity: .16, interactive: false }).addTo(couche);
        }
        var ia = L.divIcon({ className: 'marqueur-avatar', html: htmlAvatar(m), iconSize: [140, 100], iconAnchor: [70 - (m.avatar.dx || 0) - (spread[m.id] ? spread[m.id].dx : 0), (m.avatar.moi ? 19 : (m.avatar.selectionne ? 64 : 38)) - (spread[m.id] ? spread[m.id].dy : 0)] });
        var ma = L.marker([m.lat, m.lng], { icon: ia, zIndexOffset: m.avatar.moi ? 640 : (m.avatar.selectionne ? 560 : 300), keyboard: false, title: m.libelle || '' }).addTo(couche);
        ma.on('click', function () { envoyer(m.id); });
        return;
      }
      if (m.halo) {
        L.circleMarker([m.lat, m.lng], { radius: (m.rayon || 9) + 9, color: m.couleur, weight: 0, fillColor: m.couleur, fillOpacity: .22, interactive: false }).addTo(couche);
      }
      var c = L.circleMarker([m.lat, m.lng], { radius: m.rayon || 9, color: '#ffffff', weight: 3, fillColor: m.couleur, fillOpacity: 1 }).addTo(couche);
      if (m.libelle) c.bindTooltip(m.libelle, { permanent: true, direction: 'right', offset: [10, 0], className: 'etiquette' });
      c.on('click', function () { envoyer(m.id); });
    });
  }
  function decalagePopup() {
    var sp = popupDonnees && popupDonnees.cle ? spread[popupDonnees.cle] : null;
    return [((popupDonnees && popupDonnees.dx) || 0) + (sp ? sp.dx : 0), -74 + (sp ? sp.dy : 0)];
  }
  function suivrePopup() {
    if (!popupCourant || !popupDonnees) return;
    popupCourant.options.offset = L.point(decalagePopup());
    popupCourant._updatePosition();
  }
  carte.on('zoomend', function () { dessiner(); suivrePopup(); });
  window.majMarqueurs = function (liste, ajuster, focus) {
    dernier = liste;
    focusId = focus || null;
    dessiner();
    var points = (focusId ? liste.filter(function (m) { return m.id === focusId; }) : liste).map(function (m) { return [m.lat, m.lng]; });
    if (ajuster && points.length > 1) carte.fitBounds(points, { padding: [36, 36], maxZoom: 16 });
    else if (ajuster && points.length === 1) carte.setView(points[0], Math.max(carte.getZoom(), 14));
  };
  // decalage : fraction de la hauteur dont le point est remonté à l'écran (laisse la place d'un aperçu en bas).
  window.centrer = function (lat, lng, z, decalage) {
    carte.setView([lat, lng], z || carte.getZoom(), { animate: false });
    if (decalage) carte.panBy([0, Math.round(carte.getSize().y * decalage)], { animate: false });
  };
  window.majPopup = function (d) {
    if (popupCourant) { carte.closePopup(popupCourant); popupCourant = null; }
    popupDonnees = d || null;
    if (!d) return;
    var corps = d.articles === null ? '<div class="pb-vide">Chargement…</div>'
      : d.articles.length === 0 ? '<div class="pb-vide">Cette boutique n’a pas encore d’article.</div>'
      : '<div class="pb-liste">' + d.articles.map(function (a) {
          return '<div class="pb-art" data-act="article:' + esc(a.id) + '"><div class="pb-photo">'
            + (a.photo ? '<img src="' + esc(a.photo) + '" />' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:38px">' + esc(a.icone || '') + '</div>')
            + '<span class="pb-prix">' + esc(a.prix) + '</span></div><div class="pb-titre">' + esc(a.titre) + '</div></div>';
        }).join('') + '</div>';
    var el = document.createElement('div');
    el.innerHTML = '<div class="pb-tete"><div><div class="pb-nom" data-act="boutique">' + esc(d.titre) + '</div>'
      + (d.sous ? '<div class="pb-lieu">📍 ' + esc(d.sous) + '</div>' : '') + '</div><div class="pb-x" data-act="fermer">✕</div></div>' + corps;
    el.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-act]') : null;
      if (t) envoyer(t.getAttribute('data-act'));
    });
    popupCourant = L.popup({ closeButton: false, autoPan: false, closeOnClick: false, className: 'popup-boutique', offset: decalagePopup(), minWidth: 250, maxWidth: 300 })
      .setLatLng([d.lat, d.lng]).setContent(el).openOn(carte);
  };
  var trace = null;
  window.majTrajet = function (t) {
    if (trace) { carte.removeLayer(trace); trace = null; }
    if (!t || !t.points || t.points.length < 2) return;
    trace = L.polyline(t.points, { color: '#38BDF8', weight: 5, opacity: .95, dashArray: t.approximatif ? '9 9' : null, lineCap: 'round', interactive: false }).addTo(carte);
    carte.fitBounds(trace.getBounds(), { paddingTopLeft: [40, 300], paddingBottomRight: [40, 330], maxZoom: 17, animate: false });
  };
  window.zoom = function (delta) { carte.setZoom(carte.getZoom() + delta); };
  window.parent && window.parent !== window && window.parent.postMessage({ pret: true }, '*');
</script>
</body></html>`;
}

export type CommandesCarte = {
  centrer: (lat: number, lng: number, zoom?: number, decalage?: number) => void;
  zoomer: (delta: number) => void;
};

export default function CarteLeaflet({
  centre,
  zoom = 13,
  marqueurs,
  ajuster = true,
  sombre = false,
  interactive = true,
  regrouper = false,
  onMarqueur,
  commandes,
  focus = null,
  popup = null,
  trajet = null,
  style,
}: {
  centre: CentreCarte;
  zoom?: number;
  marqueurs: MarqueurCarte[];
  /** Cadre la carte sur l'ensemble des marqueurs à chaque mise à jour. */
  ajuster?: boolean;
  sombre?: boolean;
  interactive?: boolean;
  /** Regroupe en pastilles à compteur les marqueurs qui se recouvrent. */
  regrouper?: boolean;
  onMarqueur?: (id: string) => void;
  /** Reçoit des commandes impératives (recentrer, zoom ±) pour des contrôles flottants. */
  commandes?: (c: CommandesCarte) => void;
  /** Identifiant de la boutique fixée : les autres marqueurs disparaissent tant qu'il est défini. */
  focus?: string | null;
  /** Bulle d'aperçu au-dessus du rond de la boutique fixée. */
  popup?: PopupBoutique | null;
  /** Trajet à tracer (ligne bleue). */
  trajet?: TrajetCarte | null;
  style?: StyleProp<ViewStyle>;
}) {
  const refWebView = useRef<WebView>(null);
  // Aperçu web : l'iframe est retrouvée par son id (unique par instance) au
  // moment d'agir, plutôt que par une ref posée pendant le rendu.
  const idIframe = `carte-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Le document ne dépend que de la configuration initiale : changer de
  // marqueurs ne le régénère pas (voir plus haut).
  const html = useMemo(
    () => documentHtml(centre, zoom, sombre, interactive, regrouper),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sombre, interactive, regrouper]
  );

  const executer = useCallback((script: string) => {
    if (Platform.OS === 'web') {
      const cadre = document.getElementById(idIframe) as HTMLIFrameElement | null;
      const f = cadre?.contentWindow as (Window & { eval?: (s: string) => void }) | null | undefined;
      try {
        f?.eval?.(script);
      } catch {
        /* document pas encore prêt : la prochaine mise à jour s'en chargera */
      }
    } else {
      refWebView.current?.injectJavaScript(`${script}; true;`);
    }
  }, [idIframe]);

  const miseAJour = useCallback(() => {
    executer(`window.majMarqueurs && window.majMarqueurs(${JSON.stringify(marqueurs)}, ${ajuster}, ${JSON.stringify(focus)})`);
  }, [executer, marqueurs, ajuster, focus]);

  const majPopup = useCallback(() => {
    executer(`window.majPopup && window.majPopup(${JSON.stringify(popup)})`);
  }, [executer, popup]);

  const majTrajet = useCallback(() => {
    executer(`window.majTrajet && window.majTrajet(${JSON.stringify(trajet)})`);
  }, [executer, trajet]);

  useEffect(() => {
    miseAJour();
    majPopup();
  }, [miseAJour, majPopup]);

  useEffect(() => {
    majTrajet();
  }, [majTrajet]);

  useEffect(() => {
    commandes?.({
      centrer: (lat, lng, z, decalage) => executer(`window.centrer && window.centrer(${lat}, ${lng}, ${z ?? 'null'}, ${decalage ?? 'null'})`),
      zoomer: (delta) => executer(`window.zoom && window.zoom(${delta})`),
    });
  }, [commandes, executer]);

  // Aperçu web : le message « pret » de l'iframe déclenche la 1re mise à jour ;
  // les clics sur les marqueurs reviennent par postMessage.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const surMessage = (e: MessageEvent) => {
      if (e.data?.pret) {
        miseAJour();
        majPopup();
        majTrajet();
      }
      if (e.data?.marqueur && onMarqueur) onMarqueur(String(e.data.marqueur));
    };
    window.addEventListener('message', surMessage);
    return () => window.removeEventListener('message', surMessage);
  }, [miseAJour, majPopup, majTrajet, onMarqueur]);

  const surMessageNatif = (e: WebViewMessageEvent) => {
    if (onMarqueur) onMarqueur(e.nativeEvent.data);
  };

  return (
    <View style={style}>
      {Platform.OS === 'web' ? (
        createElement('iframe', {
          id: idIframe,
          srcDoc: html,
          title: 'Carte',
          style: { width: '100%', height: '100%', border: 0 },
        })
      ) : (
        <WebView
          ref={refWebView}
          originWhitelist={['*']}
          source={{ html }}
          javaScriptEnabled
          domStorageEnabled
          onMessage={surMessageNatif}
          onLoadEnd={() => {
            miseAJour();
            majPopup();
            majTrajet();
          }}
          scrollEnabled={false}
          nestedScrollEnabled
          style={{ flex: 1, backgroundColor: 'transparent' }}
        />
      )}
    </View>
  );
}
