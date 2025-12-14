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

Located at `public/manifest.json`:

```json
{
  "name": "EVE Online Tracker",
  "short_name": "EVE Tracker",
  "description": "Track your EVE Online industry, trading, and market analysis",
  "icons": [...],
  "theme_color": "#1a1a2e",
  "background_color": "#1a1a2e",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any"
}
```

### Metadata

PWA metadata is configured in `app/layout.tsx` using Next.js Metadata API:

```typescript
export const metadata: Metadata = {
  applicationName: "EVE Online Tracker",
  manifest: "/manifest.json",
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

## File Structure

```
app/
├── sw.ts                 # Service worker source
└── ~offline/
    └── page.tsx          # Offline fallback page

public/
├── manifest.json         # Web app manifest
├── icons/
│   ├── icon-192x192.svg  # Android icon
│   ├── icon-512x512.svg  # Large icon for splash screens
│   └── apple-touch-icon.svg  # iOS icon
└── sw.js                 # Service worker (generated at build)
```

## Generated Files

The following files are generated during build and should be gitignored:

- `/public/sw.js` - Compiled service worker
- `/public/sw.js.map` - Source map (if enabled)

## Icons

PWA icons are SVG files with the EVE-themed dark color scheme:

- **Theme Color**: `#1a1a2e` (dark navy)
- **Accent Color**: `#4a6fa5` / `#6b8cce` (blue accents)

To update icons, replace the SVG files in `public/icons/`. For better compatibility, you may also want to add PNG versions.

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
