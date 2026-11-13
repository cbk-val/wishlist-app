# Wishlist App: Developer Context and Handoff

This document explains what the current prototype does, why it works that way, and what the backend and database need to support. It is written so a developer, or an AI assistant helping them, can review `wishlist.html` and plan the backend without the original conversation.

The prototype is a single HTML file with inline CSS and JavaScript. It has no backend. It is mobile-first and was tested at a 390px-wide phone viewport. All behavior described below comes from that prototype.

---

## 1. Product summary

A personal gift wishlist. An **owner** creates a wishlist made of **categories** (tabs such as "Birthday", "Home", "Books") and adds **gifts** to them. Each gift has a name and, optionally, a photo, price, store link and a note for the gift giver. The owner can mark gifts as got, reorder gifts within a category, and create a **view-only link** that friends and family can open to see the list.

Currency is Philippine pesos (₱). The app was built for a user in the Philippines.

Users:
- **Owner:** creates and edits the list. Needs to sign in once accounts exist (see section 7).
- **Viewer:** anyone with the view-only link. No account. Cannot edit anything.

---

## 2. Current status of the prototype

- All owner data lives **only in the browser** (`localStorage`, key `wishlist-v3`). Nothing is sent to a server.
- The page is published as a **Claude artifact** at `https://claude.ai/artifact/HWHiHzpmAnVa5BS4XBpyvi`. The artifact runtime lets the page republish a copy of itself with an embedded snapshot of the shared list. That is how the view-only link works today. It is a stopgap, not the intended architecture.
- A static copy was exported to **GitHub Pages**. There the sharing feature cannot work, because it depends on the Claude runtime. The "Copy link" button still copies the Claude artifact URL, which is a known bug for that deployment.
- The backend is undecided. The developer is considering **Google Sheets as the database** (section 10).
- The page is **locked to dark mode** (`<html data-theme="dark">`). A light palette exists in the CSS but is not reachable.

---

## 3. Screens and flows

### 3.1 Main screen (owner)
- **Header:** editable title (contenteditable). Cannot be blank. If cleared, it reverts to the last valid title and shows a red message. Default: "My wishlist".
- **Share list** button, top right, beside the title. Opens the share window (section 6).
- **Category row:** horizontally scrolling tabs, with a pinned **Add category** button at the right. The selected tab scrolls into view when it changes. The selected tab shows a pencil icon that opens the category's edit pop-up. Long-pressing any tab (about 500 ms) also opens it.
- **Add category** shows its full label while there are fewer than three categories. With three or more, it becomes a round "+" button (44px). The label remains the accessible name and tooltip.
- **Reorder items** button sits between the category row and the gift cards. It hugs its label (it is **not** full width). It is **disabled** (greyed out, not hidden) when the category has fewer than two gifts. It is hidden in reorder mode and in the shared view.
- **Gift cards**, numbered 1 to n outside the card. Each shows a photo (or gift icon placeholder), name (a link if a store link exists), price (muted gray), and a note clamped to two lines with "Show more" / "Show less". Each has a three-dot menu at the top right.
- **Floating "+ Add a gift"** button, bottom right. The only add entry point (see 3.5).

### 3.2 Add a gift (two steps)
- **Step 1: How do you want to add it?** Product link field with "Continue with link", or "Add manually". The link is validated as you leave the field.
- **Step 2: Check the details.** Fields in order:
  - Photo (optional)
  - Category (dropdown; defaults to the current category; can move the gift)
  - Item name (required, max 80)
  - Price (₱; optional; numeric; placeholder "0"; decimals allowed but not shown unless typed)
  - Store link (optional; must be http or https)
  - Notes for the gift giver (optional, max 200, text area with counter)
  - Back (only when adding) and Save gift.
  - Delete gift only when editing. It opens a confirmation pop-up.
