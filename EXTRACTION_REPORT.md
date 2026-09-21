# Zero Touch Printing Portal — Extraction Report

Read-only audit. No source files were modified to produce this report.

---

## 1. Overview & Tech Stack

**What it is:** A single-page static website (no backend code in this repo) that lets students remotely submit print jobs. Users upload PDF/image files, choose a hall/printer location, pay via bKash/Nagad mobile payment, enter a transaction ID to verify payment, and the files are uploaded to a remote print server. Repo is deployed as a GitHub Pages site (`zerotouch313.github.io`, confirmed via `git remote`).

**Type:** Website / web front-end only (no mobile app code here, though it links out to a companion Android app on Google Play).

**Language(s) & stack:**
- Plain HTML5, CSS3, vanilla JavaScript (ES2017+ features: `async/await`, `fetch`, template literals). No build step, no bundler, no framework (no React/Vue/Angular).
- `package.json` ([package.json](package.json)) is a placeholder — `name: zero_web`, `version: 1.0.0`, no `dependencies` or `devDependencies` listed, and the `test` script just errors out. npm/Node is not actually used to run or build this project; it appears to exist only for editor tooling.
- Third-party JS loaded via CDN `<script>` tags (no package manager):
  - `@phosphor-icons/web` (icon font/JS, unpinned version) — via `unpkg.com`
  - `pdf.js` v2.16.105 (`pdfjsLib`) — via `cdnjs.cloudflare.com`, used for PDF page counting and rendering
  - `paho-mqtt` v1.0.1 (`mqttws31.min.js`) — via `cdnjs.cloudflare.com`, loaded but **not referenced anywhere in app.js** (dead/unused include — see §11)

**Entry point(s) and startup sequence:**
1. Browser loads [index.html](index.html), which loads `styles.css`, then the Phosphor icon script, then at the bottom of `<body>`: `pdf.js`, `paho-mqtt`, `app.js`, and finally `zt-promo.js`.
2. `app.js` executes top-to-bottom immediately on parse (no `DOMContentLoaded` wrapper):
   - Sets constants for the backend server URL and hardcoded "guest" login credentials.
   - Configures `pdfjsLib`'s worker script URL (with a fallback that waits for `window.load` if `pdfjsLib` isn't yet defined).
   - Grabs references to ~20 DOM elements by ID.
   - Defines the hall → payment-number/WhatsApp-number lookup table (`LOCATION_CONTACT_MAP`).
   - Immediately calls `authenticateWebClient()` — a silent background login to the print server to obtain a JWT used for later requests.
   - Registers `window.addEventListener('load', showAppPromoModal)` (though `zt-promo.js`, loaded after, actually owns the promo modal shown to the user — see §11 for this duplication).
   - Dynamically creates and inserts a "status banner" `<div>` into the page.
   - Wires up the printer-location `<select>` to trigger a status check + payment-number refresh + UI refresh on change, and starts polling printer status every 5 seconds via `setInterval`.
   - Wires up file input, form submit, "collect later" checkbox, clear button, and the payment-verification button.
