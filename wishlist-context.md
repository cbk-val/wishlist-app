# Wishlist App: Developer Context and Handoff

This document explains what the current prototype does, why it works the way it does, and what the backend and database need to support. It is written so a developer, or an AI assistant helping them, can review `wishlist.html` and plan the backend without the original conversation.

The prototype is a single HTML file with inline CSS and JavaScript. It has no backend. It is mobile-first and was designed and tested at a 390px-wide phone viewport. All statements below about behavior are based on that prototype.

---

## 1. Product summary

A personal gift wishlist. A user (the "owner") creates a wishlist with **categories** (tabs such as "Birthday", "Home", "Books") and adds **gifts** to them. Each gift has a name and, optionally, a photo, price, store link and note for the gift giver. The owner can mark gifts as got, reorder gifts within a category, and create a **view-only link** that friends and family can open to see the list.

Currency is Philippine pesos (₱). The app was built for a Philippines-based user.

Target users:
- **Owner:** creates and edits the list.
- **Viewer:** anyone with the view-only link. Viewers do not have accounts and cannot edit anything.

---

## 2. Current status of the prototype

- All data is stored **only in the browser** (`localStorage`). Nothing is sent to a server.
- The page is published as a **Claude artifact** at `https://claude.ai/artifact/HWHiHzpmAnVa5BS4XBpyvi`. The artifact runtime lets the page republish a copy of itself with an embedded snapshot of the list. That is how the view-only link works today. It is a stopgap, not the intended architecture.
- A copy of the page was also exported to GitHub Pages as a static site. On GitHub Pages, the sharing feature does not work, because it depends on the Claude runtime. The "Copy link" button in that version still copies the Claude artifact URL, which is a known bug for that deployment.
- The backend is undecided. The developer is considering **Google Sheets as the database**. See section 10.

---

## 3. Screens and flows

### 3.1 Main screen (owner)
- **Header:** editable wishlist title (contenteditable). It can't be blank. If the owner clears it, it reverts to the last valid title and shows a red message. Default title: "My wishlist".
- **Share list** button, to the right of the title. Opens the share window (section 6).
- **Category row:** a horizontally scrolling row of category tabs, with a pinned **Add category** button at the right. The selected tab is scrolled into view when it changes. The selected tab has a pencil icon that opens the edit pop-up for that category. Long-pressing any tab (about 500ms) also opens the edit pop-up.
- **Add category** shows its full label when there are fewer than three categories. With three or more, it shrinks to a round "+" button (44px). The label is still set as the accessible name and tooltip.
- **Reorder items** button sits above the gift cards. It is disabled (greyed out, not hidden) when the category has fewer than two gifts. Reorder mode is described in 3.4.
- **Gift cards**, in order, numbered 1 to n outside the card. Each card shows: photo (or a gift icon placeholder), name (a link if a store link exists), price, and a note clamped to two lines with "Show more" / "Show less" when the note is longer. Each card has a three-dot menu at the top right.
- **Floating "+ Add a gift" button** at the bottom right. This is the only add-gift entry point. While the current category is empty, it pulses (see 3.5).

### 3.2 Add a gift (two steps)
- **Step 1: How do you want to add it?**
  - A product link field plus "Continue with link".
  - Or "Add manually".
- **Step 2: Check the details.** Fields in order:
  - Photo (optional, add or remove)
  - Category (dropdown, defaults to the current category; moving the gift to another category is supported)
  - Item name (required; max 80 characters)
  - Price (₱; optional; numeric; whole-number placeholder "0"; decimals allowed but not required)
  - Store link (optional; must be a valid http or https URL)
  - Notes for the gift giver (optional; max 200 characters)
  - "Back" (only when adding, not editing), and "Save gift".
  - "Delete gift" appears only when editing, as a red outline button. It opens a confirmation pop-up.
- **Link import behavior:** the prototype cannot fetch the product page, because a published page cannot call other websites (browser security). It only derives a name from the URL text, such as turning `sony-wh-1000xm5-wireless-headphones` into "Sony WH-1000XM5 Wireless Headphones". It removes tracking parameters and marketplace IDs (Shopee `-i.123.456`, Lazada `-i123-s456`, and similar). It cannot read the price, photo or description. A backend fetch is the intended long-term solution (section 9).

### 3.3 Categories
- Name required, max 30 characters.
- Names must be unique (case-insensitive).
- Icon: any emoji, chosen with the phone's emoji keyboard or from a suggested row of 15 emojis.
- The first category, "Default", is created on first use and **cannot be deleted**. It can be renamed and re-iconed.
- Deleting another category deletes **all gifts in it**. A confirmation pop-up states how many gifts will be deleted.
- Categories are created by "Add category" and edited by the pencil or a long-press.

