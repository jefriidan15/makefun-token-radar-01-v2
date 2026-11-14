// radar-2, rewritten — what a pre-token protocol's token would be worth.
//
// A protocol that has not launched a token yet is priced from the snapshot
// alone: the value it has locked, the multiple the market puts on live-token
// protocols doing the same kind of work, the speed its locked value is
// moving, the age of its listing, and the number of chains it runs on.
//
//   implied value = round(tvl x multiple x growth x maturity x breadth)
//
// The four multipliers, in the order they are applied:
//   multiple — median market-cap-to-TVL of live-token protocols in the same
//     category. It takes three peers in the category to use the category
//     median; with fewer, the median across all live-token protocols.
//     Either way the multiple is clamped into [0.05, 0.60].
//   growth — one plus half the protocol's 7-day TVL move, with the move
//     clamped to [-60%, +120%]. A protocol that reports no move is flat.
//   maturity — 0.75 for a protocol listed yesterday, rising linearly to
//     1.00 once it is three years old. A missing listing date is read as
//     a year and a half of age.
//   breadth — plus 2% for every chain after the first, stopping at +10%
//     for six chains or more.
//
// A protocol can rank only when the snapshot records no token for it and it
// is not a wrapped, staked or bridged version of a token that already
// trades. Live-token protocols never rank: they exist here to calibrate the
// multiple. The code reads no clock, no random source and no network, so a
// snapshot always builds the same board.

export interface SnapProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  watchlist: string[];
  protocols: SnapProtocol[];
}

export interface Peer {
  ratio: number;
  slug: string;
  tvl_usd: number;
}

export interface Row {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  watchlist: boolean;
  multiple: number;
  growth_factor: number;
  maturity_factor: number;
  breadth_factor: number;
  peer_count: number;
  comparables: Peer[];
}

// A category whose members can only be a wrapped, staked or bridged product
// of a token that already trades — never a token launch of its own.
export const BLOCKED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

// A name that begins with one of these belongs to an exchange, not to a
// protocol waiting on its own token.
export const EXCHANGE_NAMES = [
  'Binance',
  'Coinbase',
  'Bybit',
  'Kraken',
  'Bitget',
  'OKX',
  'Bitfinex',
  'Gemini',
];

// A version suffix at the end of a name: a space, then V2, v2, 2.0 or similar.
export const VERSION_TAIL = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

// Any whole word wrapped, staked or staking, in either case.
export const WRAPPED_TERM = /\b(wrapped|staked|staking)\b/i;

export const MULT_MIN = 0.05;
export const MULT_MAX = 0.6;

// The middle value of a list, or the mean of the two middle values when the
// list has an even length. An empty list has no middle, so it reads as zero.
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const ordered = values.slice().sort((a, b) => a - b);
  const mid = ordered.length >> 1;
  if (ordered.length % 2 === 1) return ordered[mid]!;
  return (ordered[mid - 1]! + ordered[mid]!) / 2;
}

// Pin a number inside a closed interval.
export function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

// Four decimal places. The published factors carry four decimals, and the
// published value is priced from the rounded factors, so the breakdown on
// the page multiplies out to the value on the board.
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// True when the name or the category marks a wrapped, staked or bridged
// product instead of a protocol of its own.
export function isDerivativeProduct(p: SnapProtocol): boolean {
  if (p.category !== null && BLOCKED_CATEGORIES.has(p.category)) return true;
  if (WRAPPED_TERM.test(p.name) || VERSION_TAIL.test(p.name)) return true;
  return EXCHANGE_NAMES.some((exchange) => p.name.indexOf(exchange) === 0);
}

// True when the snapshot records no token for the protocol.
export function hasNoToken(p: SnapProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

// True when the protocol may be ranked on the board.
export function rankable(p: SnapProtocol): boolean {
  return hasNoToken(p) && !isDerivativeProduct(p);
}

// Whole years between a listing date and the snapshot date, from UTC
// midnights. null when the listing date is missing or unusable.
export function yearsSince(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  const listedMs = Date.parse(listedAt + 'T00:00:00Z');
  const asOfMs = Date.parse(asOf + 'T00:00:00Z');
  if (Number.isNaN(listedMs) || Number.isNaN(asOfMs)) return null;
  if (asOfMs < listedMs) return null;
  return (asOfMs - listedMs) / 31557600000;
}

// One plus half the 7-day TVL move, the move clamped first. A protocol
// that reports no move is treated as flat.
export function growthOf(change7d: number | null): number {
  const move = change7d === null ? 0 : clamp(change7d, -60, 120);
  return 1 + 0.5 * (move / 100);
}

// The maturity multiplier for a listing of a given age. A null age — no
// usable listing date — is read as a year and a half.
export function maturityOf(age: number | null): number {
  const years = age === null ? 1.5 : age;
  return 0.75 + 0.25 * Math.min(years / 3, 1);
}

// The breadth multiplier for a protocol on this many chains.
export function breadthOf(nChains: number): number {
  const extra = Math.max(nChains - 1, 0);
  return 1 + 0.02 * Math.min(extra, 5);
}

// Medians the multiple is read from: one across every live-token protocol
// and one per category, each with the peer count behind it.
export interface CategoryMultiples {
  global: number;
  perCategory: Map<string, { median: number; count: number }>;
}

// A live-token protocol is one the snapshot carries a market cap for, on a
// positive TVL. Ratios group by the protocol's category for the per-category
// medians; the global median reads all of them at once.
export function categoryMultiples(protocols: SnapProtocol[]): CategoryMultiples {
  const priced = protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0);
  const global = median(priced.map((p) => p.mcap_usd! / p.tvl_usd));
  const byCategory = new Map<string, number[]>();
  for (const p of priced) {
    const key = p.category === null ? '' : p.category;
    const bucket = byCategory.get(key);
    if (bucket === undefined) {
      byCategory.set(key, [p.mcap_usd! / p.tvl_usd]);
    } else {
      bucket.push(p.mcap_usd! / p.tvl_usd);
    }
  }
  const perCategory = new Map<string, { median: number; count: number }>();
  byCategory.forEach((ratios, key) => {
    perCategory.set(key, { median: median(ratios), count: ratios.length });
  });
  return { global, perCategory };
}