- **Link import limit:** the prototype cannot fetch the product page (browsers block a published page from calling other websites). It only derives a name from the URL text, such as turning `sony-wh-1000xm5-wireless-headphones` into "Sony WH-1000XM5 Wireless Headphones". It strips tracking parameters and marketplace IDs (Shopee `-i.123.456`, Lazada `-i123-s456`). It cannot read price, photo or description. A backend fetch is the intended solution (section 9).

### 3.3 Categories
- Name required, max 30, unique (case-insensitive).
- Icon: any emoji. Entered in an icon box that opens the phone's emoji keyboard, or chosen from a suggested grid of 15 emojis. Non-emoji text is ignored.
- The first category, **"Default"** (internal id `main`), always exists and **cannot be deleted**. It can be renamed and re-iconed.
- Deleting another category deletes **all of its gifts**. The confirmation says how many.
- Created with "Add category", edited with the pencil or a long-press.

### 3.4 Reorder mode
- Entered from the "Reorder items" button above the cards. Owner only.
- A sticky bar reads "Drag the handles to reorder" with a Done button.
- Each card shows a drag handle (≡) in place of the three-dot menu. Card height does not change.
- Order is stored as the array order of items within the category and persists across reloads.

### 3.5 Empty state and the add button
- An empty category shows an illustration, "This category is empty", and "Tap Add a gift below to add the first thing you'd love to receive."
- While the **current category is empty**, the bottom-right Add a gift button pulses: three pulses (about 4 seconds), a 10-second rest, then repeat. The pulse is a gray ring that expands from the button edge. It stops for the rest of the page session once the owner taps the button. It does not persist across reloads.
- Users with reduced motion see a steady outline instead.

### 3.6 Card three-dot menu (owner)
- "Mark as got" / "Mark as not got"
- "Edit gift"
- Reorder is **not** in this menu (it moved to the button above the cards).

### 3.7 Got gifts
- Stay in their category, show a "Got it" label, and are shown with the whole card dimmed to 60% opacity and the name in muted gray. **No strikethrough.**
- Always excluded from the shared view (section 6).

### 3.8 Pop-ups and dismissal
- Every pop-up (add gift, category, delete confirmation, share window) has a **round X button** in the top right. There are **no Cancel buttons** anywhere.
- Esc and tapping outside also close pop-ups.
- Pop-ups open as a card near the top of the screen (not from the bottom), so the keyboard does not push content around.
- Pop-ups never open the keyboard automatically. The keyboard appears only when a user taps a field, or when a validation error sends focus to a field.

---

## 4. Data model (current prototype)

One JSON object under `localStorage` key **`wishlist-v3`**. Earlier versions used `wishlist-v2` and `wishlist-v1`. On load, the app checks v3, then v2, then v1, and migrates older shapes (`lists` → `categories`, `listId` → `categoryId`, drops `emoji` and `prio`).

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

| Field | Type | Rules |
|---|---|---|
| `title` | string | Required, non-blank. Default "My wishlist". |
| `categories[].id` | string | Default uses `"main"`. Others are `"l" + timestamp`. |
| `categories[].name` | string | Required, max 30, unique case-insensitive. |
| `categories[].icon` | string | One emoji. Default 🎁. |
| `items[].id` | number | Generated from `Date.now()`. Use a real primary key in the backend. |
| `items[].categoryId` | string | Must exist. Deleting a category deletes its items. |
| `items[].name` | string | Required, max 80. |
| `items[].price` | number | ≥ 0. Whole pesos or decimal. Stored as 0 when empty. |
| `items[].link` | string | Optional. http or https only. No length limit. |
| `items[].note` | string | Optional, max 200. |
| `items[].img` | string | Optional base64 JPEG, longest side 360px, quality 0.8. |
| `items[].got` | boolean | Owner-only state. Hidden from viewers. |
| `items` order | array order | Display order within each category. |
| `cur` | string | Last selected category (UI state). |
| `sharing` | boolean | Whether the view-only link is active. |
| `pubSig`, `pubAt` | string, number | Prototype-only republishing bookkeeping. Drop in the backend. |

