// app.js - Supabase-backed Wishlist App

function renderLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';

  const loginBtn = document.getElementById('login-btn');
  if (loginBtn && !loginBtn.dataset.listenerAttached) {
    loginBtn.dataset.listenerAttached = 'true';
    loginBtn.onclick = async () => {
      const email = document.getElementById('login-email').value.trim();
      if (!email) return;

      const status = document.getElementById('login-status');
      status.textContent = 'Sending magic link...';

      const { error } = await db.auth.signInWithOtp({ email });
      status.textContent = error ? error.message : 'Check your email for the sign-in link!';
    };
  }
}

// --- Check Auth & Toggle Google Login Button ---
async function checkAuthAndToggleUI() {
  var googleBtn = document.getElementById("google-login-btn");
  if (!googleBtn) return;

  try {
    var sessionRes = await db.auth.getSession();
    var session = sessionRes && sessionRes.data && sessionRes.data.session;

    if (session && session.user) {
      // User is logged in: Hide the Google Sign-In button
      googleBtn.style.display = "none";
    } else {
      // User is logged out: Show the Google Sign-In button
      googleBtn.style.display = "inline-block";
    }
  } catch (e) {
    console.error("Error checking auth status for UI", e);
  }
}

function renderOwnerApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  console.log("Loading owner app interface...");
}