### 3.4 Reorder mode
- Entered from the "Reorder items" button above the cards.
- A sticky bar at the top says "Drag the handles to reorder" with a Done button.
- Each card shows a drag handle (≡) at the right instead of the three-dot menu. Card height does not change.
- The order is stored as the array order of the items within the category. It persists across reloads.

### 3.5 Empty state and the add button
- An empty category shows an illustration and "Tap Add a gift below to add the first thing you'd love to receive."
- The bottom-right "Add a gift" button pulses while the **current category is empty**. The pulse plays three times (about 4 seconds), rests, and repeats every 10 seconds. It stops permanently for that page session once the owner taps the button. It is not saved across reloads.
- Users with "reduce motion" enabled see a steady outline instead of the pulse.

### 3.6 Card three-dot menu (owner)
- "Mark as got" / "Mark as not got" (toggles the got state)
- "Edit gift" (opens step 2 with existing values)
- Reorder is **not** in this menu. It lives above the cards (see 3.1).

### 3.7 Got gifts
- A got gift stays in its category, shows "Got it" as a label, and is struck through.
- Got gifts are **always excluded from the shared view** (section 6).

---

## 4. Data model (current prototype)

The prototype stores one JSON object under the `localStorage` key **`wishlist-v3`**. Earlier versions used keys `wishlist-v1` and `wishlist-v2`. On load, the app checks v3, then v2, then v1, and migrates old shapes.

```json
{
  "title": "My wishlist",
  "categories": [
    { "id": "main", "name": "Default", "icon": "🎁" },
    { "id": "l1794275161210", "name": "Books", "icon": "📚" }
  ],
  "items": [
    {
      "id": 1794275161210,
      "categoryId": "l1794275161210",
      "name": "A book",
      "price": 0,
      "link": "https://example.com/book",
      "note": "Hardcover preferred",
      "img": "data:image/jpeg;base64,...",
      "got": false
    }
  ],
  "cur": "l1794275161210",
  "sharing": true,
  "pubSig": "...",
  "pubAt": 1794388773787
}
```

### Field notes

| Field | Type | Rules |
|---|---|---|
| `title` | string | Required, non-blank. Default "My wishlist". |
| `categories[].id` | string | Default category uses `"main"`. Other IDs are generated as `"l" + timestamp`. |
| `categories[].name` | string | Required, max 30, unique case-insensitive. |
| `categories[].icon` | string | One emoji. Default 🎁. Any emoji is accepted. |
| `items[].id` | number | Generated from `Date.now()` in the prototype. Should be a real primary key in the backend. |
| `items[].categoryId` | string | Must reference a category. Deleting a category deletes its items. |
| `items[].name` | string | Required, max 80. |
| `items[].price` | number | Whole pesos or decimal allowed. Must be ≥ 0. Stored as 0 when empty. |
| `items[].link` | string | Optional. Must be http or https. No length limit in the UI. |
| `items[].note` | string | Optional, max 200. |
| `items[].img` | string | Optional. A **base64 JPEG**, resized so its longest side is 360px, quality 0.8. Stored inline. |
| `items[].got` | boolean | Owner-only state. Hidden from viewers. |
| `items` order | array order | Defines the display order within each category. |
| `cur` | string | Last selected category (UI state). |
| `sharing` | boolean | Whether the view-only link is active. |
| `pubSig`, `pubAt` | string, number | Prototype-only bookkeeping for republishing. Drop in the backend. |

Storage limit: `localStorage` is about 5 MB per origin, and inline photos use most of it. Moving photos to object storage is strongly recommended.

---

## 5. Validation rules (client side; the backend must repeat them)

- **Blank titles:** not allowed. The title reverts on blur.
- **Blank category names:** not allowed.
- **Duplicate category names:** not allowed (case-insensitive).
- **Blank gift names:** not allowed.
- **Negative prices:** not allowed. The minus sign is blocked on the keypad, and a message appears if a negative value is entered.
- **Product and store links:** must be http or https. Must look like a real host (for example `store.com`). Spaces and bare words like `asdf` are rejected. The prototype cannot confirm that a page exists.
- **Character counts** are shown inside fields: name 80, note 200, category 30. The link field has no counter or limit in the prototype.
- **Required-field marker:** a red asterisk after "Item name" and "Category name". Validation errors show a red tooltip under the field, and the field gets a red border.

---

## 6. Sharing (view-only link)

