// Farm plans for the radar board.
//
// One file, two readers: main.ts imports it to write board.json, and
// main.ts also ships it to the dashboard as dashboard/steps.js (with the
// leading `export ` of each declaration stripped), so the page renders
// exactly the plan the board carries. That is why this file is plain
// JavaScript with no type annotations: it must run unchanged in a browser
// as well as under Node 22.
//
// Every plan has 7 steps. Steps 1, 5, 6 and 7 are the same discipline
// for every protocol; steps 2, 3 and 4 depend on the protocol's category
// group, so a lending market, a DEX, a vault and a tokenised asset each
// get a plan naming what its own users actually do. Each step carries a
// concrete amount, a cadence or a limit — never a slogan.

export function fmtUsd(n) {
  if (n >= 1000000000) return '$' + (n / 1000000000).toFixed(2) + 'B';
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'K';
  return '$' + Math.round(n);
}

export function groupFor(category) {
  if (category === null || category === undefined) return 'default';
  const lending = new Set([
    'Lending', 'CDP', 'CDP Manager', 'Collateral Markets',
    'Collateral Management', 'Uncollateralized Lending',
    'Leveraged Farming', 'Interest Rate Derivatives',
  ]);
  const dex = new Set([
    'Dexs', 'Derivatives', 'Prediction Market', 'Options',
    'Options Vault', 'Synthetics', 'Cross Chain Bridge',
  ]);
  const yieldGroup = new Set([
    'Yield', 'Yield Aggregator', 'Farm', 'Liquidity Manager',
    'Risk Curators', 'Onchain Capital Allocator', 'Basis Trading',
    'Restaking', 'Staking Pool', 'Anchor BTC', 'Decentralized BTC',
  ]);
  const rwa = new Set([
    'RWA', 'Dual-Token Stablecoin', 'Stablecoin Wrapper', 'Payments',
    'Crypto Card Issuer', 'CeDeFi', 'Insurance', 'Indexes',
    'Governance Incentives', 'OTC Marketplace', 'Token Locker',
    'Stablecoin Issuer', 'Algo-Stables',
  ]);
  if (lending.has(category)) return 'lending';
  if (dex.has(category)) return 'dex';
  if (yieldGroup.has(category)) return 'yield';
  if (rwa.has(category)) return 'rwa';
  return 'default';
}

// Step 1, every protocol: separate the money from the risk first.
export function stepSetup(c) {
  return (
    'Make a fresh wallet for ' + c.name + ' on ' + c.chain +
    ', funded with only the money you plan to use this week. Keep your ' +
    'main funds in a different wallet, so one bad approval can never ' +
    'reach them.'
  );
}

// Step 5, every protocol: the cadence that actually counts.
export function stepCadence(c) {
  return (
    'Stay active for at least 8 weeks: one genuine interaction a week, ' +
    'roughly 15 minutes each, beats a burst of activity in a single ' +
    'afternoon — a steady history is what launch checks reward.'
  );
}

// Step 6, every protocol: keep the proof.
export function stepRecords(c) {
  return (
    'Write down every transaction hash, date and amount, and screenshot ' +
    'your position on ' + c.name + ' once a month. A dated record is ' +
    'what an airdrop or points check usually asks for.'
  );
}

// Step 7, every protocol: close the loop safely.
export function stepSafety(c) {
  return (
    'When you are done, revoke approvals you no longer need, watch ' +
    c.name + ' announcements for contract changes, and never sign a ' +
    'transaction you cannot read. If the protocol migrates, move quickly.'
  );
}

