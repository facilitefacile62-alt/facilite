import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { urlDocument, type DocumentProfil } from '@/lib/documents';

// Vignette d'un document du profil : la PREMIÈRE PAGE du PDF (dessinée par pdf.js dans une petite WebView
// sans interaction) ou la photo elle-même. Tant que l'aperçu n'est pas prêt, ou s'il échoue, l'icône de
// document reste affichée dessous : la carte n'est jamais vide ni cassée.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function htmlApercuPdf(url: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>html,body{margin:0;padding:0;background:#fff;overflow:hidden}canvas{display:block;width:100%}</style>
</head><body><canvas id="c"></canvas>
<script src="${PDFJS}"></script>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_WORKER}';
  pdfjsLib.getDocument(${JSON.stringify(url)}).promise
    .then(function (pdf) { return pdf.getPage(1); })
    .then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var scale = Math.min(3, (window.innerWidth * (window.devicePixelRatio || 1)) / base.width);
      var vp = page.getViewport({ scale: scale });
      var c = document.getElementById('c');
      c.width = vp.width; c.height = vp.height;
      return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    })
    .then(function () { window.ReactNativeWebView && window.ReactNativeWebView.postMessage('ok'); })
    .catch(function () { window.ReactNativeWebView && window.ReactNativeWebView.postMessage('erreur'); });
</script></body></html>`;
}

export default function ApercuDocument({ document }: { document: DocumentProfil }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let annule = false;
    urlDocument(document.chemin).then((u) => {
      if (!annule) setUrl(u);
    });
    return () => {
      annule = true;
    };
  }, [document.chemin]);

  const html = useMemo(() => (url && !document.estImage ? htmlApercuPdf(url) : null), [url, document.estImage]);

  return (
    <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
      <Ionicons name={document.estImage ? 'image-outline' : 'document-text-outline'} size={30} color="rgba(0,0,0,0.3)" />
      {url && document.estImage ? (
        <Image source={{ uri: url }} cachePolicy="memory" alt={document.titre} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
      ) : null}
      {html ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: pret ? 1 : 0, backgroundColor: '#fff' }}>
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            javaScriptEnabled
            scrollEnabled={false}
            onMessage={(e) => setPret(e.nativeEvent.data === 'ok')}
            style={{ flex: 1, backgroundColor: '#fff' }}
          />
        </View>
      ) : null}
    </View>
  );
}
