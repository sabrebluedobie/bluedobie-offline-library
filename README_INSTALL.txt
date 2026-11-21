BLUEDOBIE OFFLINE LIBRARY
=========================
39 original PDFs (about 120 MiB) with local, page-by-page search, grouped by
topic: first aid and medical care, water and sanitation, food (canning, storage and
raising), wild plants, survival and shelter, preparedness and home safety, and diabetes.
Includes the USDA Complete Guide to Home Canning, Army first-aid, survival and sanitation
manuals, FEMA preparedness and CERT manuals, a rainwater-harvesting manual, a Kentucky
poisonous-plant guide, and CDC, EPA, FDA, CPSC, USGS, IFRC and DHS references.
No subscriptions, cloud API, remote AI, or network needed once set up.

TWO WAYS TO USE IT OFFLINE (USE BOTH WHERE YOU CAN)
---------------------------------------------------
A. Installed app (iPhone, iPad, Android, computers) - full features, including pictures
   of the original pages in search results.
   1. Upload the folder contents to an HTTPS static host (for example GitHub Pages or
      Cloudflare Pages), preserving paths.
   2. Open the HTTPS address in Safari (or Chrome) while online.
   3. Wait until the status says "Offline ready on this device: search ✓ · all 39 PDFs
      saved". The app saves every original PDF automatically (about 120 MiB, so use
      Wi-Fi) and asks the
      browser to protect that storage. Do not rely on it until every PDF shows as saved.
   4. iPhone/iPad: Share > Add to Home Screen > Add. Launch it from the Home Screen once
      while online.
   5. Test: Airplane Mode with Wi-Fi off, fully close and reopen the app, search for
      venison, tourniquet and water hemlock, and open a page picture.
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
- Ranking favours rare words over common ones (so "venison" counts for more than
  "canning"), pages with all your words, and words close together.
- Narrow the search with the menu: a whole topic, or one document.
- Documents with known problems (for example outdated CPR advice) show a caution on every
  result.
- Each result is one original PDF page, with its page number (and printed page where
  known) and an "Open page N" link that opens the original at that page.
- Guides 1-5: the lines around each match are shown with your words highlighted, plus
  "Show whole page text" and an optional picture of the original page.
- All other documents (Introduction, Guides 6-7 and every non-USDA document): the text
  extracted from these PDFs can scramble
  tables into neighbouring lines, so the result shows a PICTURE OF THE ORIGINAL PAGE,
  drawn on the device, zoomed to the matching part with your words highlighted in yellow.
  The extracted lines are available underneath, labelled unverified, and are not offered
  for "Copy for Gemma". Opened from local files (mode B), the labelled extracted lines
  are shown instead of the picture.
- Copy for Gemma copies a Guides 1-5 page with its source for pasting into Locally.

ASK GEMMA (LOCAL AI, OPTIONAL)
------------------------------
The library picks the best pages for your question (the same keyword search), hands only
those pages to Gemma, and lists them under the answer with "Open page" links, cautions and
page pictures, so every answer can be checked. Nothing goes to the internet.