Storage: `localStorage` is about 5 MB per origin, and inline photos use most of it. Move photos to object storage.

---

## 5. Validation rules (client side; the backend must repeat them)

- **Blank title:** not allowed. Reverts on blur with a red message.
- **Blank category or gift name:** not allowed. Shows a red tooltip under the field, and the field gets a red border.
- **Duplicate category names:** not allowed (case-insensitive). Tooltip: "You already have a category with this name."
- **Negative prices:** not allowed. The minus sign is blocked on the keypad, and "Price can't be negative" appears if one is entered.
- **Non-numeric price:** rejected with "Enter a valid price."
- **Links** (product link in step 1, store link in the form): must be http or https and look like a real host (for example `store.com`). Spaces and bare words like `asdf` are rejected. The prototype cannot confirm that the page exists.
- **Character limits** (counter shown inside the field): name 80, notes 200, category name 30. The link field has no limit.
- **Required marker:** a red asterisk after the label for required fields.

---

## 6. Sharing (view-only link)

### 6.1 Current behavior
- Tapping **Share list** opens the share window and **immediately creates the view-only link** if sharing is not already on. A "Creating your view-only link…" state shows while it works.
- The link is the artifact URL itself (no suffix). Viewers who are not the owner see the view-only version. The owner sees the owner view at the same link.
- Owner changes update the shared view **about 5 seconds after the last change**. Updates wait while a pop-up is open or the owner is reordering.
- Got gifts are **excluded** from the shared view. Categories with no un-got gifts are hidden.
- **Stop sharing** (red outline button) empties the shared view. The owner's data is not changed.
- **Copy link** copies the link and shows a success banner in the window: "Link copied to your clipboard". If automatic copying is blocked, the banner says "Couldn't copy automatically. Press and hold the link to copy it."
- **Share…** (the native share sheet) appears only where the browser supports `navigator.share`. It is hidden otherwise.
- The window tells the owner to set access to "Anyone with the link" in Claude's Share menu, since viewers without a Claude account otherwise cannot open it.
- **Plain-text sharing was removed.** It was judged unlikely to be used.

### 6.2 What viewers see and can do
- See the title, categories, and all un-got gifts in order, with photo, name, price and note (clamped with "Show more").
- Open store links. Switch categories.
- Cannot add, edit, delete, reorder or mark gifts. The shared view hides these controls.
- See "View-only · Updated [date]" under the title, and "Check back soon." in an empty category.

### 6.3 Prototype implementation (reference only)
The page calls the Claude artifact runtime to republish a copy of itself with a JSON snapshot embedded in `<script type="application/json" id="snap">`. Viewers detect they are not the owner through `user.isOwner()` and render from the snapshot. The runtime only lets a page update **its own** artifact, so a separate view-only artifact cannot be created. A `#view` URL suffix was tried and reverted because it made exported files open in viewer mode.

### 6.4 Requirements for the real backend
- A **share token** per list: random, at least 128 bits, used in a URL such as `/s/{token}`.
- Stopping sharing revokes or rotates the token, so the old link stops working.
- The viewer endpoint returns only the title, categories, and items with `got = false`. Never return `got` items, owner-only fields or owner account data.
- Viewers need no authentication. Rate-limit the endpoint.
- Owner can regenerate a token if a link leaks.

---

## 7. Owner mode, accounts and identity

- **Owner detection (prototype):** when the Claude runtime exists, it asks `user.isOwner()`; non-owners get the view-only version. When there is **no runtime** (an exported file, or GitHub Pages), the page opens in **owner mode**.
- Consequence: an exported file opens owner mode with the data in that browser's `localStorage`, which is separate from claude.ai's. Opening it on another device shows an empty list.
- The backend should introduce **owner accounts** (email, Google, or similar). Owners sign in on any device. Viewers stay anonymous.
- **"Claim a gift" (future, not in this phase):** a viewer marks a gift as "I'm buying this" so others don't duplicate it. The product owner said the owner **should not** see who claimed a gift, and this is "nice to have, can be planned, not built now." Leave room in the schema, for example a `claims` table keyed by item and a claimant token. Owner endpoints must never return claimant identity.