(function () {
  var VIEW = false, SNAP = null, KEY = "wishlist-v3", state = null, editId = null, img = "", reorder = false, catIcon = "🎁", catEdit = null, delArm = false, itemDelArm = false;
  var $ = function (id) { return document.getElementById(id) };
  var IC = {
    plus: "M12 5v14M5 12h14", check: "M5 12.5l4.5 4.5L19 7.5", x: "M6 6l12 12M18 6L6 18", back: "M15 5l-7 7 7 7",
    share: "M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7",
    link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    pencil: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    ext: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
    reorder: "M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3",
    grip: "M5 9h14M5 15h14", image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01",
    gift: "M3 8h18v4H3zM12 8v13M5 12v8h14v-8M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5",
    heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
    star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
    home: "M4 11l8-7 8 7M6 10v10h12V10",
    cake: "M4 20h16v-6H4zM4 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M12 9V5",
    book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h10",
    shirt: "M8 4L3 7l2 4 3-1v10h8V10l3 1 2-4-5-3a4 4 0 0 1-8 0z",
    game: "M7 9h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5 2l-1-1H9l-1 1a3 3 0 0 1-5-2v-1a4 4 0 0 1 4-4zM8 11v3M6.5 12.5h3",
    plane: "M21 4L3 11l7 3 3 7 8-17z", tag: "M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01", info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-5M12 8h.01", ok: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.5 2.5L16 9.5", warn: "M12 3l10 18H2zM12 10v4M12 17h.01", bad: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6"
  };
  var CAT_ICONS = ["🎁", "❤️", "⭐", "🏠", "🎂", "📚", "👕", "🎮", "✈️", "🏷️", "🎧", "👟", "🌿", "☕", "🎨"];
  function ic(n, s) { return '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + IC[n] + '"/></svg>' }
  [].forEach.call(document.querySelectorAll("i[data-ic]"), function (el) { el.outerHTML = ic(el.dataset.ic, +el.dataset.s || 18) });

  state = { title: "My wishlist", categories: [], items: [], cur: null, sharing: false };

  async function loadFromSupabase() {
    try {
      var catRes = await db.from('categories').select('*').order('sort_order', { ascending: true });
      if (!catRes.error && catRes.data && catRes.data.length > 0) {
        state.categories = catRes.data.map(function (c) {
          return { id: c.id, name: c.name, icon: c.icon || '🎁', isDefault: !!c.is_default };
        });
        if (!state.categories.some(function (c) { return c.isDefault })) state.categories[0].isDefault = true;
      } else {
        state.categories = [{ id: "main", name: "Default", icon: "🎁", isDefault: true }];
      }

      var itemRes = await db.from('items').select('*').order('sort_order', { ascending: true });
      if (!itemRes.error && itemRes.data) {
        state.items = itemRes.data.map(function (i) {
          return {
            id: i.id,
            categoryId: i.category_id,
            name: i.name,
            price: i.price,
            link: i.link,
            note: i.note,
            img: i.img,
            got: i.got || false,
            sortOrder: i.sort_order
          };
        });
      }

      if (!state.cur || !state.categories.some(function (l) { return l.id === state.cur })) {
        state.cur = state.categories[0].id;
      }

      render();
      showCat();
    } catch (err) {
      console.error("Failed to load data from Supabase:", err);
      toast("Error loading wishlist data.");
    }
  }

  function save() { }
  var titleT = null;
  function saveTitle(t) {
    clearTimeout(titleT);
    titleT = setTimeout(async function () {
      if (VIEW || !state.wishlistId) return;
      var { error } = await db.from('wishlists').update({ title: t }).eq('id', state.wishlistId);
      if (error) toast("Error saving title: " + error.message);
    }, 600);
  }
  function nextSort(catId) {
    var m = -1;
    state.items.forEach(function (i) { if (i.categoryId === catId && (i.sortOrder || 0) > m) m = i.sortOrder || 0 });
    return m + 1;
  }
  async function persistOrder(ids) {
    var results = await Promise.all(ids.map(function (id, n) {
      return db.from('items').update({ sort_order: n }).eq('id', id);
    }));
    if (results.some(function (r) { return r.error })) toast("Error saving the new order");
  }
  function money(n) { return "₱" + (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] }) }
  document.querySelectorAll("dialog").forEach(function (d) { d.addEventListener("close", function () { var s = d.querySelector(".slot"); if (s) s.innerHTML = ""; clearTimeout(notifyT) }) });
  var attnDone = false;
  function pulseFab() { var f = $("add"); if (attnDone || !f.classList.contains("attn")) return; f.classList.remove("ring-on"); void f.offsetWidth; f.classList.add("ring-on") }
  setTimeout(pulseFab, 1000); setInterval(pulseFab, 10000);
  var KIND = { info: ["info", "info"], success: ["ok", "success"], warning: ["warn", "warning"], error: ["bad", "error"] }, notifyT = null;
  function notify(kind, msg) {
    setTimeout(function () { showNotice(kind, msg) }, 0);
  }
  function showNotice(kind, msg) {
    var k = KIND[kind] || KIND.info, open = document.querySelector("dialog[open]"), host = (open && open.querySelector(".slot")) || $("banners");
    host.innerHTML = ""; clearTimeout(notifyT);
    var el = document.createElement("div"); el.className = "nbanner " + k[1]; el.setAttribute("role", kind === "error" ? "alert" : "status");
    el.innerHTML = ic(k[0], 20) + '<p class="bmsg">' + esc(msg) + '</p><button type="button" class="bx" aria-label="Dismiss" title="Dismiss">' + ic("x", 16) + '</button>';
    host.appendChild(el);
    var go = function () { clearTimeout(notifyT); el.remove() };
    el.querySelector(".bx").onclick = go;
    notifyT = setTimeout(go, 5000);
  }
  function toast(m) {
    var k = "info";
    if (/couldn|can’t|only |not |enter|add a|add at least|valid|too big|isn’t|needs|try|press and hold|give /i.test(m)) k = "warning";
    if (/added|created|saved|updated|deleted|removed|marked|back on|copied|clipboard/i.test(m)) k = "success";
    if (/^error|storage|went wrong|could not save/i.test(m)) k = "error";
    notify(k, m);
  }
  function safeLink(u) { try { var x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : "" } catch (e) { return "" } }
  function fixUrl(u) { u = u.trim(); if (u && !/^https?:\/\//i.test(u)) u = "https://" + u; return u }
  function curCategory() { return state.categories.filter(function (l) { return l.id === state.cur })[0] }
  function curItems() { return state.items.filter(function (i) { return i.categoryId === state.cur }) }

  /* ---------- render ---------- */
  function render() {
    $("title").textContent = state.title; document.title = state.title;
    $("cats").innerHTML = state.categories.map(function (c) {
      var on = c.id === state.cur, inner = '<span aria-hidden="true">' + c.icon + '</span>' + esc(c.name);
      return on ? '<div class="chipg"><button class="chip-main" data-c="' + c.id + '" aria-pressed="true">' + inner + '</button><button class="chip-edit" data-edit="' + c.id + '" aria-label="Edit category ' + esc(c.name) + '">' + ic("pencil", 14) + '</button></div>' : '<button class="chip" data-c="' + c.id + '" aria-pressed="false">' + inner + '</button>';
    }).join("");
    var items = curItems();
    $("rbar").hidden = !reorder;
    $("reorderBtn").hidden = reorder;
    $("reorderBtn").disabled = curItems().length < 2;
    $("addCat").classList.toggle("compact", state.categories.length >= 3);
    var ul = $("list");
    $("add").classList.toggle("attn", !items.length && !VIEW && !attnDone);
    if (!items.length) {
      ul.innerHTML = '<li class="empty"><div class="pic" style="margin:0 auto;background:transparent">' + ic("gift", 30) + '</div><h2>This category is empty</h2><p>' + (VIEW ? "Check back soon." : "Tap Add a gift below to add the first thing you’d love to receive.") + '</p></li>';
      return;
    }
    ul.innerHTML = items.map(function (i, n) {
      var l = i.link ? safeLink(i.link) : "";
      return '<li class="item' + (i.got ? " got" : "") + (reorder ? " reorder" : "") + '" data-id="' + i.id + '">' +
        '<span class="num">' + (n + 1) + '</span><div class="pic">' + (i.img ? '<img src="' + esc(i.img) + '" alt="">' : ic("gift", 26)) + '</div><div>' +
        '<p class="name">' + (l ? '<a href="' + esc(l) + '" target="_blank" rel="noopener noreferrer">' + esc(i.name) + ic("link", 14) + '</a>' : esc(i.name)) + '</p>' +
        '<div class="meta">' + (i.price ? '<span class="price">' + money(+i.price) + '</span>' : "") +
        (i.got ? '<span class="tag ok">Got it</span>' : "") + '</div>' +
        (i.note ? '<p class="note">' + esc(i.note) + '</p><button class="more" data-a="more" aria-expanded="false" hidden>Show more</button>' : "") + '</div>' +
        (reorder ? '<div class="grip" role="button" aria-label="Drag to reorder ' + esc(i.name) + '">' + ic("grip", 22) + '</div>' :
          '<button class="edit" data-a="menu" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ' + esc(i.name) + '">' + DOTS + '</button>' +
          '<div class="menu" role="menu" hidden><button role="menuitem" data-a="got">' + ic("check", 18) + (i.got ? "Mark as not got" : "Mark as got") + '</button><button role="menuitem" data-a="edit">' + ic("pencil", 18) + 'Edit gift</button></div>') + '</li>';
    }).join("");
    measureNotes();
  }
  var DOTS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  function measureNotes() { [].forEach.call(document.querySelectorAll(".note"), function (n) { var b = n.nextElementSibling; if (!b || !b.classList.contains("more")) return; b.hidden = n.classList.contains("open") ? false : !(n.scrollHeight > n.clientHeight + 1) }) }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureNotes);
  window.addEventListener("resize", measureNotes);

  /* ---------- drag to reorder ---------- */
  $("list").addEventListener("pointerdown", function (e) {
    var g = e.target.closest(".grip"); if (!g) return;
    e.preventDefault();
    var ul = $("list"), li = g.closest(".item"); li.classList.add("drag");
    function mv(ev) {
      var y = ev.clientY;
      if (y < 70) window.scrollBy(0, -12); else if (y > innerHeight - 70) window.scrollBy(0, 12);
      var sibs = [].filter.call(ul.children, function (c) { return c !== li }), placed = false;
      for (var k = 0; k < sibs.length; k++) { var r = sibs[k].getBoundingClientRect(); if (y < r.top + r.height / 2) { if (li.nextElementSibling !== sibs[k]) ul.insertBefore(li, sibs[k]); placed = true; break } }
      if (!placed && ul.lastElementChild !== li) ul.appendChild(li);
    }
    function up() {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      var ids = [].map.call(ul.children, function (c) { return c.dataset.id });
      var mine = curItems(), byId = {}; mine.forEach(function (i) { byId[i.id] = i });
      state.items = state.items.filter(function (i) { return i.categoryId !== state.cur }).concat(ids.map(function (id, n) { byId[id].sortOrder = n; return byId[id] }));
      render();
      persistOrder(ids);
    }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });

  /* ---------- cats ---------- */
  function openCatDlg(l) {
    if (VIEW) return;
    catEdit = l || null; delArm = false;
    $("catTitle").textContent = l ? "Edit category" : "New category";
    $("catName").value = l ? l.name : "";

    setCatIcon(l ? l.icon : "🎁"); refreshCounts(); clearErr($("catName"));
    $("catDelWrap").hidden = !l || l.isDefault || l.id === "main" || state.categories.length < 2;
    $("catDel").innerHTML = ic("trash") + "<span>Delete category</span>";
    $("catDlg").showModal();
  }
  function setCatIcon(n) { catIcon = n; $("catEmoji").value = n; $("catIcons").innerHTML = CAT_ICONS.map(function (k) { return '<button type="button" data-i="' + k + '" aria-pressed="' + (k === n) + '">' + k + '</button>' }).join("") }
  var EMO = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?)*)/gu;
  $("catEmoji").addEventListener("input", function () {
    var m = this.value.match(EMO);
    if (m && m.length) setCatIcon(m[m.length - 1]); else this.value = catIcon;
  });
  $("catIcons").onclick = function (e) { var b = e.target.closest("button"); if (b) setCatIcon(b.dataset.i) };
  $("catDlg").addEventListener("click", function (e) { if (e.target === $("catDlg") || e.target.closest("[data-close]")) $("catDlg").close() });

  async function doCatSave() {
    var name = $("catName").value.trim();
    if (!name) { setErr($("catName"), "Enter a category name"); return }
    if (state.categories.some(function (c) { return c !== catEdit && c.name.trim().toLowerCase() === name.toLowerCase() })) { setErr($("catName"), "You already have a category with this name"); return }

    if (catEdit) {
      var { error } = await db.from('categories').update({ name: name, icon: catIcon }).eq('id', catEdit.id);
      if (error) { toast("Error updating category"); return; }
      catEdit.name = name; catEdit.icon = catIcon; toast("Category updated");
    } else {
      var { data, error } = await db.from('categories').insert([{ wishlist_id: state.wishlistId, name: name, icon: catIcon, sort_order: state.categories.length + 1 }]).select().single();
      if (error) { toast("Error creating category: " + error.message); return; }
      var l = { id: data.id, name: data.name, icon: data.icon, isDefault: false };
      state.categories.push(l); state.cur = l.id; reorder = false; toast("Category created");
    }
    render(); showCat(); $("catDlg").close();
  }
  var catSaving = false;
  $("catSave").onclick = async function () {
    if (catSaving) return;
    catSaving = true; $("catSave").disabled = true;
    try { await doCatSave() } finally { catSaving = false; $("catSave").disabled = false }
  };

  $("catDel").onclick = function () {
    var id = catEdit.id, cnt = state.items.filter(function (i) { return i.categoryId === id }).length;
    askConfirm("Delete this category?", "“" + catEdit.name + "” and its " + cnt + (cnt === 1 ? " gift" : " gifts") + " will be deleted. This can’t be undone.", function () { doDelCat(id) });
  };

  async function doDelCat(id) {
    var { error } = await db.from('categories').delete().eq('id', id);
    if (error) { toast("Error deleting category"); return; }
    state.items = state.items.filter(function (i) { return i.categoryId !== id });
    state.categories = state.categories.filter(function (l) { return l.id !== id });
    state.cur = state.categories[0].id; reorder = false; render(); showCat(); $("catDlg").close(); toast("Category deleted");
  };

  var lpT = null, lpFired = false, lpX = 0, lpY = 0;
  function lpCancel() { clearTimeout(lpT); lpT = null }
  $("cats").addEventListener("pointerdown", function (e) {
    lpFired = false;
    var b = e.target.closest("[data-c]"); if (!b) return;
    lpX = e.clientX; lpY = e.clientY;
    lpT = setTimeout(function () { lpT = null; lpFired = true; if (navigator.vibrate) { try { navigator.vibrate(12) } catch (x) { } } openCatDlg(state.categories.filter(function (c) { return c.id === b.dataset.c })[0]) }, 500);
  });
  $("cats").addEventListener("pointermove", function (e) { if (lpT && (Math.abs(e.clientX - lpX) > 8 || Math.abs(e.clientY - lpY) > 8)) lpCancel() });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { $("cats").addEventListener(t, lpCancel) });
  $("cats").addEventListener("contextmenu", function (e) { e.preventDefault() });
  function showCat() {
    function go() {
      var c = $("cats"), el = c.querySelector(".chipg"); if (!el) return;
      var cr = c.getBoundingClientRect(), r = el.getBoundingClientRect(), max = Math.max(0, c.scrollWidth - c.clientWidth), t = c.scrollLeft;
      if (r.right > cr.right) t += r.right - cr.right + 4; else if (r.left < cr.left) t -= cr.left - r.left + 4;
      c.scrollLeft = Math.max(0, Math.min(max, t));
    }
    requestAnimationFrame(go); setTimeout(go, 120);
  }
  $("addCat").onclick = function () { openCatDlg() };
  $("cats").onclick = function (e) {
    if (lpFired) { lpFired = false; return }
    var ed = e.target.closest("[data-edit]");
    if (ed) { openCatDlg(state.categories.filter(function (c) { return c.id === ed.dataset.edit })[0]); return }
    var b = e.target.closest("[data-c]"); if (!b) return;
    if (b.dataset.c === "__new") { openCatDlg(); return }
    state.cur = b.dataset.c; reorder = false; render(); showCat();
  };
  $("reorderDone").onclick = function () { reorder = false; render() };

  /* ---------- add / edit item ---------- */
  function setImg(src) { img = src || ""; $("fPic").innerHTML = img ? '<img src="' + esc(img) + '" alt="">' : ic("gift", 26); $("clrImg").hidden = !img; $("pickImg").innerHTML = ic("image") + "<span>" + (img ? "Change photo" : "Add photo") + "</span>" }
  function show(n) { $("s1").hidden = n !== 1; $("s2").hidden = n !== 2; var sb = $("dlg").querySelector(".sbody"); sb.scrollTop = 0; sb.focus({ preventScroll: true }) }
  function isValidUrl(u) {
    if (!u || /\s/.test(u) || !safeLink(u)) return false;
    try { return /^([a-z0-9-]+\.)+[a-z][a-z0-9-]{1,}$/i.test(new URL(u).hostname) } catch (e) { return false }
  }
  function guessName(u) {
    try {
      var url = new URL(u), dec = function (x) { try { return decodeURIComponent(x) } catch (e) { return x } };
      var isId = function (t) { return /^\d{6,}$/.test(t) || /^B0[A-Z0-9]{8}$/i.test(t) || (t.length >= 10 && /\d/.test(t) && /[a-z]/i.test(t)) };
      var best = [];
      url.pathname.split("/").map(dec).filter(function (x) { return /[a-z]{3,}/i.test(x) && !/^(dp|gp|product|products|p|item|itm|ip|pd|shop|buy)$/i.test(x) }).forEach(function (x) {
        x = x.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_]i\.?\d+([.\-]s?\d+)*$/i, "");
        var w = x.split(/[-_+ ]+/).filter(function (t) { return t && !isId(t) });
        if (w.length > best.length) best = w;
      });
      if (!best.length) ["title", "name", "product", "q", "keywords", "k"].some(function (k) { var v = url.searchParams.get(k); if (v && /[a-z]{3,}/i.test(v)) { best = v.split(/[-_+ ]+/).filter(Boolean); return true } return false });
      var out = [];
      for (var k = 0; k < best.length; k++) {
        var t = best[k], nx = best[k + 1];
        if (/^[A-Za-z]{1,3}$/.test(t) && nx && /^\d{4,}[A-Za-z]+\d*$/.test(nx)) { out.push(t.toUpperCase() + "-" + nx.toUpperCase()); k++; continue }
        if (/^[a-z]{0,2}\d+[a-z]*\d*$/i.test(t) && /\d/.test(t)) out.push(t.toUpperCase());
        else if (t === t.toUpperCase() && t.length <= 4) out.push(t);
        else if (t === t.toLowerCase()) out.push(t.charAt(0).toUpperCase() + t.slice(1));
        else out.push(t);
      }
      return out.join(" ").slice(0, 80);
    } catch (e) { return "" }
  }
  function fill(d) {
    $("fCat").innerHTML = state.categories.map(function (l) { return '<option value="' + l.id + '">' + l.icon + ' ' + esc(l.name || "Default category") + '</option>' }).join("");
    $("fCat").value = d.categoryId || state.cur;
    $("fName").value = d.name || ""; $("fPrice").value = d.price || ""; $("fLink").value = d.link || ""; $("fNote").value = d.note || "";
    setImg(d.img || ""); refreshCounts(); clearErr($("fName")); clearErr($("fLink")); clearErr($("fPrice"));
  }
  function openFlow(item) {
    editId = item ? item.id : null;
    $("fUrl").value = ""; clearErr($("fUrl")); fill(item || {}); $("banner").hidden = true;
    $("dTitle").textContent = item ? "Edit gift" : "Check the details";
    $("step2").hidden = !!item; $("back").hidden = !!item;
    $("delWrap").hidden = !item; itemDelArm = false; $("delItem").innerHTML = ic("trash") + "<span>Delete gift</span>";
    show(item ? 2 : 1); $("dlg").showModal();
  }
  function fromLink() {
    var u = fixUrl($("fUrl").value);
    if (!u) { setErr($("fUrl"), "Paste a link, or choose Add manually"); return }
    if (!isValidUrl(u)) { setErr($("fUrl"), "That doesn’t look like a valid link"); return }
    var host = new URL(u).hostname.replace(/^www\./, ""), nm = guessName(u);
    fill({ link: u, name: nm });
    $("banner").hidden = false;
    $("banner").textContent = (nm ? "We filled in the name from the link on " + host + ". " : "We couldn’t read a name from this link. ") + "Add the price and a photo below — this page can’t open store pages to read them.";
    show(2);
  }

  async function doSubmit() {
    var name = $("fName").value.trim();
    if (!name) { setErr($("fName"), "Add a gift name to continue"); return }
    var link = fixUrl($("fLink").value);
    if (link && !isValidUrl(link)) { setErr($("fLink"), "Enter a valid link, like https://store.com/item"); return }
    var pv = $("fPrice").value.trim();
    if (pv !== "" && !isFinite(+pv)) { setErr($("fPrice"), "Enter a valid price"); return }
    if (pv !== "" && +pv < 0) { setErr($("fPrice"), "Price can’t be negative"); return }

    var data = {
      category_id: $("fCat").value,
      img: img,
      name: name,
      price: parseFloat(pv) || 0,
      link: link,
      note: $("fNote").value.trim()
    };

    if (editId) {
      var it = state.items.filter(function (i) { return i.id === editId })[0];
      if (it.categoryId !== data.category_id) data.sort_order = nextSort(data.category_id);
      var { error: updateError } = await db.from('items').update(data).eq('id', editId);
      if (updateError) {
        toast("Error updating gift: " + updateError.message);
        return;
      }

      if (it.categoryId !== data.category_id) {
        state.items = state.items.filter(function (i) { return i !== it });
        state.items.push(it);
      }
      Object.assign(it, {
        categoryId: data.category_id,
        name: data.name,
        price: data.price,
        link: data.link,
        note: data.note,
        img: data.img,
        sortOrder: data.sort_order !== undefined ? data.sort_order : it.sortOrder
      });
      toast("Gift updated");
    } else {
      data.got = false;
      data.sort_order = nextSort(data.category_id);
      var { data: savedItem, error } = await db.from('items').insert([data]).select().single();

      if (error) {
        toast("Error saving gift: " + error.message);
        return;
      }

      state.items.push({
        id: savedItem.id,
        categoryId: savedItem.category_id,
        name: savedItem.name,
        price: savedItem.price,
        link: savedItem.link,
        note: savedItem.note,
        img: savedItem.img,
        got: savedItem.got || false,
        sortOrder: savedItem.sort_order
      });
      toast("Gift added");
    }

    $("dlg").close();
    render();
    showCat();
  }

  function resize(file) {
    var r = new FileReader();
    r.onload = function () {
      var im = new Image(); im.onload = function () {
        var s = Math.min(1, 360 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); setImg(c.toDataURL("image/jpeg", .8));
      }; im.onerror = function () { toast("Couldn’t read that image") }; im.src = r.result
    };
    r.readAsDataURL(file);
  }
  function refreshCounts() { [].forEach.call(document.querySelectorAll("[data-max]"), function (el) { var c = el.parentNode.querySelector(".cc"); if (c) c.textContent = el.value.length + "/" + el.dataset.max }) }
  [].forEach.call(document.querySelectorAll("[data-max],[data-req]"), function (el) {
    var w = document.createElement("div"); w.className = "fw" + (el.tagName === "TEXTAREA" ? " ta" : "") + (el.dataset.max ? " has" : "");
    el.parentNode.insertBefore(w, el); w.appendChild(el);
    if (el.dataset.max) { el.maxLength = +el.dataset.max; var c = document.createElement("span"); c.className = "cc"; c.setAttribute("aria-hidden", "true"); w.appendChild(c); el.addEventListener("input", refreshCounts) }
  });
  refreshCounts();
  function clearErr(el) { el.classList.remove("err"); el.removeAttribute("aria-invalid"); var w = el.closest(".fw") || el.parentNode, t = w.querySelector(".tip"); if (t) t.remove() }
  function setErr(el, msg, nf) {
    clearErr(el); var w = el.closest(".fw") || el.parentNode;
    el.classList.add("err"); el.setAttribute("aria-invalid", "true");
    var t = document.createElement("div"); t.className = "tip"; t.setAttribute("role", "alert"); t.textContent = msg; w.appendChild(t); if (!nf) el.focus();
  }
  ["fName", "fLink", "fUrl", "fPrice", "catName"].forEach(function (id) { $(id).addEventListener("input", function () { clearErr($(id)) }) });
  var confirmCb = null;
  function askConfirm(t, m, cb) { $("cTitle").textContent = t; $("cMsg").textContent = m; confirmCb = cb; $("cdlg").showModal() }
  $("cYes").onclick = function () { var f = confirmCb; confirmCb = null; $("cdlg").close(); if (f) f() };
  $("cdlg").addEventListener("click", function (e) { if (e.target === $("cdlg") || e.target.closest("[data-close]")) $("cdlg").close() });
  $("add").onclick = function () { attnDone = true; $("add").classList.remove("ring-on"); reorder = false; render(); openFlow() };
  $("dlg").addEventListener("click", function (e) { if (e.target === $("dlg") || e.target.closest("[data-close]")) $("dlg").close() });
  $("useLink").onclick = fromLink;
  [["fUrl", "That doesn’t look like a valid link"], ["fLink", "Enter a valid link, like https://store.com/item"]].forEach(function (p) { var el = $(p[0]); el.addEventListener("blur", function () { var v = el.value.trim(); if (v && !isValidUrl(fixUrl(v))) setErr(el, p[1], true) }) });
  $("fPrice").addEventListener("keydown", function (e) { if (["-", "+", "e", "E"].indexOf(e.key) > -1) e.preventDefault() });
  $("fUrl").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); fromLink() } });
  $("manual").onclick = function () { fill({}); $("banner").hidden = true; show(2) };
  $("back").onclick = function () { show(1) };
  var saving = false;
  async function submit() {
    if (saving) return;
    saving = true; $("save").disabled = true;
    try { await doSubmit() } finally { saving = false; $("save").disabled = false }
  }
  $("save").onclick = submit;
  $("s2").addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); submit() } });

  $("delItem").onclick = async function () {
    var id = editId, it = state.items.filter(function (i) { return i.id === id })[0];
    askConfirm("Delete this gift?", "“" + (it ? it.name : "This gift") + "” will be removed from your list. This can’t be undone.", async function () {
      var { error } = await db.from('items').delete().eq('id', id);
      if (error) { toast("Error deleting gift"); return; }
      state.items = state.items.filter(function (i) { return i.id !== id });
      render();
      $("dlg").close();
      toast("Gift deleted");
    });
  };

  $("pickImg").onclick = function () { $("fFile").click() };
  $("clrImg").onclick = function () { setImg("") };
  $("fFile").onchange = function () { if (this.files[0]) resize(this.files[0]); this.value = "" };

  $("list").onclick = async function (e) {
    var b = e.target.closest("[data-a]");
    if (!b) { closeMenus(); return }
    var a = b.dataset.a;
    if (a === "new") { openFlow(); return }
    if (a === "menu") { toggleMenu(b); return }
    if (a === "more") { var n = b.previousElementSibling, o = n.classList.toggle("open"); b.textContent = o ? "Show less" : "Show more"; b.setAttribute("aria-expanded", String(o)); return }
    var id = b.closest("[data-id]").dataset.id;
    var it = state.items.filter(function (i) { return i.id === id })[0];
    if (a === "edit") { closeMenus(); openFlow(it); return }
    if (a === "got") {
      var prevGot = it.got;
      it.got = !it.got;
      var { error: gotErr } = await db.from('items').update({ got: it.got }).eq('id', id);
      if (gotErr) { it.got = prevGot; toast("Error updating gift: " + gotErr.message); render(); return; }
      toast(it.got ? "Marked as got" : "Back on the list");
    }
    render();
  };
  $("reorderBtn").onclick = function () { if (curItems().length < 2) { toast("Add at least two gifts to reorder."); return } reorder = true; render() };
  function closeMenus() { [].forEach.call(document.querySelectorAll(".menu"), function (m) { m.hidden = true; var li = m.parentNode; li.classList.remove("menu-open"); var t = li.querySelector("[data-a=menu]"); if (t) t.setAttribute("aria-expanded", "false") }) }
  function toggleMenu(btn) { var li = btn.closest(".item"), m = li.querySelector(".menu"), was = !m.hidden; closeMenus(); if (!was) { m.hidden = false; li.classList.add("menu-open"); btn.setAttribute("aria-expanded", "true"); m.querySelector("button").focus() } }
  document.addEventListener("click", function (e) { if (!e.target.closest(".item")) closeMenus() });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeMenus();
      document.querySelectorAll("dialog[open]").forEach(function (dlg) {
        dlg.close();
      });
    }
  });

  var SHARE_URL = "https://claude.ai/artifact/HWHiHzpmAnVa5BS4XBpyvi", LT = "<", pubT = null;
  try { SNAP = JSON.parse($("snap").textContent) } catch (e) { SNAP = null }
  function escTpl(t) { return t.split(LT + "/script").join(LT + "\\/script").split(LT + "!--").join(LT + "\\!--") }
  function unescTpl(t) { return t.split(LT + "\\/script").join(LT + "/script").split(LT + "\\!--").join(LT + "!--") }
  function buildHtml(data) { var T = unescTpl($("tpl").textContent), snap = JSON.stringify(data).replace(/</g, "\\u003c"); return T.replace(/@@(SNAP|TPL)@@/g, function (m, k) { return k === "SNAP" ? snap : escTpl(T) }) }
  function snapData() {
    if (!state.sharing) return { on: false, updated: Date.now() };
    var items = state.items.filter(function (i) { return !i.got });
    var cats = state.categories.filter(function (c) { return items.some(function (i) { return i.categoryId === c.id }) });
    return { on: true, updated: Date.now(), title: state.title, categories: cats, items: items.map(function (i) { return { id: i.id, categoryId: i.categoryId, name: i.name, price: i.price, link: i.link, note: i.note, img: i.img } }) };
  }
  function viewState() {
    var s = SNAP || {}, cats = (s.on && s.categories && s.categories.length) ? s.categories : [{ id: "x", name: "Wishlist", icon: "🎁" }];
    return { title: (s.on && s.title) || "Wishlist", categories: cats, items: s.on ? (s.items || []) : [], cur: cats[0].id };
  }
  function queuePub() { clearTimeout(pubT); pubT = setTimeout(tryPub, 5000) }
  function tryPub() { if (document.querySelector("dialog[open]") || reorder) { pubT = setTimeout(tryPub, 3000); return } doPub(false) }
  async function doPub(force) {
    clearTimeout(pubT);
    var art = null; try { art = window.claude && await claude.use("artifact") } catch (e) { }
    if (!art) { toast("Sharing isn’t available in this view"); return false }
    var data = snapData(), sig = JSON.stringify(Object.assign({}, data, { updated: 0 }));
    if (!force && sig === state.pubSig) return true;
    var prev = state.pubSig, prevAt = state.pubAt; state.pubSig = sig; state.pubAt = Date.now();
    try { sessionStorage.setItem("wl-y", String(scrollY)) } catch (e) { }
    try { await art.publish(buildHtml(data)); return true }
    catch (err) {
      state.pubSig = prev; state.pubAt = prevAt;
      var c = err && err.code;
      if (c === "conflict") return false;
      if (c === "rate_limited") { pubT = setTimeout(function () { doPub(false) }, 30000); return false }
      toast(c === "too_large" ? "Shared view is too big — try removing some photos" : (c === "not_writer" || c === "not_granted") ? "Only the owner can update the shared view" : "Couldn’t update the shared view");
      return false;
    }
  }
  function renderShare() {
    var b = $("shBody");
    if (creating) { b.innerHTML = '<p class="hint">Creating your view-only link…</p>'; return }
    if (!state.sharing) {
      b.innerHTML = '<p class="hint">Create a view-only link. Anyone you send it to can see your gifts but can’t change anything. Gifts you’ve marked as got stay hidden.</p><button class="btn primary wide" id="shOn">' + ic("link") + '<span>Create view-only link</span></button>';
    } else {
      b.innerHTML = '<p class="hint">Your view-only link updates automatically after every change.' + (state.pubAt ? ' Last updated ' + new Date(state.pubAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + '.' : '') + '</p><label for="shUrl">View-only link</label><input id="shUrl" readonly value="' + SHARE_URL + '"><div class="foot"><button class="btn primary" id="shCopy">' + ic("link") + '<span>Copy link</span></button>' + (navigator.share ? '<button class="btn" id="shSend">' + ic("share") + '<span>Share…</span></button>' : '') + '</div><p class="hint" style="margin-top:14px">For people without a Claude account to open it, set this page’s access to “Anyone with the link” in Claude’s Share menu.</p><button class="btn red-o wide" id="shOff" style="margin-top:10px">' + ic("trash") + '<span>Stop sharing</span></button>';
    }
  }
  var creating = false, noticeT = null;
  async function startShare() {
    if (state.sharing) { renderShare(); return }
    state.sharing = true; creating = true; renderShare();
    try { sessionStorage.setItem("wl-open", "1") } catch (x) { }
    var ok = await doPub(true);
    creating = false;
    if (!ok) { state.sharing = false; try { sessionStorage.removeItem("wl-open"); } catch (x) { } }
    renderShare();
  }
  function openShare() { if (!$("shDlg").open) $("shDlg").showModal(); startShare() }
  $("share").onclick = openShare;
  $("shDlg").addEventListener("click", async function (e) {
    if (e.target === $("shDlg") || e.target.closest("[data-close]")) { $("shDlg").close(); return }
    var b = e.target.closest("button"); if (!b) return;
    if (b.id === "shCopy") { var ok = false; try { await navigator.clipboard.writeText(SHARE_URL); ok = true } catch (x) { try { $("shUrl").select(); ok = document.execCommand("copy") } catch (y) { } } toast(ok ? "Link copied to your clipboard" : "Couldn’t copy automatically."); return }
    if (b.id === "shSend") { navigator.share({ title: state.title, url: SHARE_URL }).catch(function () { }); return }
    if (b.id === "shOn") { startShare(); return }
    if (b.id === "shOff") {
      state.sharing = false;
      try { sessionStorage.setItem("wl-open", "1") } catch (x) { }
      var ok = await doPub(true);
      if (!ok) { state.sharing = !state.sharing; renderShare() }
    }
  });

  async function boot() {
    document.body.classList.remove("pending");

    // Check actual Supabase session & wishlist ownership
    var sessionRes = await db.auth.getSession();
    var session = sessionRes && sessionRes.data && sessionRes.data.session;
    var wlRes = await db.from('wishlists').select('id, title, owner_id').limit(1).single();

    // Toggle the button visibility right away on boot
    await checkAuthAndToggleUI();

    var isOwner = !!(session && session.user && wlRes.data && session.user.id === wlRes.data.owner_id);

    if (!isOwner) {
      // Enforce read-only viewer mode for guests or non-owners
      VIEW = true;
      document.body.classList.add("viewer");
      $("title").contentEditable = "false";
      $("title").removeAttribute("aria-label");

      var n = $("viewNote");
      if (n) {
        n.hidden = false;
        n.textContent = "View-only";
      }
      var loginBtn = document.getElementById("owner-login-btn");
      if (loginBtn) {
        loginBtn.style.display = "inline-block";
        loginBtn.onclick = function () {
          renderLoginScreen(); // or trigger your Supabase auth modal/redirect
        };
      }
    } else {
      // Enable full owner editing
      VIEW = false;
      document.body.classList.remove("viewer");
      $("title").contentEditable = "true";
    }

    if (wlRes.data) {
      state.wishlistId = wlRes.data.id;
      if (wlRes.data.title) state.title = wlRes.data.title;
    }

    await loadFromSupabase();
  }
  $("title").addEventListener("input", function () { clearErr($("title")); var t = $("title").textContent.trim(); if (t) { state.title = t; saveTitle(t); document.title = t } });
  $("title").addEventListener("blur", function () { if (!$("title").textContent.trim()) { $("title").textContent = state.title; setErr($("title"), "Your wishlist needs a title", true); setTimeout(function () { clearErr($("title")) }, 2600) } });
  $("title").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); e.target.blur() } });

  boot();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(showCat);
})();