// The multiple for one category: its own median when it has at least three
// priced peers, else the global median. The peer count is reported either
// way, so the page can say which median priced the row.
export function multipleForCategory(
  category: string | null,
  mults: CategoryMultiples,
): { multiple: number; peers: number } {
  const entry = mults.perCategory.get(category === null ? '' : category);
  const peers = entry === undefined ? 0 : entry.count;
  const raw = peers >= 3 && entry !== undefined ? entry.median : mults.global;
  return { multiple: clamp(raw, MULT_MIN, MULT_MAX), peers };
}

// The three biggest live-token protocols in the category, as comparables.
// Ties on TVL break on slug so the order is stable run to run.
export function topPeers(
  category: string | null,
  protocols: SnapProtocol[],
): Peer[] {
  const sameCategory = protocols.filter(
    (p) => p.category === category && p.mcap_usd !== null && p.tvl_usd > 0,
  );
  sameCategory.sort((a, b) => {
    if (b.tvl_usd !== a.tvl_usd) return b.tvl_usd - a.tvl_usd;
    if (a.slug === b.slug) return 0;
    return a.slug < b.slug ? -1 : 1;
  });
  return sameCategory.slice(0, 3).map((p) => ({
    slug: p.slug,
    ratio: Math.round((p.mcap_usd! / p.tvl_usd) * 10000) / 10000,
    tvl_usd: p.tvl_usd,
  }));
}

// Price one rankable protocol: read its multiple and its three remaining
// factors, round all four to four decimals, then price from the rounded
// factors so the published breakdown multiplies out to the published value.
function priceOne(
  p: SnapProtocol,
  protocols: SnapProtocol[],
  mults: CategoryMultiples,
  asOf: string,
  onWatch: boolean,
): Row {
  const picked = multipleForCategory(p.category, mults);
  const multiple = round4(picked.multiple);
  const growth = round4(growthOf(p.change_7d));
  const maturity = round4(maturityOf(yearsSince(p.listed_at, asOf)));
  const breadth = round4(breadthOf(p.chains.length));
  const implied = Math.round(p.tvl_usd * multiple * growth * maturity * breadth);
  return {
    slug: p.slug,
    name: p.name,
    rank: 0,
    implied_value_usd: implied,
    farm_steps: [],
    category: p.category,
    chains: [...p.chains].sort(),
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    listed_at: p.listed_at,
    watchlist: onWatch,
    multiple,
    growth_factor: growth,
    maturity_factor: maturity,
    breadth_factor: breadth,
    peer_count: picked.peers,
    comparables: topPeers(p.category, protocols),
  };
}

// Highest implied value first; ties break on TVL, then on slug.
function byImpliedValue(x: Row, y: Row): number {
  if (y.implied_value_usd !== x.implied_value_usd) {
    return y.implied_value_usd - x.implied_value_usd;
  }
  if (y.tvl_usd !== x.tvl_usd) return y.tvl_usd - x.tvl_usd;
  if (x.slug === y.slug) return 0;
  return x.slug < y.slug ? -1 : 1;
}

// Rank every rankable protocol by implied value, highest first, and number
// the rows in that order.
export function buildRows(snapshot: Snapshot): Row[] {
  const onWatchlist = new Set(snapshot.watchlist);
  const mults = categoryMultiples(snapshot.protocols);
  const ranked: Row[] = [];
  for (const protocol of snapshot.protocols) {
    if (!rankable(protocol)) continue;
    ranked.push(
      priceOne(protocol, snapshot.protocols, mults, snapshot.as_of, onWatchlist.has(protocol.slug)),
    );
  }
  ranked.sort(byImpliedValue);
  ranked.forEach((row, index) => {
    row.rank = index + 1;
  });
  return ranked;
}