---

## 8. Reliability and sync notes

- Saving is **last write wins**. Two devices editing at once will overwrite each other.
- The prototype saves on every change. The backend should save each change as a small request, not overwrite the whole list.
- Photos should be uploaded to object storage and referenced by URL. Keep the 360px resize on the client or move it to the server.
- Deleting a category must delete its items in the same transaction.
- The Default category cannot be deleted. Enforce this on the server too.
- A list always has at least one category.

---

## 9. Product links and product data (future)

- The current link import only guesses a name from the URL text.
- The intended feature: the backend fetches the page and extracts name, price and image (for example from Open Graph and JSON-LD product data).
- The browser cannot do this, and the prototype cannot either.
- Scraping has legal and reliability issues. Many stores block bots, and their markup changes. Provide a manual fallback and a clear message when the fetch fails.
- An earlier idea was in-app product search (Google Shopping, Amazon, Best Buy APIs). It needs an API key and a server. Not built. The owner has not decided whether to add it.

---

## 10. Database: Google Sheets (under consideration)

- **Fit:** workable for a small personal app with few users, a few hundred items and low write traffic. Poor fit for concurrent writes, photo storage and per-user access control.
- **Access:** needs the Sheets API with OAuth or a service account, and is subject to quotas. Reads on every page load may be slow.
- **Sharing:** never expose the spreadsheet itself. Serve the viewer endpoint through a server or Apps Script that filters out `got` items and owner fields.
- **Photos:** store in Google Drive or object storage and keep only the URL in the sheet. Do not store base64 in cells.
- **Tabs:** `categories`, `items`, optionally `shares` (token, list ID, active). Every row needs a stable ID column.
- **Migration:** nothing to migrate server-side, because owner data is only in `localStorage`. The schema in section 4 maps directly to these tabs.
- A common path is a small Apps Script web app as the API, with the token check and filtering done in the script.
- **Recommendation to weigh:** if the app grows beyond personal use, or needs accounts with privacy guarantees, a relational database (Postgres, for example via Supabase) with real auth is easier to secure than Sheets.

---

## 11. Design system

### 11.1 Theme
- **Dark only.** The page uses the dark palette throughout.
- Dark palette: page #121212, surface #1d1d1d, text #f2f2f2, muted #9a9a9a, borders #333333 and #8c8c8c, soft fill #2a2a2a, accent #f2f2f2 (primary buttons are light with dark text).

### 11.2 Color tokens
| Variable | Dark value | Use |
|---|---|---|
| color/bg/page | #121212 | Page background |
| color/bg/surface | #1d1d1d | Cards, sheets, fields |
| color/text/primary | #f2f2f2 | Main text, dropdown text |
| color/text/muted | #9a9a9a | Hints, counters, secondary text |
| color/text/on-accent | #111111 | Text on primary buttons |
| color/accent/default | #f2f2f2 | Primary button fill, selected chip |
| color/border/default | #333333 | Card and empty-state borders |
| color/border/strong | #8c8c8c | Fields, secondary buttons, chips |
| color/surface/soft | #2a2a2a | Photo placeholders, close button, emoji box |
| **color/link/default** | **#4c9cff** | **Link text color (gift names with a store link). Replaces the old peach.** |
| color/status/danger | #ff8a80 | Destructive buttons, error borders, error tooltip fill |
| color/status/on-danger | #2a0a0a | Text on error tooltip and solid red confirm |
| color/status/success | #7ee2a0 | Success |
| color/status/info | #8ab4ff | Info banner stripe |
| color/status/warning | #ffc56b | Warning banner stripe |
| color/status/error | #ff8a80 | Error banner stripe |
| color/control/select | #2e2e2e | Dropdown fill |

