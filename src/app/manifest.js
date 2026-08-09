export default function manifest() {
  return {
    name: 'Facilite',
    short_name: 'Facilite',
    description: 'Créez vos CV percutants et trouvez des offres d\'emploi au Sénégal et en Afrique.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
