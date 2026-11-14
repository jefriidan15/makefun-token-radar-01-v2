# Token Radar v2 — make.fun token-radar-01

A token launch radar: 198 pre-token protocols ranked by the implied value
their token would carry if the protocol's record stayed as it is.

## The model (radar-2)

```
implied_value_usd = round(tvl_usd × multiple × growth × maturity × breadth)
```

- **Multiple** — median market-cap / TVL of live-token protocols in the
  same category (3+ peers, else the global median), clamped to 0.05–0.60.
- **Growth** — half the 7-day TVL change, clamped to −60%…+120%.
- **Maturity** — 0.75 + 0.25 × min(age / 3y, 1); a missing listing date
  counts as 1.5 years.
- **Breadth** — +2% per extra chain, up to +10%.

Only protocols that record no token rank, and never a wrapped, staked or
bridged product — the same rule as the snapshot's watchlist. All 40
watchlist protocols are on the board; 158 more rows sit below the $50M
floor, and 560 protocols of the snapshot are set aside (they record a
token or are a derivative product).

## The dashboard

- Full-width ranked board with a six-metric strip: watchlist covered,
  rows scored, rows below the floor, protocols set aside, total implied
  value, median multiple.
- Search, category / chain / TVL filters, watchlist-only toggle, sorting.
- Click any row for the full detail view below the board: value
  breakdown, comparables, a 7-step farm plan and risks.

## Run it

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Reads the sealed snapshot, writes `board.json`, `dashboard/`,
`screenshots/` and `dossier.json` under the output directory. No clock,
no randomness, no network — two runs write byte-identical files.

## What changed vs v1

The v1 board sat in a two-column page next to an empty detail panel, so
its cover screenshot left a large dark void on the right. v2 puts the
board full width, adds the six-metric strip, and moves the detail view
below the board (hidden until a row is picked), so the cover shows a
dense, legible table with no empty space. Same radar-2 model, same
198-row board.
