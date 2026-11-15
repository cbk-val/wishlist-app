const fs = require('fs');
const path = require('path');

const FAKE_SRC = fs.readFileSync(path.join(__dirname, 'fake-supabase.js'), 'utf8');

const OWNER = { user: { id: 'owner-1', email: 'owner@test.dev' } };
const VIEWER = { user: { id: 'viewer-1', email: 'viewer@test.dev' } };

// Starting data. Owner sees everything; a non-owner sees only items that are not "got"
// and only categories that have at least one such item.
//   Default (is_default): Item A, Item B, Item C (got)
//   Books:                Book D, Book E
//   Archive:              Old F (got)  <- only got gifts, so hidden from viewers
function makeData() {
  return {
    wishlists: [{ id: 'w1', owner_id: 'owner-1', title: 'My wishlist' }],
    categories: [
      { id: 'c-main', wishlist_id: 'w1', name: 'Default', icon: '🎁', is_default: true, sort_order: 0 },
      { id: 'c-books', wishlist_id: 'w1', name: 'Books', icon: '📚', is_default: false, sort_order: 1 },
      { id: 'c-archive', wishlist_id: 'w1', name: 'Archive', icon: '🗄️', is_default: false, sort_order: 2 },
    ],
    items: [
      { id: 'i-a', category_id: 'c-main', name: 'Item A', price: 100, link: '', note: '', got: false, sort_order: 0, img: null },
      { id: 'i-b', category_id: 'c-main', name: 'Item B', price: 0, link: '', note: '', got: false, sort_order: 1, img: null },
      { id: 'i-c', category_id: 'c-main', name: 'Item C', price: 0, link: '', note: '', got: true, sort_order: 2, img: null },
      { id: 'i-d', category_id: 'c-books', name: 'Book D', price: 0, link: '', note: '', got: false, sort_order: 0, img: null },
      { id: 'i-e', category_id: 'c-books', name: 'Book E', price: 0, link: '', note: '', got: false, sort_order: 1, img: null },
      { id: 'i-f', category_id: 'c-archive', name: 'Old F', price: 0, link: '', note: '', got: true, sort_order: 0, img: null },
    ],
  };
}

// Opens the app with the fake Supabase.
//   opts.session  OWNER (default), VIEWER, or null for signed out
//   opts.delayMs  artificial delay on every database call
//   opts.url      page to open (default "/")
async function openApp(page, opts = {}) {
  const scenario = {
    session: opts.session === undefined ? OWNER : opts.session,
    data: opts.data || makeData(),
    delayMs: opts.delayMs || 0,
    failWrites: false,
  };
  await page.route(/cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE_SRC }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.addInitScript((sc) => { window.__FAKE = sc; }, scenario);
  await page.goto(opts.url || '/');
  if (scenario.session) await page.waitForSelector('#list li');
  else await page.waitForSelector('#gate:not([hidden])');
}

const getLog = (page) => page.evaluate(() => window.__LOG);
const getDb = (page) => page.evaluate(() => window.__DB);
const failWrites = (page, on = true) => page.evaluate((v) => { window.__FAKE.failWrites = v; }, on);
const itemNames = (page) => page.locator('#list li .name').allInnerTexts().then((a) => a.map((s) => s.trim()));
const card = (page, name) => page.locator('#list li', { hasText: name });

async function openMenu(page, name, action) {
  const li = card(page, name);
  await li.locator('[data-a="menu"]').click();
  await li.locator(`[data-a="${action}"]`).click();
}

async function addManually(page, fields) {
  await page.locator('#add').click();
  await page.locator('#manual').click();
  if (fields.name !== undefined) await page.locator('#fName').fill(fields.name);
  if (fields.price !== undefined) await page.locator('#fPrice').fill(String(fields.price));
  if (fields.link !== undefined) await page.locator('#fLink').fill(fields.link);
  if (fields.note !== undefined) await page.locator('#fNote').fill(fields.note);
}

module.exports = { OWNER, VIEWER, makeData, openApp, getLog, getDb, failWrites, itemNames, card, openMenu, addManually };