### 6.1 Intended behavior
- The owner taps **Share list**. The app **automatically creates** a view-only link. There is no separate copy-paste step beyond "Copy link".
- Anyone with the link can open the list **without an account** and sees a read-only version.
- The owner's changes update the shared view **automatically**, about 5 seconds after the last change. The update waits while a pop-up is open or the owner is reordering.
- Gifts marked as got are **not included** in the shared view.
- Categories with no un-got gifts are hidden from the shared view.
- The owner can **Stop sharing**, which makes the shared view empty and keeps the owner's data unchanged.
- The share window includes a **Copy link** button. A confirmation banner appears inside the share window: "Link copied — it's in your clipboard". It closes when the window closes.
- "Share…" (the phone's native share sheet) appears only where the browser supports `navigator.share`.
- The plain-text share option was removed because it was not expected to be used.

### 6.2 What viewers can see and do
- See the title, categories, and all un-got gifts in order.
- See photo, name, price and note (clamped with "Show more").
- Open store links.
- Switch between categories.
- Cannot add, edit, delete, reorder or mark gifts. The shared view hides these controls.
- See a "View-only · Updated [date]" line under the title.
- See "Check back soon." in an empty category.

### 6.3 Prototype implementation (for reference only)
The page calls the Claude artifact runtime to republish a copy of itself with a JSON snapshot embedded in a `<script type="application/json" id="snap">` tag. Viewers' copies detect that they are not the owner (the runtime's `user.isOwner()` check) and render from the snapshot. This is why sharing does not work on GitHub Pages. In the real backend, the viewer should instead fetch a read-only endpoint by share token.

### 6.4 Sharing requirements for the backend
- A **share token** per list. Unguessable (at least 128 bits, random). Used in the URL, for example `/s/{token}`.
- Stopping sharing revokes the token, or rotates it. The old link must stop working.
- The viewer endpoint returns only what the viewer may see: the list title, categories, and items with `got = false`. It must never return `got` items, owner-only fields, or the owner's account data.
- Viewers need no authentication. Rate-limit the endpoint.
- Consider whether the owner can regenerate a token (for example, if a link leaks).

---

## 7. Accounts and identity (not built yet)

- The prototype has **no accounts**. Each browser holds its own list. A list on one device cannot be opened on another device unless it has been shared with that device's owner view. This is a known limitation and the main reason to add a backend.
- The backend should introduce **owner accounts** (email, Google or similar). Use whatever auth is chosen for the backend. Owners need to sign in on any device.
- Viewers stay anonymous.
- **"Claim a gift" (future, not in this phase):** a viewer marks a gift as "I'm buying this" so others don't duplicate it. The product owner has said the owner **should not** see who claimed a gift (the surprise is kept), and this is "nice to have, can be planned for, but not built now." The schema should leave room for it: for example, a `claims` table keyed by item and a claimant token, with the owner's endpoints never returning claimant identity.

---

## 8. Reliability and sync notes

- Saving is **last write wins**. The prototype has no conflict handling. If the owner edits from two devices, the most recent write overwrites the other.
- The prototype saves on every change. The backend should save each change as a single small request, and should not rely on overwriting the whole list.
- Photos should be uploaded separately (object storage) and referenced by URL. Keep the 360px resize on the client or move it to the server.
- Deleting a category must delete its items in the same transaction.
- Deleting the Default category is not allowed. The backend should enforce this too.
- A list must always have at least one category.

---

## 9. External links and product data (future)

- The "Link import" step is currently a **name guess from the URL text**. The intended feature is for the backend to fetch the page and extract name, price and image (for example, from Open Graph and JSON-LD product data).
- The backend must do this fetch. The browser cannot, and the prototype cannot.
- Product-page scraping has legal and reliability issues. Expect many stores to block bots, and store markup to change. Consider a fallback that lets the owner fill in fields manually, and show a clear message when the fetch fails.
- An earlier idea was to search product catalogs (Google Shopping, Amazon, Best Buy APIs) from inside the app. That needs an API key and a server. It was discussed but not built. The owner has not yet decided whether this is wanted.

---

## 10. Database: Google Sheets (under consideration)

The developer is considering Google Sheets as the database. Points to consider:

- **Fit:** Sheets is workable for a small personal app with a few users, a few hundred items, and low write traffic. It is a poor fit for concurrent writes, photo storage and per-user access control.
- **Access:** reading and writing Sheets needs the Google Sheets API, OAuth or a service account, and API quotas. Reads on every page load may be slow and quota-limited.
- **Sharing:** the viewer endpoint must not expose the spreadsheet itself. Serve it through a server or Apps Script endpoint that filters out `got` items and owner fields.
- **Photos:** store images in Google Drive or object storage and keep only the URL in the sheet. Do not store base64 in cells.
- **Tabs:** one sheet for `lists` (or `categories`), one for `items`, optionally one for `shares` (token, list ID, active). Use a stable ID column for every row.
- **Migration:** the prototype's data is in `localStorage` only, so there is nothing to migrate server-side. The schema in section 4 maps directly to these tabs.
- **If Sheets is chosen,** a common path is a small Apps Script web app as the API, with the token check and filtering done in the script.

