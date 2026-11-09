BLUEDOBIE OFFLINE LIBRARY - VERSION 1
====================================
INCLUDED: USDA Home Canning Guides 1 through 5 as searchable TXT sections.
NO subscriptions, cloud API, remote AI, or network needed after installation and caching.

IMPORTANT: A ZIP opened in iOS Files is NOT an installable PWA. To install as an app:
1. Upload the unzipped folder contents to an HTTPS static hosting service, preserving paths.
   GitHub Pages or Cloudflare Pages can host it on a free plan (subject to their terms).
2. Visit the HTTPS URL in Safari on your iPad or iPhone while online.
3. Wait for "Offline files verified on this device". If offline verification fails,
   stay online and reload; do not rely on the app until verification succeeds.
4. In Safari choose Share > Add to Home Screen > Add.
5. Launch the Home Screen app while online once.
6. Enable Airplane Mode, fully close and reopen the app, then search for venison.
7. Repeat setup on the other device. IndexedDB imports are per-device, not synced.

To add TXT guides: unzip the TXT archive in iOS Files, open Import more TXT guides,
select one or more TXT files. They are saved to the device's IndexedDB storage.

LIMITATIONS:
- Search uses local keyword matching, not semantic embeddings or automatic model tool calls.
- Tap "Copy for Gemma" then paste into Locally. The apps are not integrated.
- TXT extraction can corrupt tables. Always verify safety-critical numbers against the original USDA PDF.
- Clearing Safari/site data or device storage pressure can delete imported guides.
- PWA offline cache may be evicted by iOS. Verify offline access before relying on it.
- All five built-in guides are bundled with the app. New imports are device-local only.

LOCAL OFFLINE RELIABILITY REPAIR (not yet deployed)
- The app now waits for its controlling service worker to verify every shell/data asset.
- Missing cached assets are repaired when online; registration/setup failures are visible.
- Navigation uses the cached shell first, including home-screen launches and query URLs.
- Older cache generations are retained to avoid deleting resources under open tabs.
- Cache verification is a point-in-time check, not a guarantee against later storage eviction.
- After an update, close/reopen or reload online before testing the new version offline.

Developer checks: node --test tests/offline.test.cjs
Also run: node --check app.js; node --check offline.js; node --check sw.js
These automated tests simulate browser APIs. They do not certify Safari/iOS behavior.
Device acceptance: install/open while online; wait for verification; enable Airplane Mode
with Wi-Fi disabled; fully close and reopen; search several guides, open copied text,
restart the device and repeat. Repeat separately on every phone, tablet, and computer.
Do not delete existing imports/site data to test. Keep original PDFs separately in Files.
