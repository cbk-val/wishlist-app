const { test, expect } = require('@playwright/test');
const { OWNER, VIEWER, makeData, openApp, getLog, getDb, failWrites, itemNames, card, openMenu, addManually } = require('./helpers');
const fs = require('fs');
const path = require('path');
const FAKE_SRC = fs.readFileSync(path.join(__dirname, 'fake-supabase.js'), 'utf8');

test.describe('Landing page', () => {
  test('signed-out visitors reach the clean landing route from the app root', async ({ page }) => {
    const scenario = { session: null, data: makeData(), delayMs: 0, failWrites: false };
    await page.route(/cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE_SRC }));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
    await page.addInitScript((sc) => { window.__FAKE = sc; }, scenario);
    await page.goto('/');

    await expect(page).toHaveURL('http://localhost:4173/landing/');
    await expect(page.locator('[data-signin]')).toHaveCount(2);
  });

  test('both wishlist CTAs use Google sign-in and redirect to the app root', async ({ page }) => {
    const scenario = { session: null, data: makeData(), delayMs: 0, failWrites: false };
    await page.route(/cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE_SRC }));
    await page.addInitScript((sc) => { window.__FAKE = sc; }, scenario);
    await page.goto('/landing/#oauth-callback');
    await expect(page).toHaveURL('http://localhost:4173/landing/#oauth-callback');
    const stylesheets = await page.evaluate(() => Array.from(document.styleSheets, (sheet) => sheet.href));
    expect(stylesheets).toContain('http://localhost:4173/landing.css');

    const ctas = page.locator('[data-signin]');
    await expect(ctas).toHaveCount(2);
    await ctas.nth(0).click();
    await expect.poll(async () => (await page.evaluate(() => window.__LOG)).length).toBe(1);
    const firstCall = await page.evaluate(() => window.__LOG[0]);
    expect([firstCall.provider, firstCall.redirectTo]).toEqual(['google', 'http://localhost:4173/']);

    await page.reload();
    await expect(page).toHaveURL('http://localhost:4173/landing/#oauth-callback');
    await ctas.nth(1).click();
    await expect.poll(async () => (await page.evaluate(() => window.__LOG)).length).toBe(1);

    const secondCall = await page.evaluate(() => window.__LOG[0]);
    expect([secondCall.provider, secondCall.redirectTo]).toEqual(['google', 'http://localhost:4173/']);
  });
});

