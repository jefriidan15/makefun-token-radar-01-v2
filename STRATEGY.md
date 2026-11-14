# Strategy note — radar-2 (v2)

## Question

For each protocol in the snapshot that records no token, what would its
token be worth if the protocol's record stayed as it is? The board answers
with one number per protocol, the implied value, built only from the
snapshot's own figures: TVL, 7-day TVL change, listing date, chains, and
the market caps of protocols whose tokens already trade.

## Model

```
implied_value_usd = round(tvl_usd × multiple × growth × maturity × breadth)
```

### Multiple — what the market pays per dollar of TVL

For a protocol in category C, take every live-token protocol in C (a
recorded market cap and a positive TVL) and compute market-cap / TVL for
each. If there are 3 or more, the multiple is their median. Otherwise
the multiple is the global median across all 144 live-token protocols in
the snapshot (0.1689 here). The result is clamped to [0.05, 0.60], so a
category whose few peers are extreme — a bridge with a ratio over 1, a
prediction market over 400 — cannot price a protocol at a fantasy
multiple, and a category priced near zero cannot price one at nothing.

The median, not the mean, is used because a single outlier peer would
drag a mean anywhere; the median is the middle peer's price.

### Growth — is the TVL moving?

```
growth = 1 + 0.5 × clamp(change_7d, −60, +120) / 100
```

Only half the 7-day change is credited: a week is noisy, and a single
whale deposit should not double a valuation. The clamp bounds the factor
to [0.70, 1.60]. A protocol with no reported change is treated as flat
(1.00).

### Maturity — how long has it run with no token?

```
maturity = 0.75 + 0.25 × min(age_years / 3, 1)
```

Age is the snapshot's `as_of` minus `listed_at`, in years. A protocol
listed yesterday scores 0.75; one listed 3 or more years ago scores 1.00.
The reasoning is deliberately conservative: survival is evidence, but a
long life with no token is also evidence that a launch is not imminent,
so maturity is a gentle slope, not a multiplier that dominates the board.
A missing listing date counts as 1.5 years (0.875), the middle of the range.

### Breadth — how many chains?

```
breadth = 1 + 0.02 × min(chains − 1, 5)
```

One chain scores 1.00, six or more score 1.10. Multi-chain reach is
worth something — more users, more integrations — but it is the smallest
factor by design: TVL already captures most of what breadth would claim.

## Eligibility — who ranks

A protocol ranks only if it records no token (`gecko_id` and `symbol`
both null) and is not a wrapped, staked or bridged product:

- category in Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking,
  Restaked BTC or CEX → out;
- name carrying a whole word `wrapped`, `staked` or `staking` → out;
- name starting with Binance, Coinbase, Bybit, Kraken, Bitget, OKX,
  Bitfinex or Gemini → out;
- name ending in a version marker (`V2`, `v2`, `2.0`, …) → out.

This mirrors the watchlist rule. In this snapshot it leaves 198 protocols,
including all 40 on the watchlist; the board ranks all 198, so the floor
is never the whole board. Protocols whose token already trades never rank:
they are the comparables the multiple is read from, shown in each detail
view as the three largest live-token protocols of the category.

## Ties and determinism

Rows sort by implied value descending, then TVL descending, then slug
ascending. Ranks are exactly 1…198. No clock and no randomness are used
anywhere, so two runs write byte-identical output.

## Worked check

Take a lending protocol with $200M TVL, a category median of 0.13, +10%
7-day growth, 2 years old, on 2 chains:

```
200,000,000 × 0.13 × 1.05 × 0.9167 × 1.02 ≈ $25.5M
```

The board's top rows are the large, growing, established protocols in
categories the market already prices richly; the bottom rows are small,
young or shrinking ones in thinly priced categories.

## v2 layout — what changed vs v1

v1's board sat in a two-column page next to a detail panel that was
empty until a row was picked, so its cover screenshot left a large dark
void on the right and only four header stats. v2 puts the board full
width, adds a six-metric strip across the top (watchlist covered, rows
scored, rows below the floor, protocols set aside, total implied value,
median multiple), and moves the detail view below the board, hidden until
a row is picked — so the cover shows a dense, legible table with no
empty space. Same radar-2 model, same 198-row board.

## Limits — read before acting on the board

- The multiple assumes a protocol's token would be priced like its
  category's existing tokens. Categories are coarse, and a protocol can be
  unlike its category.
- TVL is a snapshot-day figure. It can be borrowed, mercenary or
  double-counted across chains.
- The model says nothing about whether or when a token launches. A high
  implied value is not a launch signal.
- Farm plans are generic by category group. They name real actions with
  real amounts, but they do not know a protocol's points program, if it
  has one, or its contract risks. Start with a test amount, keep
  approvals minimal, and read the protocol's own docs before depositing.
