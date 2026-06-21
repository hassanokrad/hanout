/* Hanout core — store.js
 * A tiny localStorage-backed reactive store with collection (CRUD-by-id) helpers.
 * Every key is namespaced with `hanout_`. Subscribers are notified on every write,
 * which the runtime uses to re-render the active view. No dependencies.
 */
;(function () {
  const H = (window.Hanout = window.Hanout || {});
  const PREFIX = 'hanout_';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

  function create() {
    const cache = {};
    const subs = [];

    function read(key, fallback) {
      if (key in cache) return cache[key];
      try {
        const raw = localStorage.getItem(PREFIX + key);
        cache[key] = raw == null ? clone(fallback) : JSON.parse(raw);
      } catch (e) {
        cache[key] = clone(fallback);
      }
      return cache[key];
    }
    function write(key, val) {
      cache[key] = val;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) { /* quota / private mode */ }
      notify(key);
    }
    function notify(key) { subs.forEach(fn => { try { fn(key); } catch (e) { console.error(e); } }); }

    const store = {
      uid,

      // raw key/value
      get(key, fallback) { return read(key, fallback === undefined ? null : fallback); },
      set(key, val) { write(key, val); return val; },
      has(key) { return localStorage.getItem(PREFIX + key) != null; },
      removeKey(key) { delete cache[key]; localStorage.removeItem(PREFIX + key); notify(key); },

      // collections: arrays of objects with an `id`
      all(key) { return read(key, []); },
      find(key, id) { return store.all(key).find(r => r.id === id) || null; },
      insert(key, rec) {
        const list = store.all(key).slice();
        if (!rec.id) rec.id = uid();
        list.push(rec);
        write(key, list);
        return rec;
      },
      update(key, id, patch) {
        const list = store.all(key).map(r =>
          r.id === id ? Object.assign({}, r, typeof patch === 'function' ? patch(r) : patch) : r
        );
        write(key, list);
        return store.find(key, id);
      },
      upsert(key, rec) {
        if (rec.id && store.find(key, rec.id)) return store.update(key, rec.id, rec);
        return store.insert(key, rec);
      },
      del(key, id) { write(key, store.all(key).filter(r => r.id !== id)); },

      // change notification
      subscribe(fn) {
        subs.push(fn);
        return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
      },

      // backup / restore (only keys we own)
      keys() {
        const out = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
        }
        return out;
      },
      exportAll() {
        const data = {};
        store.keys().forEach(k => { data[k] = store.get(k); });
        return data;
      },
      importAll(data, opts) {
        opts = opts || {};
        if (!opts.merge) store.keys().forEach(k => store.removeKey(k));
        Object.keys(data || {}).forEach(k => store.set(k, data[k]));
      },
      clearAll() {
        store.keys().forEach(k => store.removeKey(k));
        for (const k in cache) delete cache[k];
      },
    };
    return store;
  }

  H.Store = { create, uid, PREFIX };
})();
