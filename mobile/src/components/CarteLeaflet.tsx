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
};

export type CentreCarte = { lat: number; lng: number };

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
const TUILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function documentHtml(centre: CentreCarte, zoom: number, sombre: boolean, interactive: boolean): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET_CSS}" />
<style>
  html, body, #carte { margin: 0; padding: 0; height: 100%; width: 100%; background: ${sombre ? '#1b2330' : '#e8e4da'}; }
  .leaflet-control-attribution { font-size: 9px; opacity: .7; }
  ${sombre ? '.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(.82) contrast(.92); }' : ''}
  .etiquette { background: rgba(0,0,0,.72); color: #fff; border: 0; border-radius: 10px; padding: 2px 7px; font: 700 11px system-ui, sans-serif; box-shadow: none; }
  .etiquette:before { display: none; }
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
  window.majMarqueurs = function (liste, ajuster) {
    couche.clearLayers();
    var points = [];
    liste.forEach(function (m) {
      if (m.halo) {
        L.circleMarker([m.lat, m.lng], { radius: (m.rayon || 9) + 9, color: m.couleur, weight: 0, fillColor: m.couleur, fillOpacity: .22, interactive: false }).addTo(couche);
      }
      var c = L.circleMarker([m.lat, m.lng], { radius: m.rayon || 9, color: '#ffffff', weight: 3, fillColor: m.couleur, fillOpacity: 1 }).addTo(couche);
      if (m.libelle) c.bindTooltip(m.libelle, { permanent: true, direction: 'right', offset: [10, 0], className: 'etiquette' });
      c.on('click', function () { envoyer(m.id); });
      points.push([m.lat, m.lng]);
    });
    if (ajuster && points.length > 1) carte.fitBounds(points, { padding: [36, 36], maxZoom: 16 });
    else if (ajuster && points.length === 1) carte.setView(points[0], Math.max(carte.getZoom(), 14));
  };
  window.centrer = function (lat, lng, z) { carte.setView([lat, lng], z || carte.getZoom()); };
  window.zoom = function (delta) { carte.setZoom(carte.getZoom() + delta); };
  window.parent && window.parent !== window && window.parent.postMessage({ pret: true }, '*');
</script>
</body></html>`;
}

export type CommandesCarte = {
  centrer: (lat: number, lng: number, zoom?: number) => void;
  zoomer: (delta: number) => void;
};

export default function CarteLeaflet({
  centre,
  zoom = 13,
  marqueurs,
  ajuster = true,
  sombre = false,
  interactive = true,
  onMarqueur,
  commandes,
  style,
}: {
  centre: CentreCarte;
  zoom?: number;
  marqueurs: MarqueurCarte[];
  /** Cadre la carte sur l'ensemble des marqueurs à chaque mise à jour. */
  ajuster?: boolean;
  sombre?: boolean;
  interactive?: boolean;
  onMarqueur?: (id: string) => void;
  /** Reçoit des commandes impératives (recentrer, zoom ±) pour des contrôles flottants. */
  commandes?: (c: CommandesCarte) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const refWebView = useRef<WebView>(null);
  // Aperçu web : l'iframe est retrouvée par son id (unique par instance) au
  // moment d'agir, plutôt que par une ref posée pendant le rendu.
  const idIframe = `carte-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Le document ne dépend que de la configuration initiale : changer de
  // marqueurs ne le régénère pas (voir plus haut).
  const html = useMemo(
    () => documentHtml(centre, zoom, sombre, interactive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sombre, interactive]
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
    executer(`window.majMarqueurs && window.majMarqueurs(${JSON.stringify(marqueurs)}, ${ajuster})`);
  }, [executer, marqueurs, ajuster]);

  useEffect(() => {
    miseAJour();
  }, [miseAJour]);

  useEffect(() => {
    commandes?.({
      centrer: (lat, lng, z) => executer(`window.centrer && window.centrer(${lat}, ${lng}, ${z ?? 'null'})`),
      zoomer: (delta) => executer(`window.zoom && window.zoom(${delta})`),
    });
  }, [commandes, executer]);

  // Aperçu web : le message « pret » de l'iframe déclenche la 1re mise à jour ;
  // les clics sur les marqueurs reviennent par postMessage.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const surMessage = (e: MessageEvent) => {
      if (e.data?.pret) miseAJour();
      if (e.data?.marqueur && onMarqueur) onMarqueur(String(e.data.marqueur));
    };
    window.addEventListener('message', surMessage);
    return () => window.removeEventListener('message', surMessage);
  }, [miseAJour, onMarqueur]);

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
          onLoadEnd={miseAJour}
          scrollEnabled={false}
          nestedScrollEnabled
          style={{ flex: 1, backgroundColor: 'transparent' }}
        />
      )}
    </View>
  );
}