/* ------------------------------------------------------------------ */
test.describe('Sign-in gate', () => {
  test('G1 signed-out visitor sees only the sign-in card and no data is requested', async ({ page }) => {
    await openApp(page, { session: null });
    await expect(page.locator('#gate')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    const log = await getLog(page);
    expect(log.filter((e) => e.table)).toHaveLength(0);
  });

  test('G2 Google button starts OAuth with the site address as the redirect', async ({ page }) => {
    await openApp(page, { session: null });
    await page.locator('#google-login-btn').click();
    await expect.poll(async () => (await getLog(page)).find((e) => e.auth === 'signInWithOAuth')).toBeTruthy();
    const call = (await getLog(page)).find((e) => e.auth === 'signInWithOAuth');
    expect(call.provider).toBe('google');
    expect(call.redirectTo).toBe('http://localhost:4173/');
  });

  test('G3 signing out returns to the sign-in card', async ({ page }) => {
    await openApp(page);
    await page.locator('#signout-btn').click();
    await expect(page.locator('#gate')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
test.describe('Owner: basics', () => {
  test('A1 owner sees edit controls, sign out, and no view-only note', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('body')).not.toHaveClass(/viewer/);
    await expect(page.locator('#add')).toBeVisible();
    await expect(page.locator('#share')).toBeVisible();
    await expect(page.locator('#signout-btn')).toBeVisible();
    await expect(page.locator('#viewNote')).toBeHidden();
    await expect(page.locator('#title')).toHaveAttribute('contenteditable', 'true');
    await expect(page.locator('#gate')).toBeHidden();
  });

  test('A1b owner sees got gifts and every category', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#cats [data-c]')).toHaveCount(3);
    expect(await itemNames(page)).toEqual(['Item A', 'Item B', 'Item C']);
    await expect(card(page, 'Item C').locator('.tag.ok')).toHaveText('Got it');
  });

  test('A1c debug panel is hidden unless ?debug=1', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#debug-container')).toBeHidden();
  });

  test('A1d debug panel shows with ?debug=1', async ({ page }) => {
    await openApp(page, { url: '/?debug=1' });
    await expect(page.locator('#debug-container')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
test.describe('Owner: gifts', () => {
  test('A2 add a gift manually: shown, saved in the right category with the next sort order', async ({ page }) => {
    await openApp(page);
    await addManually(page, { name: 'New thing', price: 250, note: 'Blue one' });
    await page.locator('#save').click();
    await expect(page.locator('.nbanner.success')).toContainText('Gift added');
    expect(await itemNames(page)).toEqual(['Item A', 'Item B', 'Item C', 'New thing']);
    const row = (await getDb(page)).items.find((i) => i.name === 'New thing');
    expect(row.category_id).toBe('c-main');
    expect(row.sort_order).toBe(3);
    expect(row.price).toBe(250);
    expect(row.got).toBe(false);
  });

  test('A3a blank name is rejected', async ({ page }) => {
    await openApp(page);
    await addManually(page, {});
    await page.locator('#save').click();
    await expect(page.locator('#s2 .tip')).toContainText('Add a gift name');
    expect((await getDb(page)).items).toHaveLength(6);
  });

  test('A3b name field stops at 80 characters', async ({ page }) => {
    await openApp(page);
    await page.locator('#add').click();
    await page.locator('#manual').click();
    await expect(page.locator('#fName')).toHaveAttribute('maxlength', '80');
  });

  test('A3c negative price is rejected', async ({ page }) => {
    await openApp(page);
    await addManually(page, { name: 'Cheap', price: -1 });
    await page.locator('#save').click();
    await expect(page.locator('#s2 .tip')).toContainText(/Price can.t be negative/);
    expect((await getDb(page)).items).toHaveLength(6);
  });

  test('A3d bad store link is rejected', async ({ page }) => {
    await openApp(page);
    await addManually(page, { name: 'Linky', link: 'asdf' });
    await page.locator('#save').click();
    await expect(page.locator('#s2 .tip')).toContainText('valid link');
    expect((await getDb(page)).items).toHaveLength(6);
  });

  test('A4a link import cleans a Shopee URL into a name', async ({ page }) => {
    await openApp(page);
    await page.locator('#add').click();
    await page.locator('#fUrl').fill('https://www.shopee.ph/Sony-WH-1000XM5-Wireless-Headphones-i.123456.789012');
    await page.locator('#useLink').click();
    await expect(page.locator('#fName')).toHaveValue('Sony WH-1000XM5 Wireless Headphones');
    await expect(page.locator('#banner')).toContainText('shopee.ph');
  });

  test('A4b link import cleans a Lazada URL into a name', async ({ page }) => {
    await openApp(page);
    await page.locator('#add').click();
    await page.locator('#fUrl').fill('https://www.lazada.com.ph/products/sony-wh-1000xm5-wireless-headphones-i123456789-s987654321.html');
    await page.locator('#useLink').click();
    await expect(page.locator('#fName')).toHaveValue('Sony WH-1000XM5 Wireless Headphones');
  });

  test('A5 double-tapping Save creates exactly one gift', async ({ page }) => {
    await openApp(page, { delayMs: 400 });
    await addManually(page, { name: 'Once only' });
    await page.locator('#save').dblclick();
    await expect(page.locator('#dlg')).toBeHidden();
    const inserts = (await getLog(page)).filter((e) => e.table === 'items' && e.op === 'insert');
    expect(inserts).toHaveLength(1);
    expect((await getDb(page)).items.filter((i) => i.name === 'Once only')).toHaveLength(1);
  });

  test('A6 moving a gift to another category puts it last there', async ({ page }) => {
    await openApp(page);
    await openMenu(page, 'Item A', 'edit');
    await page.locator('#fCat').selectOption('c-books');
    await page.locator('#save').click();
    await expect(page.locator('.nbanner.success')).toContainText('Gift updated');
    const row = (await getDb(page)).items.find((i) => i.id === 'i-a');
    expect(row.category_id).toBe('c-books');
    expect(row.sort_order).toBe(2);                     // Books had 0 and 1
    expect(await itemNames(page)).toEqual(['Item B', 'Item C']);
    await page.locator('button.chip[data-c="c-books"]').click();
    expect(await itemNames(page)).toEqual(['Book D', 'Book E', 'Item A']);
  });

  test('A7 mark as got saves and shows the Got it tag, and can be undone', async ({ page }) => {
    await openApp(page);
    await openMenu(page, 'Item A', 'got');
    await expect(card(page, 'Item A').locator('.tag.ok')).toHaveText('Got it');
    expect((await getDb(page)).items.find((i) => i.id === 'i-a').got).toBe(true);
    await openMenu(page, 'Item A', 'got');
    await expect(card(page, 'Item A').locator('.tag.ok')).toHaveCount(0);
    expect((await getDb(page)).items.find((i) => i.id === 'i-a').got).toBe(false);
  });

  test('A7b failed "mark as got" shows a red error and leaves the gift unchanged', async ({ page }) => {
    await openApp(page);
    await failWrites(page);
    await openMenu(page, 'Item A', 'got');
    await expect(page.locator('.nbanner.error')).toContainText('Error updating gift');
    await expect(card(page, 'Item A').locator('.tag.ok')).toHaveCount(0);
  });

  test('A8 reorder: dragging saves the new order', async ({ page }) => {
    await openApp(page);
    await page.locator('#reorderBtn').click();
    const grip = await page.locator('#list li', { hasText: 'Item A' }).locator('.grip').boundingBox();
    const target = await page.locator('#list li', { hasText: 'Item B' }).boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, target.y + target.height * 0.8, { steps: 12 });
    await page.mouse.up();
    await page.locator('#reorderDone').click();
    expect(await itemNames(page)).toEqual(['Item B', 'Item A', 'Item C']);
    await expect.poll(async () => {
      const items = (await getDb(page)).items;
      return ['i-b', 'i-a', 'i-c'].map((id) => items.find((i) => i.id === id).sort_order);
    }).toEqual([0, 1, 2]);
  });

  test('A13 Reorder is disabled with fewer than two gifts', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#reorderBtn')).toBeEnabled();                       // Default has 3
    await page.locator('button.chip[data-c="c-archive"]').click();                  // Archive has 1
    await expect(page.locator('#reorderBtn')).toBeDisabled();
  });

  test('A16 failed save shows a red error and adds nothing', async ({ page }) => {
    await openApp(page);
    await addManually(page, { name: 'Will fail' });
    await failWrites(page);
    await page.locator('#save').click();
    await expect(page.locator('.nbanner.error')).toContainText('Error saving gift');
    expect(await itemNames(page)).toEqual(['Item A', 'Item B', 'Item C']);
    expect((await getDb(page)).items).toHaveLength(6);
  });

  test('A15 Esc in the delete confirmation closes only the confirmation', async ({ page }) => {
    await openApp(page);
    await openMenu(page, 'Item A', 'edit');
    await page.locator('#delItem').click();
    await expect(page.locator('#cdlg')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#cdlg')).toBeHidden();
    await expect(page.locator('#dlg')).toBeVisible();
  });

  test('A17 deleting a gift removes it after confirming', async ({ page }) => {
    await openApp(page);
    await openMenu(page, 'Item B', 'edit');
    await page.locator('#delItem').click();
    await page.locator('#cYes').click();
    await expect(card(page, 'Item B')).toHaveCount(0);
    expect(await itemNames(page)).toEqual(['Item A', 'Item C']);
    expect((await getDb(page)).items.find((i) => i.id === 'i-b')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
test.describe('Owner: categories and title', () => {
  test('A10a creating a category sends the wishlist id and selects it', async ({ page }) => {
    await openApp(page);
    await page.locator('#addCat').click();
    await page.locator('#catName').fill('Toys');
    await page.locator('#catSave').click();
    await expect(page.locator('.nbanner.success')).toContainText('Category created');
    const row = (await getDb(page)).categories.find((c) => c.name === 'Toys');
    expect(row.wishlist_id).toBe('w1');
    await expect(page.locator('.chipg .chip-main')).toContainText('Toys');
  });

  test('A10b a duplicate category name in different case is rejected', async ({ page }) => {
    await openApp(page);
    await page.locator('#addCat').click();
    await page.locator('#catName').fill('books');
    await page.locator('#catSave').click();
    await expect(page.locator('#catDlg .tip')).toContainText('already have a category');
    expect((await getDb(page)).categories).toHaveLength(3);
  });

  test('A10c double-tapping Save category creates exactly one', async ({ page }) => {
    await openApp(page, { delayMs: 400 });
    await page.locator('#addCat').click();
    await page.locator('#catName').fill('Once');
    await page.locator('#catSave').dblclick();
    await expect(page.locator('#catDlg')).toBeHidden();
    expect((await getDb(page)).categories.filter((c) => c.name === 'Once')).toHaveLength(1);
  });

  test('A11 deleting a category states the gift count, then deletes its gifts', async ({ page }) => {
    await openApp(page);
    await page.locator('button.chip[data-c="c-books"]').click();
    await page.locator('.chip-edit').click();
    await page.locator('#catDel').click();
    await expect(page.locator('#cMsg')).toContainText('2 gifts');
    await page.locator('#cYes').click();
    await expect(page.locator('#cats [data-c="c-books"]')).toHaveCount(0);
    const db = await getDb(page);
    expect(db.items.filter((i) => i.category_id === 'c-books')).toHaveLength(0);
  });

  test('A12 the Default category has no delete button; others do', async ({ page }) => {
    await openApp(page);
    await page.locator('.chip-edit').click();                                        // Default is selected
    await expect(page.locator('#catDlg')).toBeVisible();
    await expect(page.locator('#catDelWrap')).toBeHidden();
    await page.locator('#catDlg [data-close]').click();
    await page.locator('button.chip[data-c="c-books"]').click();
    await page.locator('.chip-edit').click();
    await expect(page.locator('#catDelWrap')).toBeVisible();
  });

  test('A14 long-pressing a tab opens the edit pop-up', async ({ page }) => {
    await openApp(page);
    const tab = page.locator('button.chip[data-c="c-books"]');
    await tab.hover();
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(page.locator('#catDlg')).toBeVisible();
    await expect(page.locator('#catTitle')).toHaveText('Edit category');
    await expect(page.locator('#catName')).toHaveValue('Books');
  });

  test('A9a editing the title saves it', async ({ page }) => {
    await openApp(page);
    await page.locator('#title').fill('Birthday 2027');
    await page.locator('#title').press('Enter');
    await expect.poll(async () => (await getDb(page)).wishlists[0].title).toBe('Birthday 2027');
  });

  test('A9b clearing the title reverts it with a message', async ({ page }) => {
    await openApp(page);
    await page.locator('#title').fill('');
    await page.locator('#title').press('Enter');
    await expect(page.locator('#title')).toHaveText('My wishlist');
    await expect(page.locator('.head .tip')).toContainText('needs a title');
    expect((await getDb(page)).wishlists[0].title).toBe('My wishlist');
  });
});

/* ------------------------------------------------------------------ */
test.describe('Sharing dialog', () => {
  test('S1 shows the site address and copies it', async ({ page }) => {
    await openApp(page);
    await page.locator('#share').click();
    await expect(page.locator('#shUrl')).toHaveValue('http://localhost:4173/');
    await page.locator('#shCopy').click();
    await expect(page.locator('#shDlg .nbanner')).toContainText('Link copied');
  });
});

/* ------------------------------------------------------------------ */
// Note: the fake database applies the same read rules as the real one
// (non-owners don't get got items or empty categories), so these check
// that the app displays that data correctly. The real rules are tested
// with the SQL files in supabase/tests/.
test.describe('Signed-in viewer (not the owner)', () => {
  test('V1 read-only: no edit controls, view-only note, title locked', async ({ page }) => {
    await openApp(page, { session: VIEWER });
    await expect(page.locator('body')).toHaveClass(/viewer/);
    await expect(page.locator('#add')).toBeHidden();
    await expect(page.locator('#share')).toBeHidden();
    await expect(page.locator('#addCat')).toBeHidden();
    await expect(page.locator('#reorderBtn')).toBeHidden();
    await expect(page.locator('.edit').first()).toBeHidden();
    await expect(page.locator('.chip-edit').first()).toBeHidden();
    await expect(page.locator('#viewNote')).toHaveText('View-only');
    await expect(page.locator('#title')).toHaveAttribute('contenteditable', 'false');
    await expect(page.locator('#signout-btn')).toBeVisible();
  });

  test('V2 got gifts are not shown', async ({ page }) => {
    await openApp(page, { session: VIEWER });
    expect(await itemNames(page)).toEqual(['Item A', 'Item B']);
  });

  test('V3 a category with only got gifts is hidden', async ({ page }) => {
    await openApp(page, { session: VIEWER });
    await expect(page.locator('#cats [data-c]')).toHaveCount(2);
    await expect(page.locator('#cats [data-c="c-archive"]')).toHaveCount(0);
  });

  test('V4 viewer can switch categories', async ({ page }) => {
    await openApp(page, { session: VIEWER });
    await page.locator('button.chip[data-c="c-books"]').click();
    expect(await itemNames(page)).toEqual(['Book D', 'Book E']);
  });

  test('V5 viewer makes no write calls just by browsing', async ({ page }) => {
    await openApp(page, { session: VIEWER });
    await page.locator('button.chip[data-c="c-books"]').click();
    const writes = (await getLog(page)).filter((e) => e.table && e.op !== 'select');
    expect(writes).toHaveLength(0);
  });

  test('V6 long-pressing a tab does not open the edit pop-up for a viewer', async ({ page }) => {
    await openApp(page, { session: VIEWER });
    await page.locator('button.chip[data-c="c-books"]').hover();
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(page.locator('#catDlg')).toBeHidden();
  });
});