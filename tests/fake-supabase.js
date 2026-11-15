// A fake Supabase client that runs inside the page, replacing the real library.
// It keeps an in-memory database (window.__DB) and records every call (window.__LOG).
// It mimics a few database rules (unique category names, no deleting Default, no negative
// prices) and the read rules for non-owners, but it is NOT a test of your real database.
// Your real database is checked by the SQL files in supabase/tests/.
(function () {
  var LOG = window.__LOG = [];
  var DB = window.__DB = JSON.parse(JSON.stringify((window.__FAKE && window.__FAKE.data) || { wishlists: [], categories: [], items: [] }));
  var seq = 1;
  function F() { return window.__FAKE || {} }
  function clone(x) { return x === undefined ? x : JSON.parse(JSON.stringify(x)) }
  function sleep() { return new Promise(function (r) { setTimeout(r, F().delayMs || 0) }) }
  function session() { return sessionStorage.getItem('fakeSignedOut') ? null : (F().session || null) }
  function isOwner() { var s = session(); return !!s && DB.wishlists.some(function (w) { return w.owner_id === s.user.id }) }

  function visible(table, rows) {
    if (!session()) return [];                       // signed out: nothing
    if (isOwner()) return rows;                      // owner: everything
    if (table === 'items') return rows.filter(function (i) { return !i.got });
    if (table === 'categories') return rows.filter(function (c) { return DB.items.some(function (i) { return i.category_id === c.id && !i.got }) });
    return rows;
  }
  function matches(row, filters) { return filters.every(function (f) { return String(row[f[0]]) === String(f[1]) }) }

  function Query(table) { this.t = table; this.op = 'select'; this.filters = []; this.payload = null; this.returning = false; this.single_ = false; this.ord = null; this.lim = null }
  Query.prototype.select = function () { if (this.op !== 'select') this.returning = true; return this };
  Query.prototype.insert = function (rows) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this };
  Query.prototype.update = function (p) { this.op = 'update'; this.payload = p; return this };
  Query.prototype.delete = function () { this.op = 'delete'; return this };
  Query.prototype.eq = function (c, v) { this.filters.push([c, v]); return this };
  Query.prototype.order = function (c, o) { this.ord = [c, !(o && o.ascending === false)]; return this };
  Query.prototype.limit = function (n) { this.lim = n; return this };
  Query.prototype.single = function () { this.single_ = true; return this };
  Query.prototype.then = function (res, rej) { return this.exec().then(res, rej) };

  Query.prototype.done = function (rows) {
    if (!this.returning && this.op !== 'select') return { data: null, error: null };
    if (this.single_) {
      if (rows.length !== 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
      return { data: clone(rows[0]), error: null };
    }
    return { data: clone(rows), error: null };
  };

  Query.prototype.exec = async function () {
    await sleep();
    var t = this.t, all = DB[t], write = this.op !== 'select', self = this;
    LOG.push({ table: t, op: this.op, payload: clone(this.payload), filters: this.filters.slice() });
    if (write && F().failWrites) return { data: null, error: { message: 'Failed to fetch' } };

    if (this.op === 'select') {
      var rows = visible(t, all).filter(function (r) { return matches(r, self.filters) });
      if (this.ord) { var k = this.ord[0], asc = this.ord[1]; rows = rows.slice().sort(function (a, b) { return (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1) }) }
      if (this.lim != null) rows = rows.slice(0, this.lim);
      return this.done(rows);
    }

    if (!isOwner()) {
      if (this.op === 'insert') return { data: null, error: { message: 'new row violates row-level security policy' } };
      return { data: null, error: null };            // update/delete of rows you can't see: 0 rows, no error
    }

    if (this.op === 'insert') {
      var out = [];
      for (var n = 0; n < this.payload.length; n++) {
        var row = Object.assign({ id: 'new-' + (seq++), got: false, sort_order: 0, price: 0, is_default: false, icon: '🎁' }, clone(this.payload[n]));
        if (t === 'categories') {
          var nm = String(row.name || '').trim();
          if (!nm || nm.length > 30) return { data: null, error: { message: 'new row violates check constraint "categories_name_check"' } };
          if (all.some(function (c) { return c.wishlist_id === row.wishlist_id && c.name.trim().toLowerCase() === nm.toLowerCase() }))
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "categories_unique_name_idx"' } };
          if (!row.wishlist_id) return { data: null, error: { message: 'null value in column "wishlist_id" of relation "categories" violates not-null constraint' } };
        }
        if (t === 'items' && Number(row.price) < 0) return { data: null, error: { message: 'new row violates check constraint "items_price_check"' } };
        all.push(row); out.push(row);
      }
      return this.done(out);
    }

    var hit = all.filter(function (r) { return matches(r, self.filters) });
    if (this.op === 'update') {
      if (t === 'items' && this.payload.price !== undefined && Number(this.payload.price) < 0) return { data: null, error: { message: 'new row violates check constraint "items_price_check"' } };
      hit.forEach(function (r) { Object.assign(r, clone(self.payload)) });
      return this.done(hit);
    }
    if (this.op === 'delete') {
      if (t === 'categories' && hit.some(function (c) { return c.is_default })) return { data: null, error: { message: 'Cannot delete the Default category' } };
      hit.forEach(function (r) { var i = all.indexOf(r); if (i > -1) all.splice(i, 1) });
      if (t === 'categories') hit.forEach(function (c) { DB.items = DB.items.filter(function (it) { return it.category_id !== c.id }) });
      window.__DB = DB;
      return this.done(hit);
    }
  };

  window.supabase = {
    createClient: function () {
      return {
        from: function (t) { return new Query(t) },
        auth: {
          getSession: async function () { return { data: { session: session() } } },
          signOut: async function () { sessionStorage.setItem('fakeSignedOut', '1'); LOG.push({ auth: 'signOut' }); return { error: null } },
          signInWithOAuth: async function (o) { LOG.push({ auth: 'signInWithOAuth', provider: o.provider, redirectTo: o.options && o.options.redirectTo }); return { error: null } },
          onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () { } } } } },
        },
      };
    },
  };
})();