// --- Debug Panel Controller ---
async function updateDebugPanel() {
  var loggedInEl = document.getElementById('dbg-logged-in');
  var userIdEl = document.getElementById('dbg-user-id');
  var wishlistEl = document.getElementById('dbg-wishlist');
  var canEditEl = document.getElementById('dbg-can-edit');

  if (!loggedInEl) return;

  let userEmail = "None";
  var currentSession = null;

  // 1 & 2. Check auth status & user ID from Supabase session
  try {
    var sessionRes = await db.auth.getSession();
    currentSession = sessionRes && sessionRes.data && sessionRes.data.session;

    if (currentSession && currentSession.user) {
      loggedInEl.textContent = "Yes";
      loggedInEl.style.color = "#4ade80"; // green
      userIdEl.textContent = currentSession.user.id;
      userEmail = currentSession.user.email || "Unknown Email";
    } else {
      loggedInEl.textContent = "No (Anonymous / Guest)";
      loggedInEl.style.color = "#f87171"; // red
      userIdEl.textContent = "None";
    }
  } catch (e) {
    loggedInEl.textContent = "Error checking auth";
    userIdEl.textContent = "N/A";
  }

  // 3. Fetch whose wishlist we are viewing and show the full owner ID or email
  let ownerIdVal = "Unknown";
  try {
    var wlRes = await db.from('wishlists').select('id, title, owner_id').limit(1).single();
    if (!wlRes.error && wlRes.data) {
      var title = wlRes.data.title || "Wishlist";
      ownerIdVal = wlRes.data.owner_id || "None";

      var ownerDisplay = (currentSession && currentSession.user && currentSession.user.id === wlRes.data.owner_id)
        ? userEmail + " (" + ownerIdVal + ")"
        : "Owner ID: " + ownerIdVal;

      wishlistEl.textContent = title + " (" + ownerDisplay + ")";
    } else {
      wishlistEl.textContent = (state && state.title) ? state.title : "My wishlist (No row found)";
    }
  } catch (err) {
    wishlistEl.textContent = (state && state.title) ? state.title : "Default";
  }

  // 4. Check real edit permission (Logged in AND user ID matches owner_id)
  var isOwner = (currentSession && currentSession.user && currentSession.user.id === ownerIdVal);
  var isEditable = isOwner; // You can edit if you are the owner!
  canEditEl.textContent = isEditable ? "Yes (Owner)" : "No (View-only)";
  canEditEl.style.color = isEditable ? "#4ade80" : "#f87171";
}

