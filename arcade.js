/* ReachFi Arcade client — account + gems + store + profile + leaderboard, in one drop-in widget.
 * Include once in the shell (and any game page): <script src="arcade.js" defer></script>
 * It self-bootstraps an account, injects a launcher button, and renders the store/profile/board.
 * Talks to the shared economy backend (the STAK Vercel project). Gems are arcade-only; this widget
 * has no concept of the crypto arena and never touches it.
 */
(function () {
  'use strict';
  var API = (window.REACHFI_API || 'https://www.stakit.app').replace(/\/$/, '');
  var LSK = 'reachfi_acct';

  // ---------- account ----------
  function load() { try { return JSON.parse(localStorage.getItem(LSK) || 'null'); } catch (e) { return null; } }
  function save(a) { try { localStorage.setItem(LSK, JSON.stringify(a)); } catch (e) {} }
  var acct = load();

  function api(path, opts) {
    opts = opts || {};
    var h = { 'Content-Type': 'application/json' };
    if (acct && acct.token) h['Authorization'] = 'Bearer ' + acct.token;
    return fetch(API + path, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  function ensureAccount() {
    if (acct && acct.token) return Promise.resolve(acct);
    return api('/api/account', { method: 'POST', body: { op: 'create' } }).then(function (a) {
      if (a && a.token) { acct = a; save(acct); }
      return acct;
    });
  }

  // ---------- public API ----------
  var Arcade = {
    ready: ensureAccount(),
    token: function () { return acct && acct.token; },
    playerId: function () { return acct && acct.playerId; },
    profile: function () { return api('/api/account'); },
    gems: function () { return api('/api/gems').then(function (r) { return r.balance || 0; }); },
    catalog: function () { return api('/api/store?op=catalog').then(function (r) { return (r && r.items) || []; }); },
    buy: function (itemId) { return api('/api/store', { method: 'POST', body: { op: 'buy', itemId: itemId } }); },
    leaderboard: function (game, mode) { return api('/api/leaderboard?op=top&game=' + encodeURIComponent(game || 'stak') + '&mode=' + (mode || 'global') + '&n=20').then(function (r) { return (r && r.top) || []; }); },
    claimHandle: function (h) { return api('/api/account', { method: 'POST', body: { op: 'claim', handle: h } }); },
    open: openModal
  };
  window.Arcade = Arcade;

  // ---------- UI ----------
  var GAMES = ['stak', 'nerve', 'rook', 'pulse', 'nil', 'fuse', 'prism'];
  var css = '\
  #rf-btn{position:fixed;right:16px;bottom:16px;z-index:2147483000;border:none;cursor:pointer;border-radius:999px;padding:12px 18px;font:800 14px system-ui,sans-serif;letter-spacing:1px;color:#06121f;background:linear-gradient(135deg,#6FE3FF,#8B6CFF);box-shadow:0 6px 24px rgba(111,227,255,.45)}\
  #rf-ov{position:fixed;inset:0;z-index:2147483001;display:none;align-items:center;justify-content:center;background:rgba(4,8,16,.72);backdrop-filter:blur(6px)}\
  #rf-modal{width:min(560px,94vw);max-height:88vh;overflow:auto;background:#0c1320;border:1px solid #1f2c42;border-radius:18px;color:#dCEbff;font:400 14px system-ui,sans-serif;box-shadow:0 24px 80px rgba(0,0,0,.6)}\
  .rf-top{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid #1f2c42;position:sticky;top:0;background:#0c1320}\
  .rf-gem{margin-left:auto;font-weight:800;color:#7CF2C8}\
  .rf-x{cursor:pointer;color:#8aa0c0;font-size:20px;background:none;border:none}\
  .rf-tabs{display:flex;gap:6px;padding:12px 18px 0}\
  .rf-tab{flex:1;text-align:center;padding:9px;border-radius:10px 10px 0 0;cursor:pointer;color:#8aa0c0;font-weight:700}\
  .rf-tab.on{color:#fff;background:#131d2e}\
  .rf-body{padding:16px 18px 22px;min-height:200px}\
  .rf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}\
  .rf-card{background:#111a29;border:1px solid #1f2c42;border-radius:12px;padding:12px}\
  .rf-name{font-weight:700;margin-bottom:6px}\
  .rf-buy{margin-top:8px;width:100%;border:none;cursor:pointer;border-radius:8px;padding:8px;font-weight:800;color:#06121f;background:#6FE3FF}\
  .rf-buy.owned{background:#22324a;color:#7CF2C8;cursor:default}\
  .rf-row{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #16223550}\
  .rf-rank{width:28px;color:#8aa0c0;font-weight:800}\
  .rf-handle{flex:1}\
  .rf-score{font-weight:800;color:#6FE3FF}\
  .rf-sel{background:#111a29;border:1px solid #1f2c42;color:#dCEbff;border-radius:8px;padding:6px;margin-bottom:10px}';

  var modal, bodyEl, gemEl, tab = 'store', lbGame = 'stak';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function mount() {
    var st = el('style'); st.textContent = css; document.head.appendChild(st);
    var btn = el('button'); btn.id = 'rf-btn'; btn.textContent = '▶ ARCADE'; btn.onclick = function () { openModal(); }; document.body.appendChild(btn);
    var ov = el('div'); ov.id = 'rf-ov';
    modal = el('div'); modal.id = 'rf-modal';
    var top = el('div', 'rf-top', '<b style="letter-spacing:1px">REACHFI ARCADE</b>');
    gemEl = el('span', 'rf-gem', '◆ ...'); top.appendChild(gemEl);
    var x = el('button', 'rf-x', '✕'); x.onclick = function () { ov.style.display = 'none'; }; top.appendChild(x);
    var tabs = el('div', 'rf-tabs');
    ['store', 'profile', 'board'].forEach(function (t) {
      var d = el('div', 'rf-tab' + (t === tab ? ' on' : ''), t === 'board' ? 'Leaderboard' : t[0].toUpperCase() + t.slice(1));
      d.onclick = function () { tab = t; render(); }; tabs.appendChild(d);
    });
    bodyEl = el('div', 'rf-body', 'Loading...');
    modal.appendChild(top); modal.appendChild(tabs); modal.appendChild(bodyEl);
    ov.appendChild(modal); ov.onclick = function (e) { if (e.target === ov) ov.style.display = 'none'; };
    document.body.appendChild(ov);
  }

  function openModal(t) { if (t) tab = t; document.getElementById('rf-ov').style.display = 'flex'; render(); }

  function refreshGems() { Arcade.gems().then(function (g) { if (gemEl) gemEl.textContent = '◆ ' + g.toLocaleString(); }); }

  function render() {
    if (!modal) return;
    [].forEach.call(modal.querySelectorAll('.rf-tab'), function (d) {
      var name = d.textContent.toLowerCase();
      d.classList.toggle('on', (name === 'leaderboard' ? 'board' : name) === tab);
    });
    refreshGems();
    if (tab === 'store') renderStore();
    else if (tab === 'profile') renderProfile();
    else renderBoard();
  }

  function renderStore() {
    bodyEl.innerHTML = 'Loading store...';
    Promise.all([Arcade.catalog(), Arcade.profile()]).then(function (r) {
      var items = r[0], owned = (r[1] && r[1].inventory) || [];
      var g = el('div', 'rf-grid');
      items.forEach(function (it) {
        var c = el('div', 'rf-card', '<div class="rf-name">' + it.name + '</div><div style="color:#8aa0c0;font-size:12px">' + it.type.replace(/_/g, ' ') + '</div>');
        var has = owned.indexOf(it.id) >= 0;
        var b = el('button', 'rf-buy' + (has ? ' owned' : ''), has ? 'Owned' : '◆ ' + it.price.toLocaleString());
        if (!has) b.onclick = function () { b.textContent = '...'; Arcade.buy(it.id).then(function (res) { if (res.ok) { render(); } else { b.textContent = res.error === 'insufficient' ? 'Need more ◆' : (res.error || 'error'); setTimeout(render, 1200); } }); };
        c.appendChild(b); g.appendChild(c);
      });
      bodyEl.innerHTML = ''; bodyEl.appendChild(g);
    });
  }

  function renderProfile() {
    bodyEl.innerHTML = 'Loading profile...';
    Arcade.profile().then(function (p) {
      var inv = (p.inventory || []).length;
      bodyEl.innerHTML = '<div class="rf-card"><div class="rf-name">' + (p.handle ? '@' + p.handle : (p.displayName || 'Player')) + '</div>' +
        '<div style="color:#8aa0c0;font-size:12px">id ' + (p.playerId || '').slice(0, 12) + '</div>' +
        '<div style="margin-top:10px">◆ <b>' + (p.gems || 0).toLocaleString() + '</b> gems &nbsp;·&nbsp; ' + inv + ' items owned</div></div>' +
        (p.handle ? '' : '<div style="margin-top:12px"><input id="rf-h" class="rf-sel" placeholder="claim a handle" style="width:60%"><button class="rf-buy" style="width:34%;display:inline-block;margin-left:4px" id="rf-hb">Claim</button></div>');
      var hb = document.getElementById('rf-hb');
      if (hb) hb.onclick = function () { var v = document.getElementById('rf-h').value; Arcade.claimHandle(v).then(function (r) { if (r.ok) { acct.handle = r.handle; save(acct); render(); } else { hb.textContent = r.error || 'taken'; } }); };
    });
  }

  function renderBoard() {
    bodyEl.innerHTML = '';
    var sel = el('select', 'rf-sel');
    GAMES.forEach(function (g) { var o = el('option'); o.value = g; o.textContent = g.toUpperCase(); if (g === lbGame) o.selected = true; sel.appendChild(o); });
    sel.onchange = function () { lbGame = sel.value; renderBoard(); };
    bodyEl.appendChild(sel);
    var list = el('div'); list.textContent = 'Loading...'; bodyEl.appendChild(list);
    Arcade.leaderboard(lbGame, 'global').then(function (rows) {
      if (!rows.length) { list.innerHTML = '<div style="color:#8aa0c0;padding:12px 0">No scores yet. Be the first.</div>'; return; }
      list.innerHTML = '';
      rows.forEach(function (r, i) {
        list.appendChild(el('div', 'rf-row', '<span class="rf-rank">' + (i + 1) + '</span><span class="rf-handle">' + (r.handle || 'Player') + '</span><span class="rf-score">' + Number(r.score).toLocaleString() + '</span>'));
      });
    });
  }

  ensureAccount().then(function () {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  });
})();
