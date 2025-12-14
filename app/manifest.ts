import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EVE Online Tracker',
    short_name: 'EVE Tracker',
    description: 'Track your EVE Online industry, trading, and market analysis',
    start_url: '/',
    display: 'standalone',
    background_color: '#1a1a2e',
    theme_color: '#1a1a2e',
    orientation: 'any',
    icons: [
      {
        src: '/icons/icon-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  }
}

