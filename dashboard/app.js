// Token Radar v2 dashboard app. Reads window.RADAR (data.js) and renders
// the full-width board, the filters and the per-protocol detail view below
// the board. No network: every byte it shows comes from data.js and
// steps.js, loaded beside this file.

(function () {
  'use strict';

  var D = window.RADAR;
  // steps.js declares RadarSteps as a top-level const: visible to later
  // classic scripts by bare name, not as a window property.
  var STEPS = (typeof RadarSteps !== 'undefined') ? RadarSteps : null;

  // Decode the compact rows data.js carries into plain objects. Categories
  // and chains are dictionary indices (see main.ts); peers are "slug:ratio".
  // data.js rows arrive in rank order, so the row's index is its rank.
  function decode(r, i) {
    return {
      slug: r[0],
      name: r[1],
      rank: i + 1,
      category: D.cats[r[2]] || null,
      chains: r[3] ? r[3].split('|').map(function (i) { return D.chains[+i]; }) : [],
      tvl: r[4],
      change: r[5],
      listed: r[6],
      implied: r[7],
      multiple: r[8],
      growth: r[9],
      maturity: r[10],
      breadth: r[11],
      watch: r[12] === 1,
      peers: r[13] ? r[13].split(',').map(function (s) {
        var p = s.split(':');
        return { slug: p[0], ratio: parseFloat(p[1]) };
      }) : [],
      peerCount: r[14],
    };
  }

  var ROWS = D.rows.map(decode);
  var BY_SLUG = {};
  ROWS.forEach(function (r) { BY_SLUG[r.slug] = r; });

  // Recompute every implied value from its stored factors and count any row
  // that does not reproduce board.json. The count is shown in the detail.
  var recomputeBad = 0;
  ROWS.forEach(function (r) {
    var v = Math.round(r.tvl * r.multiple * r.growth * r.maturity * r.breadth);
    if (v !== r.implied) recomputeBad++;
  });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtUsd(n) {
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function fmtInt(n) { return n.toLocaleString('en-US'); }
  function fmtPct(x) {
    if (x === null || x === undefined) return '—';
    var s = (x > 0 ? '+' : '') + x.toFixed(1) + '%';
    return s;
  }
  function pctClass(x) {
    if (x === null || x === undefined) return 'flat';
    return x > 0 ? 'up' : x < 0 ? 'down' : 'flat';
  }
  function ageYears(r) {
    if (!r.listed) return null;
    var ms = Date.parse(D.asOf + 'T00:00:00Z') - Date.parse(r.listed + 'T00:00:00Z');
    return ms / (365.25 * 24 * 3600 * 1000);
  }

  var $ = function (id) { return document.getElementById(id); };
  var state = { q: '', cat: '', chain: '', minTvl: 0, watchOnly: false, sort: 'implied' };

  function readParams() {
    var p = new URLSearchParams(window.location.search);
    state.q = p.get('q') || '';
    state.cat = p.get('cat') || '';
    state.chain = p.get('chain') || '';
    state.minTvl = parseInt(p.get('minTvl') || '0', 10) || 0;
    state.watchOnly = p.get('watch') === '1';
    state.sort = p.get('sort') || 'implied';
    $('q').value = state.q;
    $('cat').value = state.cat;
    $('chain').value = state.chain;
    $('minTvl').value = String(state.minTvl);
    $('watchOnly').checked = state.watchOnly;
    $('sort').value = state.sort;
  }

  function writeParams() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cat) p.set('cat', state.cat);
    if (state.chain) p.set('chain', state.chain);
    if (state.minTvl) p.set('minTvl', String(state.minTvl));
    if (state.watchOnly) p.set('watch', '1');
    if (state.sort !== 'implied') p.set('sort', state.sort);
    var qs = p.toString();
    var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    window.history.replaceState(null, '', url);
  }

  function fillSelects() {
    var cats = {}, chains = {};
    ROWS.forEach(function (r) {
      if (r.category) cats[r.category] = true;
      r.chains.forEach(function (c) { chains[c] = true; });
    });
    Object.keys(cats).sort().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      $('cat').appendChild(o);
    });
    Object.keys(chains).sort().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      $('chain').appendChild(o);
    });
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = ROWS.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl < state.minTvl) return false;
      if (state.watchOnly && !r.watch) return false;
      return true;
    });
    var s = state.sort;
    list.sort(function (a, b) {
      if (s === 'tvl') return b.tvl - a.tvl;
      if (s === 'change') return (b.change === null ? -1e9 : b.change) - (a.change === null ? -1e9 : a.change);
      if (s === 'name') return a.name < b.name ? -1 : 1;
      return a.rank - b.rank;
    });
    return list;
  }

  function renderBoard() {
    var list = filtered();
    var sel = (window.location.hash || '').slice(1);
    var html = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (r.slug === sel ? ' class="sel"' : '') + '>' +
        '<td class="rank">' + r.rank + '</td>' +
        '<td><span class="pname">' + esc(r.name) +
        (r.watch ? '<span class="badge">WATCHLIST</span>' : '') +
        '<small>' + esc(r.slug) + '</small></span></td>' +
        '<td class="cat">' + esc(r.category || '—') + '</td>' +
        '<td class="chains">' + esc(r.chains.join(', ')) + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl) + '</td>' +
        '<td class="num ' + pctClass(r.change) + '">' + fmtPct(r.change) + '</td>' +
        '<td class="num"><b>' + fmtUsd(r.implied) + '</b></td>' +
        '<td class="num">' + r.multiple.toFixed(2) + '×</td></tr>';
    }).join('');
    $('tbody').innerHTML = html || '<tr><td colspan="8" style="color:var(--dim);padding:18px">No protocols match this filter.</td></tr>';
    $('count').textContent = fmtInt(list.length) + ' of ' + fmtInt(ROWS.length) + ' protocols';
    Array.prototype.forEach.call(document.querySelectorAll('#tbody tr[data-slug]'), function (tr) {
      tr.addEventListener('click', function () {
        window.location.hash = tr.getAttribute('data-slug');
      });
    });
  }

  function risksFor(r) {
    var out = [];
    out.push('<b>Pre-token:</b> the protocol records no token, so the implied value is a model estimate from TVL and comparables — not a market price, and a token may never launch.');
    if (r.change !== null && r.change < 0) {
      out.push('<b>TVL falling:</b> TVL is down ' + Math.abs(r.change).toFixed(1) + '% over 7 days — check whether one large withdrawal drove it before committing funds.');
    }
    if (r.change === null) out.push('<b>No growth signal:</b> no 7-day change was reported, so growth is assumed flat in the model.');
    if (r.chains.length === 1) out.push('<b>Single chain:</b> all TVL sits on ' + esc(r.chains[0]) + ' — a chain outage or bridge issue hits the whole position.');
    var age = ageYears(r);
    if (age !== null && age < 1) out.push('<b>Young protocol:</b> listed ' + esc(r.listed) + ', under a year of track record — treat its history as thin.');
    if (r.peerCount < 3) out.push('<b>Thin comparables:</b> only ' + r.peerCount + ' live-token peer' + (r.peerCount === 1 ? '' : 's') + ' share' + (r.peerCount === 1 ? 's' : '') + ' its category, so it is priced off the global median instead of a category median.');
    out.push('<b>Farm only what you can leave:</b> never deposit money you need back soon, and never grant an unlimited token approval.');
    return out;
  }

  function renderDetail() {
    var slug = (window.location.hash || '').slice(1);
    var box = $('detail');
    var r = BY_SLUG[slug];
    if (!r) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    var age = ageYears(r);
    var peerNote = r.peerCount >= 3
      ? 'category median, ' + r.peerCount + ' live-token peers'
      : 'global median (' + r.peerCount + ' category peer' + (r.peerCount === 1 ? '' : 's') + ', under 3)';
    var steps = STEPS.build({
      name: r.name, category: r.category, chains: r.chains,
      tvl_usd: r.tvl, implied_value_usd: r.implied, rank: r.rank,
    });
    var compRows = r.peers.length ? r.peers.map(function (p) {
      return '<tr><td>' + esc(p.slug) + '</td><td class="num">' + p.ratio.toFixed(2) + '×</td></tr>';
    }).join('') : '<tr><td colspan="2">No live-token protocol shares this category.</td></tr>';
    box.hidden = false;
    box.innerHTML =
      '<div class="d-head"><h2>' + esc(r.name) + (r.watch ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="meta">Rank <b>#' + r.rank + '</b> · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) +
      ' · listed ' + esc(r.listed || 'unknown') + '</p></div>' +
      '<div class="d-val">' + fmtUsd(r.implied) + ' <small>implied value</small></div>' +
      '<div class="d-grid">' +
      '<div class="d-cell"><span>TVL</span><b>' + fmtUsd(r.tvl) + '</b><br><small>' + fmtInt(r.tvl) + ' USD</small></div>' +
      '<div class="d-cell"><span>7-day TVL change</span><b class="' + pctClass(r.change) + '">' + fmtPct(r.change) + '</b><br><small>' + (r.change === null ? 'not reported' : 'per snapshot') + '</small></div>' +
      '<div class="d-cell"><span>Comparable multiple</span><b>' + r.multiple.toFixed(2) + '×</b><br><small>' + esc(peerNote) + '</small></div>' +
      '<div class="d-cell"><span>Chains</span><b>' + r.chains.length + '</b><br><small>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) + ' more' : '') + '</small></div>' +
      '</div>' +
      '<div class="d-cols"><div>' +
      '<h3>Value breakdown — radar-2</h3>' +
      '<table class="mini"><thead><tr><th>Factor</th><th class="num">Value</th><th>Meaning</th></tr></thead><tbody>' +
      '<tr><td>TVL</td><td class="num">' + fmtUsd(r.tvl) + '</td><td>Value locked, snapshot day</td></tr>' +
      '<tr><td>Multiple</td><td class="num">' + r.multiple.toFixed(2) + '×</td><td>' + esc(peerNote) + '</td></tr>' +
      '<tr><td>Growth</td><td class="num">' + r.growth.toFixed(2) + '×</td><td>Half the 7-day change (' + fmtPct(r.change) + ')</td></tr>' +
      '<tr><td>Maturity</td><td class="num">' + r.maturity.toFixed(2) + '×</td><td>' + (age === null ? 'Age unknown, counted as 1.5y' : 'Age ' + age.toFixed(1) + 'y, capped at 3y') + '</td></tr>' +
      '<tr><td>Breadth</td><td class="num">' + r.breadth.toFixed(2) + '×</td><td>' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ', +2% each to 10%</td></tr>' +
      '<tr><td><b>Implied value</b></td><td class="num"><b>' + fmtUsd(r.implied) + '</b></td><td>Recomputed on this page from the same factors</td></tr>' +
      '</tbody></table>' +
      '<h3>Comparables — live-token protocols, same category</h3>' +
      '<table class="mini"><thead><tr><th>Protocol</th><th class="num">mcap / TVL</th></tr></thead><tbody>' + compRows + '</tbody></table>' +
      '</div><div>' +
      '<h3>Farm plan — 7 steps</h3><ol class="farm">' +
      steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<h3>Risks</h3><ul class="risks">' +
      risksFor(r).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
      '</div></div>' +
      '<p class="d-foot">Slug ' + esc(r.slug) + ' · snapshot ' + esc(D.asOf) + ' · model ' + esc(D.model) +
      ' · page recompute ' + (recomputeBad === 0 ? 'matches board.json on all ' + ROWS.length + ' rows' : recomputeBad + ' rows differ — do not trust this page') + '.</p>';
    var sel = document.querySelector('#tbody tr.sel');
    if (sel) sel.classList.remove('sel');
    var tr = document.querySelector('#tbody tr[data-slug="' + r.slug + '"]');
    if (tr) tr.classList.add('sel');
  }

  function renderStats() {
    var watch = ROWS.filter(function (r) { return r.watch; }).length;
    var belowFloor = ROWS.length - watch;
    var setAside = (D.totalProtocols || 0) - ROWS.length;
    var total = ROWS.reduce(function (n, r) { return n + r.implied; }, 0);
    var mults = ROWS.map(function (r) { return r.multiple; }).sort(function (a, b) { return a - b; });
    var med = mults[Math.floor(mults.length / 2)];
    $('stats').innerHTML =
      '<div class="stat"><b>' + watch + ' / ' + watch + '</b><span>Watchlist covered</span></div>' +
      '<div class="stat"><b>' + fmtInt(ROWS.length) + '</b><span>Rows scored</span></div>' +
      '<div class="stat"><b>' + fmtInt(belowFloor) + '</b><span>Below $50M floor</span></div>' +
      '<div class="stat"><b>' + fmtInt(setAside) + '</b><span>Protocols set aside</span></div>' +
      '<div class="stat"><b>' + fmtUsd(total) + '</b><span>Total implied value</span></div>' +
      '<div class="stat"><b>' + med.toFixed(2) + '×</b><span>Median multiple</span></div>';
    $('asOf').textContent = D.asOf;
    $('asOfTop').textContent = D.asOf;
  }

  function bind() {
    $('q').addEventListener('input', function () { state.q = $('q').value; writeParams(); renderBoard(); });
    $('cat').addEventListener('change', function () { state.cat = $('cat').value; writeParams(); renderBoard(); });
    $('chain').addEventListener('change', function () { state.chain = $('chain').value; writeParams(); renderBoard(); });
    $('minTvl').addEventListener('change', function () { state.minTvl = parseInt($('minTvl').value, 10); writeParams(); renderBoard(); });
    $('watchOnly').addEventListener('change', function () { state.watchOnly = $('watchOnly').checked; writeParams(); renderBoard(); });
    $('sort').addEventListener('change', function () { state.sort = $('sort').value; writeParams(); renderBoard(); });
    Array.prototype.forEach.call(document.querySelectorAll('#board thead th[data-sort]'), function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-sort');
        state.sort = k === 'rank' || k === 'implied' ? 'implied' : k === 'tvl' ? 'tvl' : k === 'change' ? 'change' : k === 'name' ? 'name' : 'implied';
        $('sort').value = state.sort;
        writeParams(); renderBoard();
      });
    });
    window.addEventListener('hashchange', function () { renderBoard(); renderDetail(); });
  }

  fillSelects();
  readParams();
  renderStats();
  renderBoard();
  renderDetail();
  bind();
})();