Recommendation for the developer to weigh: if the app grows past personal use, or needs accounts with privacy guarantees, a relational database (Postgres, for example through Supabase) with real auth will be easier to secure than Sheets.

---

## 11. Design system (for consistency in the backend-connected UI)

- **Theme:** grayscale. Light mode is off-white with near-black text. Dark mode is near-black with off-white text. Both respect `prefers-color-scheme`, and the page also supports `data-theme`.
- **Font:** Proxima Nova, falling back to Montserrat (loaded from Google Fonts).
- **Accent:** the primary button is ink-on-paper (black on white in light mode, the reverse in dark mode).
- **Peach:** used for gift names that are links. Burnt peach `#b84a22` in light mode, `#ffb38a` in dark mode. Chosen for contrast.
- **Destructive:** red. Outline for "Delete gift" and "Delete category" buttons that open a confirmation. Solid red fill only inside the confirmation pop-up's confirm button.
- **Status banners** (replace earlier blue toasts): four types, each with an icon, a message and a dismiss button. Info, success, warning, error. Colors are theme-specific. Auto-hide after 5 seconds. Shown at the top of the screen, or inside an open pop-up.
- **Buttons:**
  - Primary: solid ink fill, bold text.
  - Secondary: outlined, regular weight.
  - Pop-ups have an X in the top right corner. There are **no Cancel buttons**. Esc and tapping outside also close pop-ups.
- **Pop-ups** open as a card near the top of the screen, not from the bottom. This keeps the keyboard from pushing content around.
- **Tap targets:** most controls meet 44px. Some tab and menu icons are about 36px. This is a known gap.
- **Accessibility:** contrast was checked against WCAG AA (4.5:1 for text). Icon buttons have accessible names. The pulse respects `prefers-reduced-motion`. Auto-moving content stops after about 4 seconds per pulse, then repeats every 10 seconds, and stops after the owner taps the add button.

---

## 12. QA findings and open items

Known issues from QA:

1. **Share copy on GitHub Pages** copies the Claude URL, not the GitHub URL. Fix by making the share URL dynamic or removing the share feature on static hosts.
2. **Link import** only guesses names. Price and photo cannot be read without a backend.
3. **Negative prices** stored before the rule was added are converted to 0 on load.
4. **Duplicate gift names** are allowed. This is intended.
5. **Category row** scroll position can jump when a category is added at the end. A correction was made, but this should be checked on real devices.
6. **Emoji input** on some phone keyboards may behave differently from the test environment. Verify on iOS and Android.
7. **Long, unbroken gift names** wrap but may still look cramped. The name is clipped at 80 characters.
8. **Double-tap on Save** could open a second pop-up. Mitigated in the prototype. Still worth a double-submit guard in the backend.
9. **Dark-mode photo placeholders** use the same gift icon as light mode. Acceptable but not checked on device.
10. **The Default category** cannot be deleted. There is no "archive" feature.

Open product questions:

- Should the owner be able to **restore** a deleted gift or category? (Not in the prototype.)
- Should gifts be **sorted** by something other than manual order? (Manual order only.)
- Should there be **multiple wishlists** per owner, or one list with categories? (Currently one list with categories.)
- Should **price currency** support other currencies? (Peso only.)
- Should the owner get a **notification** when a shared link is opened? (Not planned.)

---

## 13. Suggested next steps for the backend

1. Decide the database (section 10).
2. Define the API:
   - Owner endpoints (authenticated): read list, update title, CRUD categories, CRUD items, reorder items, toggle got, create/revoke share token.
   - Viewer endpoint (token): read the filtered shared view.
3. Move photos to object storage and return URLs.
4. Add owner auth and per-owner data isolation.
5. Replace the Claude artifact sharing with the token endpoint.
6. Build a migration path from `localStorage` (the `wishlist-v3` key) to the backend, so existing users can import their data once.
7. Plan for, but do not build yet: gift claiming, owner notifications, and product-page fetching.

---

## 14. Glossary

- **Owner:** the person who creates and edits the wishlist.
- **Viewer:** anyone with the share link. Read-only, no account.
- **Category:** a named group of gifts, shown as a tab. (Called "list" internally in early versions.)
- **Gift / item:** one wish.
- **Got:** the owner has bought or received the gift. Hidden from viewers.
- **View-only link:** the shareable URL for viewers.
- **Snapshot:** the prototype's copy of the list embedded in the shared page.