// Steps 2, 3 and 4, one set per category group. Each entry is a
// function of the same context c: { name, chain, category, tvl, implied, rank }.
export const GROUP_STEPS = {
  lending: [
    function (c) {
      return (
        'Put collateral into the ' + c.name + ' lending market on ' +
        c.chain + ' — begin with a test deposit near $25 — and confirm ' +
        'the receipt and your position there before adding more.'
      );
    },
    function (c) {
      return (
        'Borrow against the deposit at a low loan-to-value, under 40%, ' +
        'and use what you borrow only inside ' + c.name + ' or to repay ' +
        'the same position. Read the borrow rate and liquidation price first.'
      );
    },
    function (c) {
      return (
        'Run the deposit-and-borrow loop once a week with fresh funds ' +
        'instead of daily, and note each transaction hash, amount and ' +
        'date so your activity is dated and easy to prove.'
      );
    },
  ],
  dex: [
    function (c) {
      return (
        'Swap a test amount near $25 through ' + c.name + ' on ' +
        c.chain + ' and check the price impact and fee before any ' +
        'bigger trade. Use the pool with the deepest liquidity, not the ' +
        'newest one.'
      );
    },
    function (c) {
      return (
        'Add liquidity to the busiest ' + c.name + ' pool on ' + c.chain +
        ' in equal value on both sides, and keep the position at least ' +
        'two weeks so trading fees and volume build up on it.'
      );
    },
    function (c) {
      return (
        'Send a real trade through ' + c.name + ' at least once a week ' +
        '— a swap you would make anyway — instead of wash-trading the ' +
        'same tokens back and forth, which earns nothing and costs gas.'
      );
    },
  ],
  yield: [
    function (c) {
      return (
        'Deposit near $25 into the highest-TVL ' + c.name + ' vault on ' +
        c.chain + ' as a test, confirm the vault shares land in your ' +
        'wallet, and read the strategy description before adding more.'
      );
    },
    function (c) {
      return (
        'Stake or lock the vault receipt token when ' + c.name + ' offers ' +
        'one, and claim rewards only when the claim is worth more than ' +
        'the gas it costs. Small claims made daily lose money.'
      );
    },
    function (c) {
      return (
        'Rebalance once a month: move funds only when a vault TVL or ' +
        'strategy changes, and keep a dated note of every deposit, ' +
        'withdrawal and reward claim so the whole history sits in one place.'
      );
    },
  ],
  rwa: [
    function (c) {
      return (
        'Buy a test position near $25 of the ' + c.name + ' tokenised ' +
        'asset on ' + c.chain + ' and check the holding shows in your ' +
        'wallet and on the protocol own dashboard before sizing up.'
      );
    },
    function (c) {
      return (
        'Hold the position at least 30 days and, where the protocol ' +
        'pays yield, claim it only when the payout covers the ' +
        'transaction fee. Frequent small claims are a slow leak.'
      );
    },
    function (c) {
      return (
        'Read the underlying asset backing or attestation report every ' +
        'month, and shrink the position when a report is late or the peg ' +
        'slips by more than 1%. The backing is the whole point of the asset.'
      );
    },
  ],
  default: [
    function (c) {
      return (
        'Use ' + c.name + ' on ' + c.chain + ' once with a test ' +
        'transaction near $25, and confirm it lands on-chain before you ' +
        'commit larger amounts or repeat the action.'
      );
    },
    function (c) {
      return (
        'Return weekly and repeat the protocol core action — the one its ' +
        'own docs describe first — with a real amount you can afford to ' +
        'leave in place for a month or more.'
      );
    },
    function (c) {
      return (
        'Join the official ' + c.name + ' community channel and follow ' +
        'its announcements, so you hear about new features, migrations ' +
        'or snapshot dates from the source instead of a rumour.'
      );
    },
  ],
};

/** The 7 farm steps for one board row. */
export function buildFarmSteps(row) {
  const c = {
    name: row.name,
    chain: row.chains.length > 0 ? row.chains[0] : 'its main chain',
    category: row.category,
    tvl: fmtUsd(row.tvl_usd),
    implied: fmtUsd(row.implied_value_usd),
    rank: row.rank,
  };
  const middle = GROUP_STEPS[groupFor(row.category)];
  return [
    stepSetup(c),
    middle[0](c),
    middle[1](c),
    middle[2](c),
    stepCadence(c),
    stepRecords(c),
    stepSafety(c),
  ];
}

export const RadarSteps = {
  build: buildFarmSteps,
  groupFor: groupFor,
  fmtUsd: fmtUsd,
};
