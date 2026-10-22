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
  /** Bouton vert sous la liste (ex. « Itinéraire »), renvoyé à l'application par son identifiant. */
  action?: { id: string; libelle: string };
  /** null = chargement des articles en cours. */
  articles: { id: string; titre: string; prix: string; photo?: string; icone?: string }[] | null;
};

/** Trajet tracé sur la carte (ex. « M'y rendre ») ; `approximatif` = ligne droite en pointillés. */
export type TrajetCarte = { points: [number, number][]; approximatif?: boolean };

export type CentreCarte = { lat: number; lng: number };

import { REGIONS_CARTE } from '@/lib/regionsCarte';

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
// Plan clair aux couleurs proches de Google Maps (Esri World Street Map, sans clé). CARTO « Voyager » a été essayé : il exige
// maintenant une clé d'API et affiche un filigrane « API KEY REQUIRED ».
const TUILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
// Vue satellite façon Google Maps (photo aérienne + noms de lieux par-dessus) : fonds Esri World Imagery et Esri Reference.
const TUILES_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TUILES_NOMS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

function documentHtml(centre: CentreCarte, zoom: number, sombre: boolean, interactive: boolean, regrouper: boolean, regions: boolean, margeHaut: number, margeBas: number, satellite: boolean): string {
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
  .region-nom { background: none; border: 0; pointer-events: none; }
  .region-nom span { display: block; width: 140px; text-align: center; font: 800 11px system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; color: ${sombre ? 'rgba(255,255,255,.68)' : 'rgba(30,41,59,.62)'}; text-shadow: ${sombre ? '0 1px 3px rgba(0,0,0,.9), 0 0 6px rgba(0,0,0,.6)' : '0 1px 2px rgba(255,255,255,.9)'}; }
  .zoom-proche .region-nom span { opacity: .4; }
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
  .pb-action { display: block; margin: 0 14px 14px; padding: 10px 0; border-radius: 14px; background: #10B981; color: #fff; text-align: center; font: 800 13px system-ui, sans-serif; cursor: pointer; }
  .pb-vide { padding: 8px 16px 16px; font: 600 12px system-ui, sans-serif; color: rgba(0,0,0,.5); }
  @keyframes pulse { 0% { r: 9; opacity: .5 } 100% { r: 26; opacity: 0 } }
</style>
</head><body>
<div id="carte"></div>
<script src="${LEAFLET_JS}"></script>
<script>
  var carte = L.map('carte', { zoomControl: false, attributionControl: true, dragging: ${interactive}, touchZoom: ${interactive}, scrollWheelZoom: ${interactive}, doubleClickZoom: ${interactive}, boxZoom: false, keyboard: false })
    .setView([${centre.lat}, ${centre.lng}], ${zoom});
  ${satellite
    ? "L.tileLayer('" + TUILES_SATELLITE + "', { maxZoom: 19, attribution: 'Imagery &copy; Esri' }).addTo(carte); L.tileLayer('" + TUILES_NOMS + "', { maxZoom: 19 }).addTo(carte);"
    : "L.tileLayer('" + TUILES + "', { maxZoom: 19, attribution: 'Map &copy; Esri, HERE, Garmin, OpenStreetMap contributors' }).addTo(carte);"}
  var CLAIR = ${!sombre && !satellite};
  var couche = L.layerGroup().addTo(carte);
  // Limites et noms des 14 régions du Sénégal (OCHA / geoBoundaries) : contour coloré, léger voile, nom au centre.
  var REGIONS = ${regions ? JSON.stringify(REGIONS_CARTE) : 'null'};
  if (REGIONS) {
    carte.createPane('regions');
    carte.getPane('regions').style.zIndex = 250;
    carte.attributionControl.addAttribution('Limites : OCHA / geoBoundaries');
    var PALETTE = ['#38BDF8', '#F59E0B', '#34D399', '#F472B6', '#A78BFA', '#FB923C', '#2DD4BF', '#FACC15', '#60A5FA', '#F87171', '#4ADE80', '#C084FC', '#22D3EE', '#FDBA74'];
    REGIONS.forEach(function (r, i) {
      var c = PALETTE[i % PALETTE.length];
      L.polygon(r.poly, { pane: 'regions', color: c, weight: 1.8, opacity: .9, dashArray: '6 5', fillColor: c, fillOpacity: ${sombre ? 0.07 : 0.12}, interactive: false }).addTo(carte);
      L.marker(r.centre, { icon: L.divIcon({ className: 'region-nom', html: '<span>' + esc(r.nom) + '</span>', iconSize: [140, 16], iconAnchor: [70, 8] }), interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(carte);
    });
    var suivreZoomRegions = function () { carte.getContainer().classList.toggle('zoom-proche', carte.getZoom() >= 12); };
    carte.on('zoomend', suivreZoomRegions);
    suivreZoomRegions();
  }
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
  var TAILLE = 28, LARGEUR_ETIQ = 112;   // petit rond de taille FIXE (px) ; largeur maximale d'un nom
  var enCluster = {};   // id -> true quand la boutique fait partie d'une grappe (rond sans pointe)
  var piles = {};   // id de la boutique du dessus -> boutiques empilees avec elle (zoom faible)
  var MARGE_H = ${margeHaut}, MARGE_B = ${margeBas};
  var popupCourant = null;
  var popupDonnees = null;
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // Taille des ronds de boutiques : FIXE à tous les zooms, et jamais déplacés : leur position est toujours celle de la boutique.
  function echelleZoom() { return 1; }
  var etiquettes = {};   // id -> cote ou le nom est ecrit : 'd' droite, 'g' gauche, 'b' dessous, 'h' dessus (absent = pas de nom)
  function htmlAvatar(m) {
    var a = m.avatar, ring = a.bordure;
    if (a.moi) {
      // Point bleu à bordure blanche et halo, comme Google Maps (le halo de précision est tracé séparément).
      return '<div style="display:flex;justify-content:center"><div style="margin-top:3px;width:22px;height:22px;border-radius:9999px;background:#4285F4;border:3px solid #fff;box-sizing:border-box;box-shadow:0 0 0 7px rgba(66,133,244,.25),0 2px 6px rgba(0,0,0,.45)"></div></div>';
    }
    var src = a.photo || a.uri;
    var contenu = src
      ? '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover;display:block" />'
      : '<span style="font-size:13px;line-height:1;color:#fff;font-weight:800">' + esc(a.emoji || '🏪') + '</span>';
    // Comme les points d'intérêt de Google Maps : un petit rond CENTRÉ sur la position exacte, son nom à côté (côté choisi pour
    // ne gêner aucun autre nom ni rond ; nom masqué s'il n'y a pas de place).
    var rond = '<div class="rond-cliquable" style="position:relative;width:' + TAILLE + 'px;height:' + TAILLE + 'px;border-radius:9999px;padding:2px;box-sizing:border-box;background:' + ring + ';box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><div style="width:100%;height:100%;border-radius:9999px;overflow:hidden;background:#111827;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;box-sizing:border-box">' + contenu + '</div></div>';
    var queue = '<div style="position:absolute;left:50%;top:' + (TAILLE - 3) + 'px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid ' + ring + '"></div>';
    if (enCluster[m.id]) queue = '';
    var pl = piles[m.id];
    var badge = pl && pl.length ? '<div style="position:absolute;top:-8px;right:-10px;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:9999px;background:#EF4444;color:#fff;border:1.5px solid #fff;font:800 9.5px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:none">+' + pl.length + '</div>' : '';
    var cote = etiquettes[m.id];
    var position = cote === 'd' ? 'left:' + (TAILLE + 5) + 'px;top:50%;transform:translateY(-50%);'
      : cote === 'g' ? 'right:' + (TAILLE + 5) + 'px;top:50%;transform:translateY(-50%);'
      : cote === 'b' ? 'top:' + (TAILLE + 3) + 'px;left:50%;transform:translateX(-50%);'
      : cote === 'h' ? 'bottom:' + (TAILLE + 3) + 'px;left:50%;transform:translateX(-50%);' : '';
    var etiq = (cote && !a.selectionne && m.libelle) ? '<div style="position:absolute;' + position + 'max-width:' + LARGEUR_ETIQ + 'px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;font:700 11px system-ui,sans-serif;color:' + (CLAIR ? '#0F766E' : '#fff') + ';text-shadow:' + (CLAIR ? '0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 5px #fff' : '0 0 3px #000,0 0 3px #000,0 0 5px #000') + '">' + esc(m.libelle) + '</div>' : '';
    var pastille = '';   // pas de pastille de nom au-dessus du pin sélectionné : la bulle des produits porte déjà le nom
    var echelle = a.selectionne ? 'transform:scale(1.3);transform-origin:50% ' + (enCluster[m.id] ? TAILLE / 2 : TAILLE + 5) + 'px;z-index:5;' : '';
    return '<div style="position:relative;width:' + TAILLE + 'px;height:' + TAILLE + 'px;margin:0 auto;cursor:pointer;' + echelle + '">' + rond + queue + badge + etiq + pastille + '</div>';
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
    // « Vous êtes ici » reste à sa vraie place et ne bouge pas : ce sont les boutiques voisines qui s'écartent de lui
    // (rayon plus grand), pour qu'aucune ne soit cachée par le rond ou par l'étiquette.
    var moiMarq = libres.filter(function (m) { return m.avatar && m.avatar.moi; })[0];
    var moiPt = moiMarq ? carte.latLngToContainerPoint([moiMarq.lat, moiMarq.lng]) : null;
    // GRAPPES (choix du 22/10/2026) : des boutiques très proches les unes des autres (moins de 200 m, mesurés sur la carte, donc
    // indépendamment du zoom) forment une grappe : leurs ronds se serrent en couronne, collés, autour du centre du groupe (autour du
    // point bleu « Vous êtes ici » quand il est dans le groupe), avec un halo vert doux. Tous les ronds ont la MÊME taille à tous les
    // zooms et la couronne a toujours la même forme ; seule la grappe entière suit la carte. Une boutique isolée reste une icône
    // à pointe exactement sur sa position. Entre groupes qui se recouvriraient à l'écran, le moins prioritaire est masqué et signalé
    // par « +N » (comme Google Maps) jusqu'à un zoom où la place le permet.
    spread = {};
    piles = {};
    enCluster = {};
    var D = TAILLE + 1, RAYON_GRAPPE = 200;
    var aPlacer = libres.filter(function (m) { return m.avatar && !m.compteur && !m.avatar.moi; })
      .map(function (m) { return { m: m, p: carte.latLngToContainerPoint([m.lat, m.lng]) }; })
      .sort(function (u, v) { return String(u.m.id) < String(v.m.id) ? -1 : 1; });
    var centres = {}, afficher = {}, grappes = [];
    var moiAff = moiPt;
    var pris = {}, moiPris = false, entites = [];
    aPlacer.forEach(function (a) {
      if (pris[a.m.id]) return;
      pris[a.m.id] = true;
      var membres = [a];
      aPlacer.forEach(function (b) { if (!pris[b.m.id] && carte.distance([a.m.lat, a.m.lng], [b.m.lat, b.m.lng]) < RAYON_GRAPPE) { pris[b.m.id] = true; membres.push(b); } });
      var avecMoi = false;
      if (moiMarq && !moiPris && carte.distance([a.m.lat, a.m.lng], [moiMarq.lat, moiMarq.lng]) < RAYON_GRAPPE) { avecMoi = true; moiPris = true; }
      entites.push({ membres: membres, avecMoi: avecMoi, selection: membres.some(function (x) { return x.m.avatar.selectionne; }) });
    });
    function couronnes(k, centreOccupe) {
      var pos = [], reste = k, i = 0;
      var cap0 = centreOccupe ? Math.min(k, 8) : Math.min(k, 7);
      var r0 = Math.max(centreOccupe ? D : 0, D / (2 * Math.sin(Math.PI / Math.max(cap0, 2))));
      var r = r0;
      while (reste > 0) {
        r = r0 + i * D;
        var n = i === 0 ? cap0 : Math.min(reste, Math.max(1, Math.floor(2 * Math.PI * r / D)));
        for (var t = 0; t < n; t++) {
          var ang = -Math.PI / 2 + 2 * Math.PI * t / n + (i % 2 ? Math.PI / n : 0);
          pos.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
        }
        reste -= n; i++;
      }
      return { pos: pos, rayon: r + D / 2 };
    }
    entites.forEach(function (e) {
      var k = e.membres.length;
      var sx = 0, sy = 0;
      e.membres.forEach(function (x) { sx += x.p.x; sy += x.p.y; });
      e.cx = sx / k; e.cy = sy / k;
      e.grappe = k > 1 || e.avecMoi;
      if (e.grappe) {
        var c = couronnes(k, e.avecMoi);
        e.pos = c.pos; e.R = c.rayon;
      } else {
        e.cx = e.membres[0].p.x; e.cy = e.membres[0].p.y - (TAILLE / 2 + 5); e.R = TAILLE / 2;
      }
    });
    entites.sort(function (u, v) { return ((v.selection || v.avecMoi) ? 1 : 0) - ((u.selection || u.avecMoi) ? 1 : 0) || v.membres.length - u.membres.length || (String(u.membres[0].m.id) < String(v.membres[0].m.id) ? -1 : 1); });
    var montres = [];
    entites.forEach(function (e) {
      var bloque = null;
      for (var q = 0; q < montres.length && !bloque; q++) if (Math.hypot(montres[q].cx - e.cx, montres[q].cy - e.cy) < montres[q].R + e.R) bloque = montres[q];
      if (bloque && !e.selection && !e.avecMoi) {
        // masquée : signalée par « +N » sur le premier rond de l'entité qui la couvre
        var cible = bloque.membres[0].m.id;
        piles[cible] = (piles[cible] || []).concat(e.membres.map(function (x) { return x.m; }));
        return;
      }
      montres.push(e);
      e.membres.forEach(function (x, t) {
        afficher[x.m.id] = true;
        if (e.grappe) {
          var cible2 = { x: e.cx + e.pos[t].x, y: e.cy + e.pos[t].y };
          centres[x.m.id] = cible2;
          enCluster[x.m.id] = true;
          spread[x.m.id] = { dx: cible2.x - x.p.x, dy: cible2.y - x.p.y };
        } else {
          centres[x.m.id] = { x: e.cx, y: e.cy };
        }
      });
      if (e.avecMoi && moiPt) {
        spread[moiMarq.id] = { dx: e.cx - moiPt.x, dy: e.cy - moiPt.y };
        moiAff = { x: e.cx, y: e.cy };
      }
      if (e.grappe) grappes.push(e);
    });
    // halo vert doux derrière chaque grappe affichée
    grappes.forEach(function (e) {
      var S = Math.round(2 * (e.R + 18));
      var centreHalo = carte.containerPointToLatLng(L.point(e.cx, e.cy));
      var icHalo = L.divIcon({ className: 'bulle-regroupement', html: '<div style="width:' + S + 'px;height:' + S + 'px;border-radius:9999px;background:radial-gradient(circle, rgba(16,185,129,.42) 0%, rgba(16,185,129,.26) 55%, rgba(16,185,129,0) 72%);pointer-events:none"></div>', iconSize: [S, S], iconAnchor: [S / 2, S / 2] });
      L.marker(centreHalo, { icon: icHalo, interactive: false, keyboard: false, zIndexOffset: 100 }).addTo(couche);
    });
    // Noms (comme Google Maps) : à partir du zoom 14, chacun prend le premier côté libre (droite, gauche, dessous, dessus) ;
    // s'il n'y en a aucun, le nom est masqué, jamais le rond.
    etiquettes = {};
    var rects = [];
    var croise = function (u, v) { return u.x1 < v.x2 && u.x2 > v.x1 && u.y1 < v.y2 && u.y2 > v.y1; };
    aPlacer.forEach(function (it) { if (!afficher[it.m.id]) return; var c = centres[it.m.id]; rects.push({ x1: c.x - TAILLE / 2, y1: c.y - TAILLE / 2, x2: c.x + TAILLE / 2, y2: c.y + TAILLE / 2 }); });
    if (moiAff) rects.push({ x1: moiAff.x - 14, y1: moiAff.y - 14, x2: moiAff.x + 14, y2: moiAff.y + 14 });
    if (carte.getZoom() >= 14) {
      aPlacer.forEach(function (it) {
        var m = it.m, c = centres[m.id];
        if (!afficher[m.id] || !m.libelle || m.avatar.selectionne) return;
        var w = Math.min(LARGEUR_ETIQ, 6.3 * String(m.libelle).length + 4), h = 14, g = TAILLE / 2 + 4;
        var essais = [
          ['d', { x1: c.x + g, y1: c.y - h / 2, x2: c.x + g + w, y2: c.y + h / 2 }],
          ['g', { x1: c.x - g - w, y1: c.y - h / 2, x2: c.x - g, y2: c.y + h / 2 }],
          ['b', { x1: c.x - w / 2, y1: c.y + g - 2, x2: c.x + w / 2, y2: c.y + g - 2 + h }],
          ['h', { x1: c.x - w / 2, y1: c.y - g + 2 - h, x2: c.x + w / 2, y2: c.y - g + 2 }]
        ];
        for (var e = 0; e < essais.length; e++) {
          var libreCote = true;
          for (var q = 0; q < rects.length; q++) {
            // le rond du marqueur lui-même ne compte pas : seuls les autres ronds et noms déjà posés gênent
            if (croise(essais[e][1], rects[q])) { libreCote = false; break; }
          }
          if (libreCote) { etiquettes[m.id] = essais[e][0]; rects.push(essais[e][1]); break; }
        }
      });
    }
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
        if (!m.avatar.moi && !afficher[m.id]) return;
        if (m.avatar.moi) {
          L.circle([m.lat, m.lng], { radius: 180, color: '#38BDF8', weight: 0, fillColor: '#38BDF8', fillOpacity: .16, interactive: false }).addTo(couche);
        }
        var ia = L.divIcon({ className: 'marqueur-avatar', html: htmlAvatar(m), iconSize: [140, 44], iconAnchor: [70 - (m.avatar.dx || 0) - (spread[m.id] ? spread[m.id].dx : 0), (m.avatar.moi ? 14 : (enCluster[m.id] ? TAILLE / 2 : TAILLE + 5)) - (spread[m.id] ? spread[m.id].dy : 0)] });
        var ma = L.marker([m.lat, m.lng], { icon: ia, zIndexOffset: m.avatar.moi ? 250 : (m.avatar.selectionne ? 560 : 300), keyboard: false, title: m.libelle || '' }).addTo(couche);
        ma.on('click', function () {
          var pl2 = piles[m.id];
          if (pl2 && pl2.length && !m.avatar.selectionne) {
            // Rond qui en cache d'autres : on zoome sur eux pour qu'ils se séparent (Google Maps fait de même).
            var bornes = L.latLngBounds([[m.lat, m.lng]].concat(pl2.map(function (x) { return [x.lat, x.lng]; })));
            if (bornes.getSouthWest().equals(bornes.getNorthEast()) || carte.getZoom() >= 18) envoyer(m.id);
            else carte.fitBounds(bornes, { padding: [80, 80], maxZoom: 18, animate: true });
          } else envoyer(m.id);
        });
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
  // Boutiques HORS DE LA VUE : un petit rond sur le bord de l'ecran, du cote ou elles se trouvent ; un appui les ouvre.
  var bord = document.createElement('div');
  bord.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:800;overflow:hidden';
  carte.getContainer().appendChild(bord);
  function majBords() {
    bord.innerHTML = '';
    if (focusId) return;
    var t = carte.getSize();
    var haut = MARGE_H + 18, bas = t.y - MARGE_B - 18;
    if (bas <= haut) return;
    dernier.forEach(function (m) {
      if (!m.avatar || m.avatar.moi || m.compteur) return;
      var p = carte.latLngToContainerPoint([m.lat, m.lng]);
      if (p.x >= 14 && p.x <= t.x - 14 && p.y >= MARGE_H && p.y <= t.y - MARGE_B) return;
      var x = Math.min(Math.max(p.x, 22), t.x - 22), y = Math.min(Math.max(p.y, haut), bas);
      var a = m.avatar, src = a.photo || a.uri;
      var el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:' + (x - 15) + 'px;top:' + (y - 15) + 'px;width:30px;height:30px;border-radius:9999px;box-sizing:border-box;border:2.5px solid ' + a.bordure + ';background:#111827;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.5);opacity:.92;pointer-events:auto;cursor:pointer';
      el.innerHTML = src ? '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover" />' : '<span style="font-size:13px;line-height:1;color:#fff;font-weight:800">' + esc(a.emoji || '') + '</span>';
      el.title = m.libelle || '';
      el.addEventListener('click', function (e) { e.stopPropagation(); envoyer(m.id); });
      bord.appendChild(el);
    });
  }
  carte.on('move', majBords);
  carte.on('zoomend', function () { dessiner(); suivrePopup(); majBords(); });
  window.majMarqueurs = function (liste, ajuster, focus) {
    dernier = liste;
    focusId = focus || null;
    dessiner();
    // Cadrage : PLUSIEURS boutiques (par exemple celles qui vendent le produit cherché) = vue d'ensemble de toutes, sans zoomer
    // sur l'une d'elles (zoom plafonné à 13) ; une SEULE boutique = on peut zoomer dessus. Toujours dans la bande visible entre
    // les bandeaux du haut et du bas.
    var boutiquesAff = liste.filter(function (m) { return m.avatar && !m.avatar.moi && !m.compteur; });
    var points = (focusId ? liste.filter(function (m) { return m.id === focusId; }) : (boutiquesAff.length > 1 ? boutiquesAff : liste)).map(function (m) { return [m.lat, m.lng]; });
    var plafond = !focusId && boutiquesAff.length > 1 ? 13 : 16;
    if (ajuster && points.length > 1) carte.fitBounds(points, { paddingTopLeft: [36, MARGE_H + 24], paddingBottomRight: [36, MARGE_B + 24], maxZoom: plafond });
    else if (ajuster && points.length === 1) carte.setView(points[0], Math.max(carte.getZoom(), 14));
    majBords();
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
      + (d.sous ? '<div class="pb-lieu">📍 ' + esc(d.sous) + '</div>' : '') + '</div><div class="pb-x" data-act="fermer">✕</div></div>' + corps
      + (d.action ? '<div class="pb-action" data-act="' + esc(d.action.id) + '">📨 ' + esc(d.action.libelle) + '</div>' : '');
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
  regions = false,
  margeHaut = 0,
  margeBas = 0,
  satellite = false,
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
  /** Hauteur (px) des bandeaux posés EN HAUT / EN BAS de la carte : les repères de boutiques hors vue restent entre les deux. */
  margeHaut?: number;
  margeBas?: number;
  /** Vue satellite (photo aérienne + noms de lieux), comme Google Maps. */
  satellite?: boolean;
  interactive?: boolean;
  /** Regroupe en pastilles à compteur les marqueurs qui se recouvrent. */
  regrouper?: boolean;
  /** Trace les limites et les noms des régions du Sénégal. */
  regions?: boolean;
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
    () => documentHtml(centre, zoom, sombre, interactive, regrouper, regions, margeHaut, margeBas, satellite),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sombre, interactive, regrouper, regions, margeHaut, margeBas, satellite]
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