Light-mode values for the link color (#1d4ed8) exist in the CSS as a fallback only.

### 11.3 Spacing and radius variables
- Spacing: xs 4, sm 8, md 12, lg 16, xl 24.
- Radius: sm 8, md 12, lg 16, pill 999.

### 11.4 Typography
- **Headings:** Source Serif Pro Bold. Pop-up titles 22px. Gift names 16px. Empty-state heading 24px. The page title is larger on the page than the 22px pop-up titles (the page keeps its larger size).
- **Body and UI:** Montserrat. Fallback stack on the page is Proxima Nova, then Montserrat.
- **Text styles:** Display/Title (Source Serif Pro Bold 22), Heading/Item (Source Serif Pro Bold 16), Body/Default (Montserrat Regular 15), Body/Small (Montserrat Regular 13), Label/Button (Montserrat SemiBold 14), Label/Chip (Montserrat Medium 13), and a Montserrat Bold 16 style for the Add a gift button.
- **Weights in use:** primary buttons Bold 14; secondary buttons SemiBold 14; destructive buttons Bold 14; chips Medium 13; banner messages Regular 15; hints Regular 14 (muted); field labels Medium 13.

### 11.5 Corner radius
- Text fields, text area, dropdown, emoji box: **8px** (reduced from 12 per your note).
- Buttons: 12px.
- Gift cards: 8px. Status banners: 8px. Error tooltip: 8px. Empty state: 16px. Reorder bar: 16px. Add a gift button: 16px.
- **Category chips: fully rounded (pill).**
- Pop-up sheets: 24px at the top corners. Confirmation card: 16px. Close button: circle.

### 11.6 Components
- **Button:** Style (Primary, Secondary, Danger) × State (Default, Disabled) × Icon (Yes/No) = 12 variants. Disabled is 45% opacity.
  - Primary: solid light fill, dark text, bold.
  - Secondary: surface fill, strong-gray outline, SemiBold.
  - Danger: surface fill, red outline, red text. The solid red confirm button is a Primary with the danger fill applied on the screen; the library has no solid-danger variant yet.
- **Icon:** a set of 10 stroke icons: reorder, share, plus, link, trash, check, image, back, pencil, close. Used inside buttons (the Icon option) and swapped per instance.
- **Category chip:** Selected (solid) and Default (outlined). Pill-shaped, 9px vertical padding.
- **Add button (FAB):** Default and Attention (with a 4px outline ring, used while the category is empty).
- **Status banner:** Info, Success, Warning, Error. Surface fill, strong-gray outline, colored left stripe, message text. Auto-dismiss after 5 seconds; a dismiss button is also present.
- **Text field:** State (Default, Error) × Counter (No, Yes). Counter shows, for example, "0/30" inside the field at the right. Error uses a red 2px border. The red message is a separate tooltip component.
- **Text area:** a multi-line box with a counter in the bottom right corner.
- **Dropdown:** the category picker. Dark fill, text, chevron.
- **Close button:** circle with X. Used on every pop-up.
- **Error tooltip:** red bubble with a small up-pointing arrow, placed under the field it refers to.
- **Emoji option:** a 56px icon cell for the category icon grid.
- **Gift card:** Default and Got. The Got state has the card dimmed to 60% and the name in muted gray, with no strikethrough.
- **Empty state:** dashed border, heading, body.
- **Reorder bar:** instruction text and a Done button.


---

## 12. QA findings and open items

Known issues:
1. **Share copy on GitHub Pages** copies the Claude URL, not the GitHub URL. Sharing does not work there.
2. **Link import** only guesses names. Price and photo need a backend.
3. **Negative prices** stored before the rule was added are converted to 0 on load.
4. **Duplicate gift names** are allowed. Intended.
5. **Category row scroll** was corrected once; verify on real devices.
6. **Emoji keyboard behavior** differs across iOS and Android. Verify on devices.
7. **Long unbroken gift names** wrap but may look cramped. Names are capped at 80 characters.
8. **Double-tap on Save** could open a second pop-up. Mitigated in the prototype. Add a double-submit guard in the backend.
9. **Tap targets:** some tab and menu icons are about 36px, below the 44px recommendation.
10. **The Default category** cannot be deleted, and there is no archive feature.
11. **Shared snapshot and owner changes:** the page republishes about 5 seconds after a change, so a viewer may see a brief reload. Owner scroll position and category are kept.

12. **Dark-only:** the light palette exists in CSS but is unreachable. Remove or keep as a future option.

Open product questions:
- Should the owner be able to **restore** deleted gifts or categories?
- Should gifts be **sorted** by something other than manual order?
- Should there be **multiple wishlists** per owner, or one list with categories? (Currently one list with categories.)
- Should the owner be notified when the shared link is opened?
- Should the exported file open with the owner's current data? (Possible: seed from the snapshot, excluding got gifts.)

---

## 13. Changelog since the first draft

- **Sharing:** the window creates the link immediately on tap. Plain-text sharing was removed. The copy confirmation is an in-window banner. "Share…" appears only where the browser supports it. The auto-update delay is about 5 seconds.
- **Reorder:** moved from the card menu to a button above the cards. It is disabled under two gifts and hugs its label.
- **Card menu:** "Mark as got", "Edit gift". Reorder removed.
- **Got gifts:** no strikethrough. Whole card dimmed to 60%. Price in muted gray.
- **Empty state:** the in-card button is removed. The Add a gift button pulses three times every 10 seconds until tapped.
- **Pop-ups:** a round X on every pop-up. All Cancel buttons removed.
- **Banners:** replaced the old toast with four types (info, success, warning, error). Copy: "Link copied to your clipboard", "Error. Could not save.", "Add at least two gifts to reorder.".
- **Category row:** Add category pinned at the right, shrinking to a "+" button with three or more categories.
- **Categories:** any emoji can be used as an icon. Unique names are enforced.
- **Price:** ₱ throughout, placeholder "0", negatives blocked.
- **Typography:** serif headings (Source Serif Pro Bold), Montserrat body, button and banner weights updated.
- **Theme:** dark only.
- **Link color:** #4c9cff for gift names with a store link (replaced peach).
- **Corners:** fields, text area, dropdown and emoji box 8px. Chips stay fully rounded.
- **Chips:** 9px vertical padding (shorter).
- **Ownership:** no runtime (exported file or GitHub Pages) opens owner mode. The `#view` link suffix was tried and reverted.

---

## 14. Suggested next steps for the backend

1. Decide the database (section 10).
2. Define the API:
   - Owner endpoints (authenticated): read list, update title, CRUD categories, CRUD items, reorder items, toggle got, create or revoke share token.
   - Viewer endpoint (token): the filtered shared view.
3. Move photos to object storage and return URLs.
4. Add owner auth and per-owner data isolation.
5. Replace the Claude-artifact sharing with the token endpoint.
6. Provide a one-time import path from `localStorage` (`wishlist-v3`) so existing users can move their data.
7. Plan, but do not build yet: gift claiming, owner notifications, product-page fetching.

---

## 15. Glossary

- **Owner:** the person who creates and edits the wishlist.
- **Viewer:** anyone with the share link. Read-only, no account.
- **Category:** a named group of gifts, shown as a tab. Called "list" in early versions.
- **Gift / item:** one wish.
- **Got:** the owner has bought or received the gift. Hidden from viewers.
- **View-only link:** the shareable URL for viewers.
- **Snapshot:** the prototype's copy of the shared list embedded in the published page.