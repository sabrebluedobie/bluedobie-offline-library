BLUEDOBIE OFFLINE LIBRARY - VERSION 1
====================================
INCLUDED: USDA Home Canning Introduction and Guides 1 through 7 as searchable text.
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
- All built-in guides are bundled with the app. New imports are device-local only.

OFFLINE RELIABILITY REPAIR
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

Offline launch reuses the installed worker without calling register again. A missing
worker requires an online first setup; missing cache files are not repaired while offline.


Original PDFs release (November 9, 2026)
The original-PDF section contains USDA's Complete Guide to Home Canning, 2015 revision: Introduction and Guides 1–7, unchanged from official NCHFP files. Search includes Introduction and Guides 6–7 as page-preserving layout extraction with PDF page links. This is a search aid, not a certified transcription. Table columns, footnotes and cross-page procedures must be checked in the original. No clinical or food-safety review is implied.

Save each needed PDF separately on EACH device. Downloads are checked against byte size and SHA-256 before offline verification. App-shell readiness does not mean every PDF is saved. Full originals total about 13.52 MiB, in addition to the small search app. Browser quota estimates are not promises of storage availability or permanence. Save independent copies in On My iPad/iPhone or your computer's local Files.

Preserve source credits and dates. Source URLs/hashes are in originals.json. USDA/NAL public-domain policy: https://www.nal.usda.gov/exhibits/ipd/canning/about . No USDA endorsement is implied. These are the 2015 originals, not a newly issued edition. Table text extraction can be damaged; use original tables and complete procedures, and verify current authoritative updates before safety-critical use.

Verification limits: automated cache/range/hash tests passed. Mac showed the original PDF and later table page with the local origin server stopped. That is not a complete network-offline test: browser PDF extensions may use outside resources. Actual iPad/phone Airplane Mode cold-launch, later-page navigation and independent Files-copy tests remain required. No AI integration is added.

Search update: Introduction and Guides 6–7 are indexed by PDF page. Results deliberately show matching terms and an original-page link, not extracted instructions or Copy for Gemma: validation found corrupted source text layers. This enables finding passages without claiming a reliable transcription. Guides 1–5 retain legacy text and safety warnings.

Reviewed reference addition: CDC emergency water, handwashing, shelter health and USGS map/compass unchanged originals, with five PDF-page search locators. Not a clinical manual or shelter-building guide; compass examples are historical. CDC material is freely available at its original source, with no CDC or US Government endorsement of this library. EPA conflicting guidance and other held sources are not bundled. Save each new original on each device; caches are not automatically removed.

Multi-page PDF viewer: bundled PDF.js 6.5.438 (Apache-2.0), no external CDN. Use Previous/Next, page number and Go, or Zoom. Renderer assets add about 5.6 MiB to shell caching. Update online and wait for offline verification before relying on it. Mac origin-stopped tests cover pages 12–16; actual iPad airplane-mode test still required. Canvas viewer is visual and does not yet expose a selectable accessible PDF text layer.

Additional CDC originals: Emergency Wound Care After a Natural Disaster (2017) and Eat Safe Food after a Power Outage (2020), exact CDC Stacks items explicitly marked Public Domain. Unchanged originals plus page-location search, not extracted treatment instructions or a comprehensive first-aid manual. Preserve all source cautions and obtain professional medical care where indicated.

IFRC Shelter Safety Handbook addition (November 10, 2026): unchanged official 2011 English PDF, 62 pages, approximately 1.07 MiB. Copyright IFRC, Geneva, 2011; PDF page 2 permits noncommercial copying with source acknowledgement. Preserve the copyright and illustration credits. This permission is not public domain or a general commercial-use license. Official source: https://www.ifrc.org/document/shelter-safety-handbook . Every nonblank PDF page is searchable as a locator; open the original to read diagrams and complete guidance. Consult current local building codes and qualified professionals for site-specific decisions. Save this original separately on each device and test offline opening after updating online.

Diabetes references prepared November 11, 2026: four clearly labeled text-only CDC/FDA webpage captures plus the unchanged 20-page FDA-Approved Insulin Products PDF. Images and site navigation are excluded; hyperlinks are listed but their destinations are not bundled. Product-specific insulin instructions must not be generalized. Search is page-location only; consult full documents, current labels and qualified medical advice. These additions are not a personalized diabetes treatment plan.
