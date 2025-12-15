# Progressive Web App (PWA) Setup

The EVE Online Tracker is configured as a Progressive Web App using [Serwist](https://serwist.pages.dev/), allowing users to install it on their devices and use it with offline fallback support.

## Overview

Serwist is a modern, actively maintained service worker library for Next.js. It provides better integration with Next.js App Router than alternatives.

Reference: [Aurora Scharff's article on PWAs with Serwist](https://aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist/)

**Note**: Production builds currently require the `--webpack` flag until Serwist fully supports Turbopack ([issue #54](https://github.com/serwist/serwist/issues/54)). Development uses Turbopack normally with PWA disabled.

## Features

- **Installable**: Users can install the app to their home screen on mobile or desktop
- **Offline Fallback**: Shows a custom offline page when network is unavailable
- **Service Worker**: Automatically caches assets for improved performance
- **Theme Integration**: Uses the app's dark theme colors for native appearance
- **Turbopack Compatible**: Works with Next.js 16's default bundler

## Configuration

### Next.js Config

The Serwist plugin is configured in `next.config.ts`:

```typescript
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // your config
};

export default withSerwist(nextConfig);
```

| Option | Description |
|--------|-------------|
| `swSrc` | Source file for the service worker |
| `swDest` | Output path for the compiled service worker |
| `disable` | Disables PWA in development to avoid caching issues |

### Service Worker

The service worker source is at `app/sw.ts`:

```typescript
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
```

| Option | Description |
|--------|-------------|
| `precacheEntries` | Assets to precache (auto-generated manifest) |
| `skipWaiting` | Activate new service worker immediately |
| `clientsClaim` | Take control of all pages immediately |
| `navigationPreload` | Enable navigation preload for faster page loads |
| `runtimeCaching` | Caching strategies for different request types |
| `fallbacks` | Fallback pages when offline |

### Web App Manifest

Located at `app/manifest.ts` (dynamic, typed):

```typescript
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
    icons: [
      { src: '/icons/manifest-icon-192.maskable.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/manifest-icon-192.maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/manifest-icon-512.maskable.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/manifest-icon-512.maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

> **Note**: Icons must be PNG format for PWA installability. SVG icons are not supported by all browsers for the "Add to Home Screen" prompt.

This approach provides TypeScript types and allows dynamic values if needed (e.g., environment-based icons).

### Metadata

PWA metadata is configured in `app/layout.tsx` using Next.js Metadata API:

```typescript
export const metadata: Metadata = {
  applicationName: "EVE Online Tracker",
  // manifest is auto-generated from app/manifest.ts
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EVE Tracker",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
};
```

### Security Headers

Security headers are configured in `next.config.ts`:

```typescript
headers: async () => [
  {
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  },
  {
    source: '/sw.js',
    headers: [
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
    ],
  },
]
```

## File Structure

```
app/
├── manifest.ts           # Dynamic web app manifest (typed)
├── sw.ts                 # Service worker source
└── ~offline/
    └── page.tsx          # Offline fallback page

components/
└── apple-splash-links.tsx  # iOS splash screen link tags

public/
├── icons/
│   ├── manifest-icon-192.maskable.png  # Android icon (192x192)
│   ├── manifest-icon-512.maskable.png  # Large icon (512x512)
│   ├── apple-icon-180.png              # iOS home screen icon
│   ├── favicon-196.png                 # Browser favicon
│   ├── apple-splash-*.png              # iOS splash screens (40+ files)
│   ├── icon-192x192.svg                # Source SVG (kept for reference)
│   └── icon-512x512.svg                # Source SVG (used to generate PNGs)
└── sw.js                 # Service worker (generated at build)
```

## Generated Files

The following files are generated during build and should be gitignored:

- `/public/sw.js` - Compiled service worker
- `/public/sw.js.map` - Source map (if enabled)

## Icons

PWA icons are PNG files generated with [pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator) for maximum browser compatibility:

- **Theme Color**: `#1a1a2e` (dark navy)
- **Accent Color**: `#4a6fa5` / `#6b8cce` (blue accents)

### Icon Files

| File | Purpose |
|------|---------|
| `manifest-icon-192.maskable.png` | Android/Chrome icon (192x192) |
| `manifest-icon-512.maskable.png` | Large icon for splash screens (512x512) |
| `apple-icon-180.png` | iOS home screen icon |
| `favicon-196.png` | Browser favicon |
| `apple-splash-*.png` | iOS splash screens for all device sizes |

### Regenerating Icons

To regenerate icons from a new source SVG:

```bash
npx pwa-asset-generator public/icons/icon-512x512.svg public/icons --background "#1a1a2e" --type png --scrape false
```

This generates:
- Manifest icons with `maskable` purpose for adaptive icons
- Apple touch icon (180x180)
- Favicon (196x196)
- All iOS splash screens for portrait and landscape orientations

## Offline Page

The offline fallback page (`app/~offline/page.tsx`) is shown when:
1. The user is offline
2. The requested page is not in the cache

It includes:
- Visual indicator that the user is offline
- "Try Again" button to reload the page

## Build Configuration

Production builds use webpack to generate the service worker:

```json
"build": "next build --webpack"
```

This is required until Serwist fully supports Turbopack ([issue #54](https://github.com/serwist/serwist/issues/54)). Development still uses Turbopack with PWA disabled.

## Testing

### Development

PWA is disabled in development mode to avoid caching issues. To test PWA functionality:

1. Build the production version:
   ```bash
   pnpm build
   ```

2. Start the production server:
   ```bash
   pnpm start
   ```

3. Open Chrome DevTools and check:
   - **Application > Manifest**: Verify manifest loads correctly
   - **Application > Service Workers**: Confirm service worker is registered
   - **Network tab**: Toggle "Offline" to test offline behavior

### Testing PWA in Development (Optional)

If you need to test PWA features during development, you'll need to use webpack since Serwist doesn't fully support Turbopack for local testing:

```bash
next dev --experimental-https --webpack
```

Add this to your `.env` to suppress warnings:
```
SERWIST_SUPPRESS_TURBOPACK_WARNING=1
```

### Lighthouse Audit

Run a Lighthouse PWA audit:
1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "Progressive Web App" category
4. Click "Analyze page load"

## Troubleshooting

### Service Worker Not Updating

The `skipWaiting: true` and `clientsClaim: true` options should handle this, but if issues persist:
1. Open DevTools > Application > Service Workers
2. Click "Unregister" on the old service worker
3. Refresh the page

### Caching Issues in Development

PWA is disabled in development by default. If you see caching issues:
1. Clear browser cache
2. Unregister any active service workers
3. Restart the dev server

### Icons Not Displaying

Ensure icons are in the correct path (`/public/icons/`) and match the paths in `manifest.json`.

## Why Serwist over next-pwa?

- **Turbopack Compatible**: Works with Next.js 16's default bundler
- **No --webpack Flag**: Production builds don't require special flags
- **Actively Maintained**: Modern service worker library
- **Better Performance**: Native integration with Next.js App Router