Mac, inside the library (Ask Gemma panel):
  1. In LM Studio: Developer tab > start the server (http://localhost:1234), then Server
     Settings > turn on "Enable CORS". Load a Gemma model (a context length of 8,000+
     tokens is best; Gemma 4 12B at 16,128 tokens gets up to 5 pages per question).
  2. In the library, open "Ask Gemma", press "Check connection", then ask.
     If Chrome asks to let the page reach devices on your local network, choose Allow.
  3. Gemma 4 12B took about 2 minutes per answer on this Mac. Safari may block a web page
     from reaching LM Studio (untested); Chrome works. The portable copy opened from files
     may also be blocked; use the installed app or option below.

Mac, inside LM Studio's chat (library connected as a tool):
  Add this to ~/.lmstudio/mcp.json under "mcpServers" (LM Studio: Program tab > Install >
  Edit mcp.json), using the real path to this folder:
      "offline-library": {
        "command": "/opt/homebrew/bin/node",
        "args": ["/Users/<you>/Documents/Client FIles/bluedobie-offline-library/tools/library-mcp.cjs"]
      }
  Gemma can then search the library (search_library), read neighbouring pages (read_page)
  and list documents (list_documents) while you chat. LM Studio asks before each tool use.
  The server reads this folder's data files, so keep the folder where it is.

iPhone/iPad (Locally): type the question in "Ask Gemma" and press "Copy for Locally". It
copies the question, answering rules and the 3 best pages (shortened to suit phone
models), then open Locally, paste into a new chat and send. Locally has no way for a web
page to send it questions directly.

Answers can still be wrong or incomplete. Always check figures for food safety, medical
care, doses and water treatment on the cited original page.

LIMITATIONS
-----------
- Search is keyword-based (with word endings and rare-word ranking), not semantic.
- Extracted text is not a certified transcription. Always check processing times,
  pressures, altitudes, jar sizes and doses against the original page.
- Imported TXT files are stored in this browser on this device only.

ADDING OR CHANGING DOCUMENTS (DEVELOPERS)
-----------------------------------------
library.json (page text) and originals.json (verified PDF list) are the sources.
To add PDFs, download the official files, write a small JSON list describing each one
(id, title, topic, edition, official source URL, rights wording, review notes and an
optional caution: see the top of tools/add-originals.cjs), then run:
    node tools/add-originals.cjs additions.json
It refuses encrypted PDFs or PDFs with JavaScript, stores each file unchanged under its
SHA-256 hash, extracts each page's text and regenerates the app data. Needs pdfinfo and
pdftotext (Homebrew: brew install poppler). After changing library.json or originals.json
by hand, regenerate with:
    node tools/build-data.cjs
Then bump CACHE in sw.js and OFFLINE_BUILD in offline.js.
Checks:
    node --test tests/offline.test.cjs
Ask Gemma code: ask.js (question to pages and prompts), gemma.js (panel), and
tools/library-mcp.cjs (LM Studio tool server); all three share search.js.
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

Added November 21, 2026 (each downloaded from the official URL in originals.json, stored
unchanged, SHA-256 recorded; cautions are shown with every search result):
- U.S. Army ATP 4-02.11 Casualty Response and First Aid (2026), ATP 3-50.21 Survival
  (2018), ATP 4-25.12 Unit Field Sanitation Teams (2014, Change 2 2025) and TC 4-02.3
  Field Hygiene and Sanitation (2015): "Approved for public release; distribution is
  unlimited." Military manuals: skip medic-only drugs and procedures; do not rely on the
  survival manual's universal edibility test or folk remedies.
- FEMA Are You Ready? (2020) and CERT Basic Training Participant Manual (2019); U.S.
  Public Health Service, The Ship's Medicine Chest (2003; its CPR and tourniquet advice is
  outdated); EPA Emergency Disinfection of Drinking Water (2017; differs slightly from
  CDC) and Burn Wise Tips; CPSC Generators and Carbon Monoxide (2022); FDA Food Facts
  (2019); USDA NRCS Springs and Wells (2021); DHS Auxiliary Communications Field
  Operations Guide (2016; FRS/GMRS rules changed in 2017); Peace Corps Practical Poultry
  Raising (2015). U.S. Government works; no agency endorsement of this library.
- Texas Water Development Board, Texas Manual on Rainwater Harvesting (2005): TWDB
  "freely grants permission to copy and distribute its materials" with acknowledgment.
  Protect systems from freezing in Kentucky; treat rainwater before drinking.
- University of Kentucky ID-2, Plants of Kentucky Potentially Poisonous to Livestock
  (2022) and Mississippi State P4173, Forgotten Foods (2026): copying allowed for
  educational or nonprofit purposes with credit; kept for personal use with all credits.

- CDC Extreme Cold: A Prevention Guide (2005, CDC Stacks: Public Domain) and CDC/NIOSH
  Fast Facts: Protecting Yourself from Poisonous Plants (2010). CDC blocks automated
  downloads, so both were saved in a browser. The Extreme Cold file is CDC's original;
  the NIOSH copy was re-saved by macOS, so it is not byte-identical to CDC's file (its
  pages, text and photos were checked complete).

PDF viewer and page pictures: bundled PDF.js 6.5.438 (Apache-2.0), no external CDN.
Preserve source credits and dates. PDFs are references, not a complete emergency plan.