3. `zt-promo.js` runs as an IIFE: it defensively re-injects the promo modal markup into the DOM if not already present (it's also statically present in `index.html`), then after a 1-second timer shows a "Download our Android app" promotional modal.

---

## 2. Architecture & Folder Structure

Flat, no framework-driven folder convention. Top-level layout:

| Path | Purpose |
|---|---|
| [index.html](index.html) | The single page/entry point: markup for the upload form, payment modal, loading overlay, toast, WhatsApp contact section, and promo modal. |
| [app.js](app.js) | All core application logic: auth, pricing, file handling, PDF page counting, color analysis, payment verification, upload. |
| [zt-promo.js](zt-promo.js) | Standalone, self-contained script for the "download our app" promo modal (duplicates markup already in `index.html`). |
| [styles.css](styles.css) | All styling: CSS custom properties/theme, promo modal styles, main card/form styles, responsive rules, animations. |
| [assets/](assets/) | Static images/icons: `BKash-Icon-Logo.wine.svg`, `Nagad-Vertical-Logo.wine.svg`, `maintenance.png` (unused — see §11), `web_fav.png` (site favicon/logo). |
| [google2da3c92752c951db.html](google2da3c92752c951db.html) | Google Search Console site-ownership verification file (single line of text, no logic). |
| [package.json](package.json) | Placeholder Node manifest; not used for any real build/dependency management. |
| [README.md](README.md) | Project description, feature list, "how it works," and pricing tiers (some content is stale — see §11). |
| `.idea/` | JetBrains WebStorm/IDE project settings — not part of the app. |

**State management:** No framework/state library. All app state lives in plain top-level `let`/`const` JS variables in `app.js`:
- `selectedFiles` — array of objects (one per uploaded file) holding the `File`, copies, page range, print mode, page count, and detected color percentage.
- `currentTotalCost` — running total shown to the user and sent to the server.
- `currentJWT` — the bearer token from silent login.
State changes flow one way: a DOM event handler mutates one of these variables/arrays, then calls `updateUI()`, which fully re-renders the file list and cost summary from scratch (a manual, non-reactive re-render pattern — closest analog is "immediate-mode UI").

**Code organization:** Single-file procedural script, not MVC/component-based. Logically it groups into: config/constants → DOM references → hall/contact data → auth → status polling → file-list rendering → validation → payment flow → color/coverage pricing engine.

---

## 3. Complete Screen/Page/Route Inventory

There is only **one HTML page/route** — this is not a multi-page or client-side-routed app.

- **`index.html`** (the only page): Single-page app containing multiple UI *states* toggled by CSS classes/`display`, not separate routes:
  - **Main form view** — always visible: select printer/hall location, optionally check "Collect Later" (reveals name + student ID fields), upload files (drag-free, click-to-browse `<input type="file">`), see a per-file settings list (page range, copies, B&W/Color mode, live color-coverage %, per-page price), and a running total cost.
  - **Payment verification overlay** (`#paymentSection`, hidden by default, shown via `.show` class on form submit) — displays bKash/Nagad numbers for the selected hall, the exact amount to pay, a transaction-ID input, and Verify/Cancel buttons.
  - **Loading overlay** (`#loading`) — shown while the file upload request to the server is in flight.
  - **Toast** (`#message`) — bottom/floating notification div for success/error messages.
  - **WhatsApp contact section** — static section at the bottom, populated dynamically with support numbers relevant to the selected hall.
  - **App promo modal** (`#ztPromoModal`) — a dismissable overlay advertising the companion Android app, auto-shown ~1 second after load.

No navigation/router exists — everything is one static document; "screens" are really modal/overlay states of the same DOM.

---

## 4. Feature-by-Feature Functionality Breakdown

**Printer/Hall Selection**
- Dropdown of 9 named halls (`index.html` `<select id="printerLocation">`). Selecting a hall drives payment numbers, WhatsApp numbers, live printer-online status, and per-hall pricing limits. — `index.html`, `app.js` (`LOCATION_CONTACT_MAP`, `updatePaymentNumbers`, `checkPrinterStatus`, `getPricingLimits`)

**Live Printer Status Monitoring**
- Polls the backend every 5 seconds for the selected hall's printer status; if offline, shows a Bengali warning banner and disables the "Proceed to Payment" button. — `app.js` (`checkPrinterStatus`, `showStatusError`, `hideStatusError`, `setInterval`)

**File Upload & Management**
- Multi-file picker restricted by `accept` to `.pdf,.jpg,.jpeg,.png`; `.doc`/`.docx` are explicitly rejected client-side with a Bengali error toast (still allowed by the OS file picker, then filtered out in JS). Each accepted file becomes a row with remove ("x") button. — `index.html` (`#fileInput`, `.upload-area`), `app.js` (`fileInput` change handler)

**Per-File Print Settings**
- For each file: page-range text input (e.g. "1-5"), number-of-copies input, and a B&W/Color mode dropdown. PDF page counts are auto-detected; images are treated as 1 page. — `app.js` (`updateUI`, `window.updateFileSetting`, `window.updatePrintMode`)

**PDF Page Counting**
- Uses `pdf.js` to open each PDF in-browser and read `pdf.numPages`, shown as a spinner until resolved. — `app.js` (`estimatePageCount`)

**Automatic Color-Coverage Detection & Dynamic Pricing**
- For every uploaded image and up to the first 3 pages of every PDF, the file is rendered to an off-screen `<canvas>` and sampled (every 4th pixel) to compute a "% of non-white ink pixels" coverage score. This score feeds a per-page price via a 5-tier step function between a per-hall lower/upper price bound. — `app.js` (`analyzeColorCoverage`, `analyzeImageColor`, `analyzePDFColor`, `calculateCoveragePercentage`, `getPricingLimits`, `getPriceFromCoverage`)
- Pricing tiers per README (may not exactly match current code constants, see §11): B&W 2 tk/page, Light color 3 tk, Medium 4 tk, Heavy 5 tk, Full color 6 tk.

**Cost Calculation**
- Recomputes total cost live on every UI update: `pages_in_range × copies × price_per_page`, summed across files, plus a flat +1 tk surcharge if "Collect Later" is checked and files exist. — `app.js` (`updateUI`)

**"Collect Later" Pickup Option**
- Checkbox that reveals required Name + Student ID fields, for users who want to pick up prints later rather than waiting. Adds a small surcharge (see above) and is sent to the server as flags/fields. — `index.html` (`#collectLater`, `#userInfoSection`), `app.js` (`toggleUserInfo`)

**Location Validation**
- Blocks form submission with a shaking/glowing error bubble if no hall is selected. — `app.js` (`showLocationError`)

**Payment Flow (bKash/Nagad)**
- On submit, shows a modal with the correct bKash/Nagad numbers for the chosen hall and the exact amount due; warns (and hides the Nagad option) if the total is under 10 tk, since Nagad "Send Money" has a 10 tk minimum. — `index.html` (`#paymentSection`), `app.js` (submit handler)

**Payment Verification**
- User enters the mobile-payment transaction ID; app calls the backend to verify it matches the expected amount before allowing upload. Handles "underpayment" errors specially via a blocking `alert()`. — `app.js` (`verifyBtn.onclick`)

**File Upload to Print Server**
- After verified payment, bundles all files + per-file settings (JSON) + trx ID + total cost + collect-later info + user name/ID into a `multipart/form-data` POST, authenticated with the silently-obtained JWT. — `app.js` (`verifyBtn.onclick`, `SERVER_UPLOAD_URL`)

**Silent/Guest Authentication**
- On page load, logs into the backend using a hardcoded guest account to get a JWT, transparently to the user (see §6, §10 for security implications). — `app.js` (`authenticateWebClient`)

**Session Refresh on 401**
- If the upload request comes back `401 Unauthorized`, the app silently re-authenticates and asks the user to click "Verify & Proceed" again. — `app.js` (`verifyBtn.onclick` catch branch)

**Copy-to-Clipboard for Payment Numbers**
- Clicking the copy icon next to a bKash/Nagad number copies it via `navigator.clipboard` and shows a confirmation toast. — `app.js` (`updatePaymentNumbers`)

**Dynamic WhatsApp Support Links**
- Renders `wa.me` deep links for the WhatsApp numbers relevant to the selected hall. — `app.js` (`updateWhatsAppContacts`)

**Toast Notifications**
- Generic success/error message system with auto-dismiss timers (default 4s success / 8s error, or a custom override). — `app.js` (`showMessage`)

**App Download Promo Modal**
- Auto-opens ~1s after page load, advertises the Android companion app with a Google Play link, dismissible via close button, backdrop click, or Escape key. Implemented twice — once statically in `index.html`+`app.js`, and again dynamically injected by `zt-promo.js` (see §11, likely leftover duplication from iterative development). — `index.html`, `app.js`, `zt-promo.js`

**Maintenance Mode (declared but not wired up)**
- A `MAINTENANCE_MODE` boolean constant exists in `app.js` and is documented in the README as a way to show a maintenance overlay, but no such overlay markup exists in `index.html`/`styles.css` and the constant is never read anywhere in the code. Currently non-functional. — see §11.

---

## 5. Every Backend API Call

**Base URL:** `https://hamper-strategy-rockstar.ngrok-free.dev` — an **ngrok free-tier tunnel URL**, hardcoded as `CENTRAL_SERVER` in [app.js:6](app.js#L6). This is not configurable via any env var/config file, and per a comment in the code ("⚠️ Ngrok রিস্টার্ট দিলে এই লিংকটি আপডেট করতে ভুলবেন না" — "don't forget to update this link when ngrok restarts"), it is a temporary/unstable address that must be manually updated whenever the developer's local tunnel restarts. There is no separate backend source in this repository — the server itself is out of scope/not present here.

| # | Method | Path | Triggered by | Request data | Response fields used |
|---|---|---|---|---|---|
| 1 | `POST` | `/api/login` | Page load (silent) — `authenticateWebClient()` | JSON: `{ email, password }` (hardcoded guest creds) | `access_token` (stored as `currentJWT`) |
| 2 | `GET` | `/status/{locationId}?t={timestamp}` | Every 5s while a hall is selected, and on hall change — `checkPrinterStatus()` | none (locationId in path, cache-busting `t` query param) | `printer_online` (boolean) |
| 3 | `POST` | `/verify-payment` | User clicks "Verify & Proceed" — `verifyBtn.onclick` | JSON: `{ trx_id, amount }` | `error_type` ("underpayment" triggers special alert), `message`, `warning` |
| 4 | `POST` | `/api/print/upload` | After successful payment verification | `multipart/form-data`: `files` (repeated), `fileSettings` (JSON string array of `{fileName, range, copies, print_mode, cost, pages}`), `location`, `trx_id`, `totalCost`, `collectLater`, `payment_method` (always `'instant'`), `cover_name`, `cover_id` | HTTP status only (`200`→success toast + form reset; `401`→re-auth; other→`error` field from JSON body shown in toast) |

**Grouping:**
- **Auth:** call #1.
- **Status/monitoring:** call #2.
- **Payments:** call #3.
- **Uploads:** call #4.
- No admin-specific endpoints are called from this codebase.

**Common headers:** All requests send `ngrok-skip-browser-warning: 69420` (a workaround to bypass ngrok's browser interstitial page). Calls #1 and #4 also send `X-App-Version: Web-1.0.0`. Call #4 sends `Authorization: Bearer {currentJWT}`.

---

## 6. Authentication & Session Handling

- **No real user login exists.** Every visitor to the site is silently logged in as a single shared hardcoded "guest" account (`WEB_GUEST_EMAIL` / `WEB_GUEST_PASS` in [app.js:11-12](app.js#L11-L12)) as soon as the page loads, via `POST /api/login`. There is no signup, no per-user identity, and no login UI at all.
- **Token storage:** The resulting JWT (`access_token`) is kept only in an **in-memory JS variable** (`currentJWT`). It is never written to `localStorage`, `sessionStorage`, or cookies, so it does not survive a page reload — a fresh silent login happens every time the page loads.
- **Attaching the token:** Sent as `Authorization: Bearer {currentJWT}` only on the file-upload request (`POST /api/print/upload`). The login and status/verify-payment endpoints do not require it.
- **Token expiry / 401 handling:** If the upload request returns `401`, the app calls `authenticateWebClient()` again to silently fetch a new token, then shows a toast asking the user to retry the "Verify & Proceed" click manually — there's no automatic retry of the upload itself.
- **Role-based access:** None. There are no admin-only screens, no role checks, and no user-specific data scoping in this front-end — the guest account appears to be a shared, low-privilege service account whose only purpose is to authorize the upload endpoint.

---

## 7. Third-Party Integrations & SDKs

- **Payment (manual/offline reconciliation, not an SDK):** bKash and Nagad are Bangladeshi mobile financial services. This app does **not** integrate their APIs directly — it just displays the correct receiving phone number per hall and asks the user to manually "Send Money" via their own bKash/Nagad app, then verifies the resulting transaction ID against the backend (`/verify-payment`). Configured in `app.js` (`LOCATION_CONTACT_MAP`).
- **PDF rendering/parsing:** `pdf.js` v2.16.105, loaded from `cdnjs.cloudflare.com`, used purely client-side for page counting and rendering pages to canvas for color analysis. No server round-trip.
- **Icons:** Phosphor Icons web font/JS bundle, loaded from `unpkg.com`, unpinned version (no version number in the URL — see §10 risk).
- **MQTT:** `paho-mqtt` v1.0.1 script is loaded in `index.html` ([index.html:204](index.html#L204)) but is **never used** anywhere in `app.js` or elsewhere — dead include, no broker host/topics configured (see §11).
- **WhatsApp:** Not an SDK — just `wa.me` deep links generated client-side to open WhatsApp chats with hardcoded support numbers.
- **Google Play:** A static outbound link to the companion Android app's Play Store listing (`com.zerotouch.threeonethree`), used by both promo modal implementations.
- **Google Search Console:** Site ownership verified via the static `google2da3c92752c951db.html` file at the repo root — no JS/tracking code, just proves domain ownership for Search Console.
- No analytics, ads, crash reporting (e.g. Sentry/Crashlytics), or maps SDKs are present anywhere in this codebase.
- No direct hardware/Bluetooth/USB/MQTT-broker connections are actually made from this code, despite the MQTT library being loaded.

---

## 8. Local Data & Storage

- **No persistent local storage is used** — no `localStorage`, `sessionStorage`, `IndexedDB`, or cookies are read or written anywhere in `app.js` or `zt-promo.js`.
- All application state (selected files, JWT, cost totals, form field values) lives only in memory (JS variables and the live DOM) for the duration of the page session, and is lost on refresh.
- **No offline behavior** — every meaningful action (status check, payment verification, upload) requires a live connection to the backend; there is no offline queueing, caching, or local-first logic. If the backend/ngrok tunnel is unreachable, the user sees connection-error toasts and the app is effectively unusable for its core purpose.

---

## 9. Permissions & Platform Capabilities (Browser APIs)

This is a web app, so "permissions" map to browser APIs used (no native OS permission prompts like camera/location are triggered):

- **Clipboard API** (`navigator.clipboard.writeText`) — used to copy bKash/Nagad numbers to the clipboard when the user clicks the copy icon. Modern browsers may show a one-time permission indicator for this, but no explicit permission prompt is coded.
- **File System access** (standard `<input type="file">`, not the File System Access API) — used for selecting files to upload; this is a standard, low-privilege browser file picker requiring no special permission.
- **Canvas 2D API** — used internally (no user-facing permission) to render images/PDF pages off-screen for color analysis.
- No camera, microphone, geolocation, push-notification, or storage-quota permissions are requested anywhere in the code.

---

## 10. Configuration, Environment & Hardcoded Values

There is no `.env` file, no config file, and no build-time environment variable injection anywhere in this repo — every value is a literal in the source.

**Hardcoded URLs/hosts:**
- `CENTRAL_SERVER = 'https://hamper-strategy-rockstar.ngrok-free.dev'` — [app.js:6](app.js#L6) (derived: `SERVER_UPLOAD_URL` at [app.js:7](app.js#L7), `VERIFY_PAYMENT_URL` at [app.js:8](app.js#L8))
- CDN script URLs: `unpkg.com/@phosphor-icons/web` — [index.html:10](index.html#L10); `cdnjs.cloudflare.com/.../pdf.js/2.16.105/pdf.min.js` — [index.html:203](index.html#L203); `cdnjs.cloudflare.com/.../pdf.js/2.16.105/pdf.worker.min.js` — [app.js:17](app.js#L17) and [app.js:21](app.js#L21); `cdnjs.cloudflare.com/.../paho-mqtt/1.0.1/mqttws31.min.js` — [index.html:204](index.html#L204)

**Hardcoded phone numbers (payment + WhatsApp support), all in `LOCATION_CONTACT_MAP`, [app.js:77-114](app.js#L77-L114):**
- `01716897644`, `01568550778`, `01956018657` — used repeatedly across different halls for bKash/Nagad payment and WhatsApp support.
- Also duplicated as plain contact numbers in [README.md:84-86](README.md#L84-L86).

**Hardcoded pricing constants**, [app.js:694-701](app.js#L694-L701) (`getPricingLimits`): default B&W 2.0–4.0 tk, default Color 3.0–5.0 tk; special-cased override for `shaheed_hadi_hall` (B&W 1.75–4, Color 2.25–5). A commented-out example line shows the pattern for adding more hall-specific overrides.

**Hardcoded app metadata:**
- Android package/app ID referenced only via the Play Store link: `com.zerotouch.threeonethree` — [index.html:260](index.html#L260) and [zt-promo.js:68](zt-promo.js#L68).
- `X-App-Version: Web-1.0.0` header value — [app.js:127](app.js#L127), [app.js:583](app.js#L583).
- Nagad minimum-payment threshold hardcoded as `10` (tk) — [app.js:506](app.js#L506).
- MQTT client library included but no broker host/port/topic is configured anywhere (dead include).

**Environment variables / config keys referenced:** None. This app reads no `process.env`, no `import.meta.env`, and has no `.env`/`.env.example` file.

**⚠️ SECRET FOUND at [app.js:11-12](app.js#L11-L12), key names: `WEB_GUEST_EMAIL`, `WEB_GUEST_PASS`.** A real-looking email address and an 8-character password are hardcoded in client-visible JavaScript that ships to every visitor's browser and is publicly readable on GitHub Pages / in this repo. Since anyone can view-source this account's credentials, this account should be treated as fully compromised and rotated, and login for the upload flow should ideally not depend on a shared client-side secret at all.

---

## 11. Known Issues Already in the Code

- **Documented "maintenance mode" is non-functional.** `README.md` describes a full maintenance-screen feature (`MAINTENANCE_MODE` flag hiding the app and showing a wrench-icon overlay), and `MAINTENANCE_MODE = false` does exist at [app.js:14](app.js#L14), but it is **never read/checked anywhere else in the code**, and no maintenance overlay markup exists in `index.html`, nor overlay styles in `styles.css` beyond a possibly-orphaned `assets/maintenance.png` image. Toggling this constant currently does nothing.
- **Unused MQTT dependency.** `paho-mqtt` is loaded in `index.html` ([index.html:204](index.html#L204)) but never referenced in any JS file — dead weight / unused third-party script (extra network request, no functional benefit currently).
- **Duplicated promo modal implementation.** The "Download our app" modal markup and open/close logic exists twice: once statically in `index.html` (wired up partly from `app.js`'s `showAppPromoModal`/`hideAppPromoModal`, plus a `window.addEventListener('load', showAppPromoModal)` call at [app.js:144](app.js#L144)), and again fully self-contained (re-injecting its own copy of the same markup, with its own open/close logic and a 1-second timer) in `zt-promo.js`. In practice `zt-promo.js` runs last and finds the modal already in the DOM, but both scripts attach competing show/hide logic and event listeners to the same elements — this looks like leftover code from an earlier iteration (confirmed by commit history: "Implement foolproof standalone promo modal", "Fix promo modal trigger, z-index, and add debug logs") that was never cleaned up after `zt-promo.js` was introduced.
- **Inline HTML comment marking a past bug fix**, [index.html:84](index.html#L84): `<!-- 🐛 FIX: Removed the 'required' attribute from the file input below -->` — historical note, not an active TODO.
- **Silent failure / broad catch blocks:** Several `catch` blocks swallow errors with only a `console.error` and no user feedback, e.g. `checkPrinterStatus()` ([app.js:231-233](app.js#L231-L233)) — if the status endpoint throws (vs. returning non-ok), the user gets no indication the printer-status check failed, unlike the network-error path in the upload flow which does show a toast.
- **Client-side-only file type validation:** `.doc`/`.docx` rejection and the "Max 10MB"/"A4 Size Only" labels in the upload UI are enforced only in the browser; nothing in this repo re-validates file type/size before the multipart upload is sent (server-side enforcement, if any, lives outside this repo).
- **README pricing tiers likely stale.** README.md lists a flat 5-tier tk/page table (2/3/4/5/6 tk), but the actual code ([app.js:694-726](app.js#L694-L726)) computes prices from a per-hall configurable `lower`–`upper` range split into 5 steps, with at least one hall already overridden to different numbers (`shaheed_hadi_hall`). The README does not reflect the per-hall override mechanism or its current values.
- **No `TODO`/`FIXME`/`HACK` comment markers** were found via text search in `app.js`, `zt-promo.js`, or `styles.css` — the only forward-looking comment is the commented-out example line inside `getPricingLimits` ([app.js:696](app.js#L696)) showing how to add another hall-specific price override.

---

## 12. Build & Deployment Metadata

- **Package name:** `zero_web` (from `package.json`), version `1.0.0`. No bundle/app ID in this repo (the Android package ID `com.zerotouch.threeonethree` belongs to the separate companion app, not this web repo).
- **Build tooling:** None. This is unbundled static HTML/CSS/JS — there is no webpack/vite/parcel config, no TypeScript, no CSS preprocessor, no linter/formatter config found.
- **Target platform:** Any modern web browser (desktop or mobile). No responsive-framework dependency, but `styles.css` includes explicit mobile breakpoints/responsiveness rules.
- **Signing config:** Not applicable — no native app build artifacts in this repo.
- **CI/CD config:** None found — no `.github/workflows/`, no `netlify.toml`, no `vercel.json`, no `Dockerfile`.
- **Hosting/deploy target:** Inferred from the git remote (`https://github.com/zerotouch313/zerotouch313.github.io.git`) that this is deployed via **GitHub Pages**, using the `<username>.github.io` convention, with a `google-site-verification` file present at the repo root confirming Search Console setup for that domain. Deployment is presumably just pushing to the repo's default branch (`main`) — no explicit Pages workflow file is present, so it likely relies on GitHub's automatic Pages build from the repository root.
- **IDE metadata only:** `.idea/` folder (JetBrains WebStorm project files) — not part of the shipped app.

---

## 13. Plain-Language Summary

This project is the website half of "Zero Touch," a remote printing service aimed at university students living in dormitory halls. A student opens the single web page, picks which hall's printer they want to use, and uploads PDF or image files they want printed. The page automatically figures out how many pages each PDF has and even scans the pixels of every page or image to estimate how much colored ink it would use, so it can quote a fair price — plain black-and-white pages cost less than heavily colored ones, and the exact price brackets can be tuned separately for each hall. The page also checks every five seconds whether the chosen hall's printer is currently online, and blocks students from proceeding if it's offline. Once the student is happy with the files and the total cost, they click "Proceed to Payment," which shows them the correct bKash or Nagad mobile-money number to send that exact amount to (numbers differ by hall). After manually sending the payment through their own banking app, the student types in the transaction ID from that payment, and the site asks a remote server to confirm the payment really went through and matches the amount owed. If it matches, the files are uploaded to that same remote server, which is presumably connected to the actual physical printer. There's also an optional "collect later" mode for students who can't wait around, which asks for their name and student ID so the printed pages can be set aside for pickup, for a small extra fee. Behind the scenes, every visitor to the page is automatically and invisibly logged into the backend using one shared "guest" account whose email and password are, notably, written directly into the public website code — anyone who looks at the page's source could see them, which is a real security weakness worth fixing. The backend itself lives outside this repository, reachable currently through a temporary "ngrok" tunnel URL that the developer has to manually update by hand whenever their local tunnel restarts, meaning the whole live service depends on one hardcoded, short-lived address. The site also nudges users to install a full Android app version of the same service via a promotional pop-up, though that pop-up's code exists in two overlapping, redundant copies that were apparently never cleaned up. Overall, this is a lean, no-framework, single HTML/CSS/JS-file website with no build process, hosted for free on GitHub Pages, that trades some rough edges (hardcoded secrets, dead code, an unfinished "maintenance mode" feature) for being extremely simple to read, edit, and deploy by hand.
