BLUEDOBIE OFFLINE LIBRARY
=========================
USDA Complete Guide to Home Canning (Introduction and Guides 1-7), plus CDC emergency
water, handwashing, shelter health, disaster wound care, power-outage food safety, the
USGS map-and-compass guide, the IFRC Shelter Safety Handbook, and CDC/FDA diabetes
emergency references. Unchanged original PDFs plus local, page-by-page search.
No subscriptions, cloud API, remote AI, or network needed once set up.

TWO WAYS TO USE IT OFFLINE (USE BOTH WHERE YOU CAN)
---------------------------------------------------
A. Installed app (iPhone, iPad, Android, computers) - full features, including pictures
   of the original pages in search results.
   1. Upload the folder contents to an HTTPS static host (for example GitHub Pages or
      Cloudflare Pages), preserving paths.
   2. Open the HTTPS address in Safari (or Chrome) while online.
   3. Wait until the status says "Offline ready on this device: search ✓ · all 20 PDFs
      saved". The app saves every original PDF automatically (about 18 MiB) and asks the
      browser to protect that storage. Do not rely on it until every PDF shows as saved.
   4. iPhone/iPad: Share > Add to Home Screen > Add. Launch it from the Home Screen once
      while online.
   5. Test: Airplane Mode with Wi-Fi off, fully close and reopen the app, search for
      venison and for sauerkraut, and open a page picture.
   6. Repeat on every device. Storage is per device and per browser, not synced.

B. Portable copy (Mac, Windows, Linux) - needs no internet, no server and no cache.
   Copy this whole folder (including the originals and vendor folders) to the computer
   or a USB drive and double-click index.html. Search works straight from the files;
   "Open page" opens the PDF at the right page in the browser's own PDF reader. Page
   pictures and TXT imports are not available in this mode. Tested in Chrome; Safari,
   Edge and Firefox are expected to work the same way.

iPhone/iPad note: Safari cannot run a web page saved in the Files app, so on those
devices use the Home Screen app, and also save the PDFs into Files or Apple Books (both
can search inside PDFs offline) as an independent backup.

Why both: a browser's offline storage can be cleared by the user, by "Clear History and
Website Data", or by the device when space runs low. The portable copy and PDFs in
Files/Books do not depend on it.

SEARCH
------
- Finds whole words plus plurals and endings: jar finds jars, pickle finds pickled and
  pickling, can finds canned and canning (but not pecan).
- Put words in "quotes" for an exact phrase, for example "weighted gauge".
- Pages containing all your words rank first; words close together rank higher.
- Each result is one original PDF page, with its page number (and printed page where
  known) and an "Open page N" link that opens the original at that page.
- Guides 1-5: the lines around each match are shown with your words highlighted, plus
  "Show whole page text" and an optional picture of the original page.
- Introduction, Guides 6-7, CDC, USGS, IFRC and FDA: the text extracted from these PDFs can scramble
  tables into neighbouring lines, so the result shows a PICTURE OF THE ORIGINAL PAGE,
  drawn on the device, zoomed to the matching part with your words highlighted in yellow.
  The extracted lines are available underneath, labelled unverified, and are not offered
  for "Copy for Gemma". Opened from local files (mode B), the labelled extracted lines
  are shown instead of the picture.
- Copy for Gemma copies a Guides 1-5 page with its source for pasting into Locally. The
  apps are not integrated.

LIMITATIONS
-----------
- Keyword search, not semantic search or AI.
- Extracted text is not a certified transcription. Always check processing times,
  pressures, altitudes, jar sizes and doses against the original page.
- Imported TXT files are stored in this browser on this device only.

ADDING OR CHANGING DOCUMENTS (DEVELOPERS)
-----------------------------------------
library.json (page text) and originals.json (verified PDF list) are the sources. After
changing either, regenerate the data scripts the app loads, then bump CACHE in sw.js and
OFFLINE_BUILD in offline.js:
    node tools/build-data.cjs
Checks:
    node --test tests/offline.test.cjs
The tests simulate browser APIs and check data integrity (sizes, hashes, page ranges,
generated files up to date). They do not certify Safari/iOS behaviour: repeat the
Airplane Mode test on real devices after every update. After an update, open the app
online and wait for every PDF to show as saved before testing offline.

SOURCES, RIGHTS AND CAUTIONS
----------------------------
USDA: Complete Guide to Home Canning, 2015 revision, Introduction and Guides 1-7,
unchanged from official NCHFP files (source URLs and SHA-256 hashes in originals.json).
USDA/NAL public-domain policy: https://www.nal.usda.gov/exhibits/ipd/canning/about .
No USDA endorsement is implied. These are the 2015 originals, not a newly issued edition.
Verify current authoritative updates before safety-critical use.

CDC: Make Water Safe During an Emergency, Wash Your Hands, Staying Healthy at a Disaster
Shelter, Emergency Wound Care After a Natural Disaster (2017) and Eat Safe Food after a
Power Outage (2020), unchanged originals. CDC material is freely available at its original
source, with no CDC or U.S. Government endorsement of this library. Not a clinical manual
or comprehensive first-aid guide: preserve all source cautions and obtain professional
medical care where indicated.

USGS: Finding Your Way with Map and Compass, unchanged original; compass examples are
historical.

IFRC: Shelter Safety Handbook (added November 10, 2026): unchanged official 2011 English PDF, 62 pages, approximately 1.07 MiB. Copyright IFRC, Geneva, 2011; PDF page 2 permits noncommercial copying with source acknowledgement. Preserve the copyright and illustration credits. This permission is not public domain or a general commercial-use license. Official source: https://www.ifrc.org/document/shelter-safety-handbook . Every nonblank PDF page is searchable as a locator; open the original to read diagrams and complete guidance. Consult current local building codes and qualified professionals for site-specific decisions. Save this original separately on each device and test offline opening after updating online.

CDC/FDA diabetes references (prepared November 11, 2026): four clearly labeled text-only CDC/FDA webpage captures plus the unchanged 20-page FDA-Approved Insulin Products PDF. Images and site navigation are excluded; hyperlinks are listed but their destinations are not bundled. Product-specific insulin instructions must not be generalized. Search is page-location only; consult full documents, current labels and qualified medical advice. These additions are not a personalized diabetes treatment plan.


PDF viewer and page pictures: bundled PDF.js 6.5.438 (Apache-2.0), no external CDN.
Preserve source credits and dates. PDFs are references, not a complete emergency plan.