// Wire up toggle behavior for the debug button
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("debug-toggle-btn");
  var panel = document.getElementById("debug-panel");
  var closeBtn = document.getElementById("debug-close");

  if (btn && panel) {
    btn.onclick = function () {
      var isVisible = panel.style.display === "block";
      panel.style.display = isVisible ? "none" : "block";
      if (!isVisible) {
        updateDebugPanel(); // Refresh stats whenever opened
      }
    };
  }

  if (closeBtn && panel) {
    closeBtn.onclick = function () {
      panel.style.display = "none";
    };
  }
});

// Periodically update debug info if panel is open
setInterval(function () {
  var panel = document.getElementById("debug-panel");
  if (panel && panel.style.display === "block") {
    updateDebugPanel();
  }
}, 3000);

// Wire up toggle behavior for the debug button
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("debug-toggle-btn");
  var panel = document.getElementById("debug-panel");
  var closeBtn = document.getElementById("debug-close");

  if (btn && panel) {
    btn.onclick = function () {
      var isVisible = panel.style.display === "block";
      panel.style.display = isVisible ? "none" : "block";
      if (!isVisible) {
        updateDebugPanel(); // Refresh stats whenever opened
      }
    };
  }

  if (closeBtn && panel) {
    closeBtn.onclick = function () {
      panel.style.display = "none";
    };
  }
});

// Periodically update debug info if panel is open
setInterval(function () {
  var panel = document.getElementById("debug-panel");
  if (panel && panel.style.display === "block") {
    updateDebugPanel();
  }
}, 3000);

async function signInWithGoogle() {
  var redirectUrl = (window.location.origin + window.location.pathname)
    .replace(/index\.html$/, '')
    .replace(/\/?$/, '/');

  return await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl
    }
  });
}

// Wire it up to your button
document.addEventListener("DOMContentLoaded", function () {
  var googleBtn = document.getElementById("google-login-btn");
  if (googleBtn) {
    googleBtn.onclick = async function () {
      const { error } = await signInWithGoogle();
      if (error) {
        alert("Google sign-in error: " + error.message);
      }
    };
  }
});