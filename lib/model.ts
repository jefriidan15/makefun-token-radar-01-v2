// radar-2 (v2) — what a pre-token protocol's token would be worth.
//
// The board prices each protocol from the snapshot alone:
//
//   implied = round(tvl * multiple * growth * maturity * breadth)
//
//   multiple  median mcap/TVL of live-token protocols in the same
//             category (needs 3+ peers, else the global median),
//             clamped to [0.05, 0.60]
//   growth    1 + 0.5 * clamp(change_7d, -60, +120) / 100; flat when
//             the snapshot reports no change
//   maturity  0.75 + 0.25 * min(age_years / 3, 1); a missing listing
//             date counts as 1.5 years
//   breadth   1 + 0.02 * min(chains - 1, 5); at most 1.10
//
// A protocol ranks only when it records no token and is not a wrapped,
// staked or bridged product, mirroring the watchlist rule. Protocols
// whose token already trades never rank: they are the comparables the
// multiple is read from. No clock, no randomness, no network — the same
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
  protocols: SnapProtocol[];
  watchlist: string[];
}

export interface Peer {
  slug: string;
  ratio: number;
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

// Categories that can only be a wrapped, staked or bridged product of a
// token that already trades, so they never launch a token of their own.
export const BLOCKED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

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

// A trailing version marker: a space, then V2, v2, 2.0 or similar.
export const VERSION_TAIL = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

// A whole word wrapped, staked or staking, any case.
export const WRAPPED_TERM = /\b(wrapped|staked|staking)\b/i;

export const MULT_MIN = 0.05;
export const MULT_MAX = 0.6;

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** True when the name or category marks a wrapped/staked/bridged product. */
export function isDerivativeProduct(p: SnapProtocol): boolean {
  if (p.category !== null && BLOCKED_CATEGORIES.has(p.category)) return true;
  if (WRAPPED_TERM.test(p.name)) return true;
  if (VERSION_TAIL.test(p.name)) return true;
  for (const name of EXCHANGE_NAMES) {
    if (p.name.startsWith(name)) return true;
  }
  return false;
}

/** True when the snapshot records no token for the protocol. */
export function hasNoToken(p: SnapProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/** True when the protocol may be ranked on the board. */
export function rankable(p: SnapProtocol): boolean {
  return hasNoToken(p) && !isDerivativeProduct(p);
}

export function yearsSince(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  const from = Date.parse(`${listedAt}T00:00:00Z`);
  const to = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return (to - from) / (365.25 * 24 * 60 * 60 * 1000);
}

export function growthOf(change7d: number | null): number {
  const c = change7d === null ? 0 : clamp(change7d, -60, 120);
  return 1 + 0.5 * (c / 100);
}

export function maturityOf(age: number | null): number {
  const years = age === null ? 1.5 : age;
  return 0.75 + 0.25 * Math.min(years / 3, 1);
}

export function breadthOf(nChains: number): number {
  return 1 + 0.02 * Math.min(Math.max(nChains - 1, 0), 5);
}

export interface CategoryMultiples {
  global: number;
  perCategory: Map<string, { median: number; count: number }>;
}

/** Median mcap/TVL of live-token protocols, per category and overall. */
export function categoryMultiples(protocols: SnapProtocol[]): CategoryMultiples {
  const live = protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0);
  const global = median(live.map((p) => p.mcap_usd! / p.tvl_usd));
  const buckets = new Map<string, number[]>();
  for (const p of live) {
    const key = p.category ?? '';
    const list = buckets.get(key) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    buckets.set(key, list);
  }
  const perCategory = new Map<string, { median: number; count: number }>();
  for (const [key, ratios] of buckets) {
    perCategory.set(key, { median: median(ratios), count: ratios.length });
  }
  return { global, perCategory };
}

export function multipleForCategory(
  category: string | null,
  mults: CategoryMultiples,
): { multiple: number; peers: number } {
  const found = mults.perCategory.get(category ?? '');
  const count = found === undefined ? 0 : found.count;
  if (count >= 3) {
    return { multiple: clamp(found!.median, MULT_MIN, MULT_MAX), peers: count };
  }
  return { multiple: clamp(mults.global, MULT_MIN, MULT_MAX), peers: count };
}

/** The three biggest live-token protocols in the category, as comparables. */
export function topPeers(
  category: string | null,
  protocols: SnapProtocol[],
): Peer[] {
  return protocols
    .filter((p) => p.category === category && p.mcap_usd !== null && p.tvl_usd > 0)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, 3)
    .map((p) => ({
      slug: p.slug,
      ratio: Math.round((p.mcap_usd! / p.tvl_usd) * 10000) / 10000,
      tvl_usd: p.tvl_usd,
    }));
}

/** Rank every rankable protocol by implied value, highest first. */
export function buildRows(snapshot: Snapshot): Row[] {
  const onWatchlist = new Set(snapshot.watchlist);
  const mults = categoryMultiples(snapshot.protocols);
  const rows: Row[] = [];
  for (const p of snapshot.protocols) {
    if (!rankable(p)) continue;
    const { multiple, peers } = multipleForCategory(p.category, mults);
    const growth = growthOf(p.change_7d);
    const maturity = maturityOf(yearsSince(p.listed_at, snapshot.as_of));
    const breadth = breadthOf(p.chains.length);
    // Round the factors first, then price from the rounded factors, so
    // the published breakdown multiplies out to the published value.
    const m = Math.round(multiple * 10000) / 10000;
    const g = Math.round(growth * 10000) / 10000;
    const a = Math.round(maturity * 10000) / 10000;
    const b = Math.round(breadth * 10000) / 10000;
    const implied = Math.round(p.tvl_usd * m * g * a * b);
    rows.push({
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
      watchlist: onWatchlist.has(p.slug),
      multiple: m,
      growth_factor: g,
      maturity_factor: a,
      breadth_factor: b,
      peer_count: peers,
      comparables: topPeers(p.category, snapshot.protocols),
    });
  }
  rows.sort(
    (x, y) =>
      y.implied_value_usd - x.implied_value_usd ||
      y.tvl_usd - x.tvl_usd ||
      (x.slug < y.slug ? -1 : 1),
  );
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });
  return rows;
}
