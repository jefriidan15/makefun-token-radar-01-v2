// Token Radar v2 dashboard app, rewritten. It reads window.RADAR (written
// into data.js by main.ts) and renders the full-width board, the filters and
// the per-protocol detail view below the board. No network: every byte it
// shows comes from data.js and steps.js, loaded beside this file.

(function () {
  'use strict';

  var DATA = window.RADAR;
  // steps.js declares RadarSteps as a top-level const, so later classic
  // scripts see it by its bare name rather than as a window property.
  var Steps = (typeof RadarSteps !== 'undefined') ? RadarSteps : null;

  // --- formatting helpers -------------------------------------------------

  // Escape a string for safe insertion into the page's HTML.
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c];
    });
  }

  // Short money: $2.75B, $442.2M, $96.9M, $308.9K, $42.
  function fmtUsd(n) {
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  // Whole numbers with US thousands separators.
  function fmtInt(n) {
    return n.toLocaleString('en-US');
  }

  // A 7-day move as a signed percent, or an em dash when unreported.
  function fmtPct(x) {
    if (x === null || x === undefined) return '—';
    return (x > 0 ? '+' : '') + x.toFixed(1) + '%';
  }

  // The CSS class for a move: up, down, or flat (including unreported).
  function pctClass(x) {
    if (x === null || x === undefined) return 'flat';
    if (x > 0) return 'up';
    if (x < 0) return 'down';
    return 'flat';
  }

  // Age in years of a row's listing, from the snapshot date; null when the
  // listing date is missing.
  function ageYears(row) {
    if (!row.listed) return null;
    var snapshotMs = Date.parse(DATA.asOf + 'T00:00:00Z');
    var listedMs = Date.parse(row.listed + 'T00:00:00Z');
    return (snapshotMs - listedMs) / (365.25 * 24 * 3600 * 1000);
  }

  function $(id) {
    return document.getElementById(id);
  }

  // --- data ----------------------------------------------------------------

  // Expand the compact rows data.js carries into plain objects. Categories
  // and chains arrive as dictionary indices (see main.ts); peers arrive as
  // "slug:ratio" pairs. data.js rows arrive in rank order, so a row's index
  // is its rank.
  function decode(compact, i) {
    var peerText = compact[13];
    var peers = [];
    if (peerText) {
      peers = peerText.split(',').map(function (piece) {
        var parts = piece.split(':');
        return { slug: parts[0], ratio: parseFloat(parts[1]) };
      });
    }
    var chainText = compact[3];
    var chainNames = [];
    if (chainText) {
      chainNames = chainText.split('|').map(function (idx) {
        return DATA.chains[+idx];
      });
    }
    return {
      slug: compact[0],
      name: compact[1],
      rank: i + 1,
      category: DATA.cats[compact[2]] || null,
      chains: chainNames,
      tvl: compact[4],
      change: compact[5],
      listed: compact[6],
      implied: compact[7],
      multiple: compact[8],
      growth: compact[9],
      maturity: compact[10],
      breadth: compact[11],
      watch: compact[12] === 1,
      peers: peers,
      peerCount: compact[14],
    };
  }

  var rows = DATA.rows.map(decode);
  var bySlug = {};
  rows.forEach(function (row) {
    bySlug[row.slug] = row;
  });

  // Recompute every implied value from its stored factors and count the rows
  // that do not reproduce board.json. The count is printed in the detail
  // view's footer, so a reader can see the page agrees with the board.
  var badRecompute = 0;
  rows.forEach(function (row) {
    var rebuilt = Math.round(
      row.tvl * row.multiple * row.growth * row.maturity * row.breadth,
    );
    if (rebuilt !== row.implied) badRecompute++;
  });

  // --- filters -------------------------------------------------------------

  // The filter state, mirrored into the URL so a filtered board is linkable.
  var filters = {
    q: '',
    cat: '',
    chain: '',
    minTvl: 0,
    watchOnly: false,
    sort: 'implied',
  };

  // Read the filter state out of the URL and into the controls.
  function readParams() {
    var params = new URLSearchParams(window.location.search);
    filters.q = params.get('q') || '';
    filters.cat = params.get('cat') || '';
    filters.chain = params.get('chain') || '';
    filters.minTvl = parseInt(params.get('minTvl') || '0', 10) || 0;
    filters.watchOnly = params.get('watch') === '1';
    filters.sort = params.get('sort') || 'implied';
    $('q').value = filters.q;
    $('cat').value = filters.cat;
    $('chain').value = filters.chain;
    $('minTvl').value = String(filters.minTvl);
    $('watchOnly').checked = filters.watchOnly;
    $('sort').value = filters.sort;
  }

  // Write the filter state back into the URL without reloading the page.
  function writeParams() {
    var params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.cat) params.set('cat', filters.cat);
    if (filters.chain) params.set('chain', filters.chain);
    if (filters.minTvl) params.set('minTvl', String(filters.minTvl));
    if (filters.watchOnly) params.set('watch', '1');
    if (filters.sort !== 'implied') params.set('sort', filters.sort);
    var query = params.toString();
    var url = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
    window.history.replaceState(null, '', url);
  }

  // Fill the category and chain dropdowns from the rows on the board.
  function fillSelects() {
    var cats = {};
    var chains = {};
    rows.forEach(function (row) {
      if (row.category) cats[row.category] = true;
      row.chains.forEach(function (chain) {
        chains[chain] = true;
      });
    });
    Object.keys(cats).sort().forEach(function (cat) {
      var option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      $('cat').appendChild(option);
    });
    Object.keys(chains).sort().forEach(function (chain) {
      var option = document.createElement('option');
      option.value = chain;
      option.textContent = chain;
      $('chain').appendChild(option);
    });
  }

  // The rows that survive the current filters, in the current sort order.
  function filtered() {
    var q = filters.q.trim().toLowerCase();
    var list = rows.filter(function (row) {
      if (q !== '') {
        var hay = row.name.toLowerCase();
        if (hay.indexOf(q) < 0 && row.slug.indexOf(q) < 0) return false;
      }
      if (filters.cat !== '' && row.category !== filters.cat) return false;
      if (filters.chain !== '' && row.chains.indexOf(filters.chain) < 0) return false;
      if (row.tvl < filters.minTvl) return false;
      if (filters.watchOnly && !row.watch) return false;
      return true;
    });
    var sort = filters.sort;
    list.sort(function (a, b) {
      if (sort === 'tvl') return b.tvl - a.tvl;
      if (sort === 'change') {
        var bc = b.change === null ? -1e9 : b.change;
        var ac = a.change === null ? -1e9 : a.change;
        return bc - ac;
      }
      if (sort === 'name') return a.name < b.name ? -1 : 1;
      return a.rank - b.rank;
    });
    return list;
  }

  // --- board ---------------------------------------------------------------

  // One board row's HTML. The selected row (from the URL hash) carries the
  // sel class so it reads as the open one.
  function rowHtml(row, selected) {
    var badge = row.watch ? '<span class="badge">WATCHLIST</span>' : '';
    var cells = [
      '<td class="rank">' + row.rank + '</td>',
      '<td><span class="pname">' + esc(row.name) + badge +
        '<small>' + esc(row.slug) + '</small></span></td>',
      '<td class="cat">' + esc(row.category || '—') + '</td>',
      '<td class="chains">' + esc(row.chains.join(', ')) + '</td>',
      '<td class="num">' + fmtUsd(row.tvl) + '</td>',
      '<td class="num ' + pctClass(row.change) + '">' + fmtPct(row.change) + '</td>',
      '<td class="num"><b>' + fmtUsd(row.implied) + '</b></td>',
      '<td class="num">' + row.multiple.toFixed(2) + '×</td>',
    ];
    var cls = selected ? ' class="sel"' : '';
    return '<tr data-slug="' + esc(row.slug) + '"' + cls + '>' + cells.join('') + '</tr>';
  }

  // Paint the board from the filtered rows and wire each row to open its
  // detail view when clicked.
  function renderBoard() {
    var list = filtered();
    var sel = (window.location.hash || '').slice(1);
    var html = list.map(function (row) {
      return rowHtml(row, row.slug === sel);
    }).join('');
    if (html === '') {
      html = '<tr><td colspan="8" style="color:var(--dim);padding:18px">' +
        'No protocols match this filter.</td></tr>';
    }
    $('tbody').innerHTML = html;
    $('count').textContent = fmtInt(list.length) + ' of ' + fmtInt(rows.length) + ' protocols';
    var trs = document.querySelectorAll('#tbody tr[data-slug]');
    Array.prototype.forEach.call(trs, function (tr) {
      tr.addEventListener('click', function () {
        window.location.hash = tr.getAttribute('data-slug');
      });
    });
  }

  // The risk notes for one protocol, as HTML list items.
  function risksFor(row) {
    var notes = [];
    notes.push(
      '<b>Pre-token:</b> the protocol records no token, so the implied value is a model estimate from TVL and comparables — not a market price, and a token may never launch.',
    );
    if (row.change !== null && row.change < 0) {
      notes.push(
        '<b>TVL falling:</b> TVL is down ' + Math.abs(row.change).toFixed(1) +
        '% over 7 days — check whether one large withdrawal drove it before committing funds.',
      );
    }
    if (row.change === null) {
      notes.push(
        '<b>No growth signal:</b> no 7-day change was reported, so growth is assumed flat in the model.',
      );
    }
    if (row.chains.length === 1) {
      notes.push(
        '<b>Single chain:</b> all TVL sits on ' + esc(row.chains[0]) +
        ' — a chain outage or bridge issue hits the whole position.',
      );
    }
    var age = ageYears(row);
    if (age !== null && age < 1) {
      notes.push(
        '<b>Young protocol:</b> listed ' + esc(row.listed) +
        ', under a year of track record — treat its history as thin.',
      );
    }
    if (row.peerCount < 3) {
      var plural = row.peerCount === 1 ? '' : 's';
      var verb = row.peerCount === 1 ? 's' : '';
      notes.push(
        '<b>Thin comparables:</b> only ' + row.peerCount + ' live-token peer' + plural +
        ' share' + verb + ' its category, so it is priced off the global median instead of a category median.',
      );
    }
    notes.push(
      '<b>Farm only what you can leave:</b> never deposit money you need back soon, and never grant an unlimited token approval.',
    );
    return notes;
  }

  // --- detail view ---------------------------------------------------------

  // Paint the detail panel for the protocol in the URL hash, or hide it when
  // no row is selected. The panel is built in named sections and joined, so
  // each section reads on its own.
  function renderDetail() {
    var slug = (window.location.hash || '').slice(1);
    var box = $('detail');
    var row = bySlug[slug];
    if (!row) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    var age = ageYears(row);
    var peerNote = row.peerCount >= 3
      ? 'category median, ' + row.peerCount + ' live-token peers'
      : 'global median (' + row.peerCount + ' category peer' +
        (row.peerCount === 1 ? '' : 's') + ', under 3)';
    var steps = Steps.build({
      name: row.name,
      category: row.category,
      chains: row.chains,
      tvl_usd: row.tvl,
      implied_value_usd: row.implied,
      rank: row.rank,
    });
    var compRows = row.peers.length
      ? row.peers.map(function (p) {
          return '<tr><td>' + esc(p.slug) + '</td><td class="num">' +
            p.ratio.toFixed(2) + '×</td></tr>';
        }).join('')
      : '<tr><td colspan="2">No live-token protocol shares this category.</td></tr>';
    var badge = row.watch ? '<span class="badge">WATCHLIST</span>' : '';
    var head = '<div class="d-head"><h2>' + esc(row.name) + badge + '</h2>' +
      '<p class="meta">Rank <b>#' + row.rank + '</b> · ' +
      esc(row.category || 'Uncategorised') + ' · ' + esc(row.chains.join(', ')) +
      ' · listed ' + esc(row.listed || 'unknown') + '</p></div>';
    var val = '<div class="d-val">' + fmtUsd(row.implied) +
      ' <small>implied value</small></div>';
    var extraChains = row.chains.length > 3
      ? ' +' + (row.chains.length - 3) + ' more'
      : '';
    var grid = '<div class="d-grid">' +
      '<div class="d-cell"><span>TVL</span><b>' + fmtUsd(row.tvl) +
      '</b><br><small>' + fmtInt(row.tvl) + ' USD</small></div>' +
      '<div class="d-cell"><span>7-day TVL change</span><b class="' +
      pctClass(row.change) + '">' + fmtPct(row.change) + '</b><br><small>' +
      (row.change === null ? 'not reported' : 'per snapshot') + '</small></div>' +
      '<div class="d-cell"><span>Comparable multiple</span><b>' +
      row.multiple.toFixed(2) + '×</b><br><small>' + esc(peerNote) + '</small></div>' +
      '<div class="d-cell"><span>Chains</span><b>' + row.chains.length +
      '</b><br><small>' + esc(row.chains.slice(0, 3).join(', ')) +
      extraChains + '</small></div>' +
      '</div>';
    var maturityNote = age === null
      ? 'Age unknown, counted as 1.5y'
      : 'Age ' + age.toFixed(1) + 'y, capped at 3y';
    var chainWord = row.chains.length === 1 ? ' chain' : ' chains';
    var left = '<div class="d-cols"><div>' +
      '<h3>Value breakdown — radar-2</h3>' +
      '<table class="mini"><thead><tr><th>Factor</th><th class="num">Value</th>' +
      '<th>Meaning</th></tr></thead><tbody>' +
      '<tr><td>TVL</td><td class="num">' + fmtUsd(row.tvl) +
      '</td><td>Value locked, snapshot day</td></tr>' +
      '<tr><td>Multiple</td><td class="num">' + row.multiple.toFixed(2) +
      '×</td><td>' + esc(peerNote) + '</td></tr>' +
      '<tr><td>Growth</td><td class="num">' + row.growth.toFixed(2) +
      '×</td><td>Half the 7-day change (' + fmtPct(row.change) + ')</td></tr>' +
      '<tr><td>Maturity</td><td class="num">' + row.maturity.toFixed(2) +
      '×</td><td>' + maturityNote + '</td></tr>' +
      '<tr><td>Breadth</td><td class="num">' + row.breadth.toFixed(2) +
      '×</td><td>' + row.chains.length + chainWord + ', +2% each to 10%</td></tr>' +
      '<tr><td><b>Implied value</b></td><td class="num"><b>' + fmtUsd(row.implied) +
      '</b></td><td>Recomputed on this page from the same factors</td></tr>' +
      '</tbody></table>' +
      '<h3>Comparables — live-token protocols, same category</h3>' +
      '<table class="mini"><thead><tr><th>Protocol</th><th class="num">mcap / TVL</th></tr></thead><tbody>' +
      compRows + '</tbody></table>' +
      '</div><div>';
    var farmItems = steps.map(function (s) {
      return '<li>' + esc(s) + '</li>';
    }).join('');
    var riskItems = risksFor(row).map(function (x) {
      return '<li>' + x + '</li>';
    }).join('');
    var right = '<h3>Farm plan — 7 steps</h3><ol class="farm">' + farmItems + '</ol>' +
      '<h3>Risks</h3><ul class="risks">' + riskItems + '</ul>' +
      '</div></div>';
    var recomputeNote = badRecompute === 0
      ? 'matches board.json on all ' + rows.length + ' rows'
      : badRecompute + ' rows differ — do not trust this page';
    var foot = '<p class="d-foot">Slug ' + esc(row.slug) + ' · snapshot ' +
      esc(DATA.asOf) + ' · model ' + esc(DATA.model) +
      ' · page recompute ' + recomputeNote + '.</p>';
    box.hidden = false;
    box.innerHTML = head + val + grid + left + right + foot;
    var oldSel = document.querySelector('#tbody tr.sel');
    if (oldSel) oldSel.classList.remove('sel');
    var tr = document.querySelector('#tbody tr[data-slug="' + row.slug + '"]');
    if (tr) tr.classList.add('sel');
  }

  // --- stats strip ---------------------------------------------------------

  // The six totals across the top of the page: watchlist coverage, rows
  // scored, rows below the floor, protocols set aside, total implied value
  // and the median multiple.
  function renderStats() {
    var watchCount = rows.filter(function (row) {
      return row.watch;
    }).length;
    var belowFloor = rows.length - watchCount;
    var setAside = (DATA.totalProtocols || 0) - rows.length;
    var total = rows.reduce(function (sum, row) {
      return sum + row.implied;
    }, 0);
    var sortedMults = rows.map(function (row) {
      return row.multiple;
    }).sort(function (a, b) {
      return a - b;
    });
    var med = sortedMults[Math.floor(sortedMults.length / 2)];
    $('stats').innerHTML =
      '<div class="stat"><b>' + watchCount + ' / ' + watchCount +
      '</b><span>Watchlist covered</span></div>' +
      '<div class="stat"><b>' + fmtInt(rows.length) + '</b><span>Rows scored</span></div>' +
      '<div class="stat"><b>' + fmtInt(belowFloor) + '</b><span>Below $50M floor</span></div>' +
      '<div class="stat"><b>' + fmtInt(setAside) + '</b><span>Protocols set aside</span></div>' +
      '<div class="stat"><b>' + fmtUsd(total) + '</b><span>Total implied value</span></div>' +
      '<div class="stat"><b>' + med.toFixed(2) + '×</b><span>Median multiple</span></div>';
    $('asOf').textContent = DATA.asOf;
    $('asOfTop').textContent = DATA.asOf;
  }

  // --- events --------------------------------------------------------------

  // The header cells that carry a data-sort key set the sort the same way
  // the sort dropdown does; keys with no sort of their own fall back to the
  // implied-value order.
  function sortFromHeader(key) {
    if (key === 'rank' || key === 'implied') return 'implied';
    if (key === 'tvl') return 'tvl';
    if (key === 'change') return 'change';
    if (key === 'name') return 'name';
    return 'implied';
  }

  function bind() {
    $('q').addEventListener('input', function () {
      filters.q = $('q').value;
      writeParams();
      renderBoard();
    });
    $('cat').addEventListener('change', function () {
      filters.cat = $('cat').value;
      writeParams();
      renderBoard();
    });
    $('chain').addEventListener('change', function () {
      filters.chain = $('chain').value;
      writeParams();
      renderBoard();
    });
    $('minTvl').addEventListener('change', function () {
      filters.minTvl = parseInt($('minTvl').value, 10);
      writeParams();
      renderBoard();
    });
    $('watchOnly').addEventListener('change', function () {
      filters.watchOnly = $('watchOnly').checked;
      writeParams();
      renderBoard();
    });
    $('sort').addEventListener('change', function () {
      filters.sort = $('sort').value;
      writeParams();
      renderBoard();
    });
    var headers = document.querySelectorAll('#board thead th[data-sort]');
    Array.prototype.forEach.call(headers, function (th) {
      th.addEventListener('click', function () {
        filters.sort = sortFromHeader(th.getAttribute('data-sort'));
        $('sort').value = filters.sort;
        writeParams();
        renderBoard();
      });
    });
    window.addEventListener('hashchange', function () {
      renderBoard();
      renderDetail();
    });
  }

  // --- boot ----------------------------------------------------------------

  fillSelects();
  readParams();
  renderStats();
  renderBoard();
  renderDetail();
  bind();
})();
