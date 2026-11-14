// Token Radar v2 — entrypoint.
//
// Reads the sealed snapshot, ranks every pre-token protocol by the radar-2
// implied value, and writes the board, the dashboard and the dossier:
//
//   /output/board.json        the ranked board (198 rows)
//   /output/dashboard/        index.html, app.css, app.js, steps.js, data.js
//   /output/screenshots/      the three dashboard screenshots, copied
//   /output/dossier.json      buildDossier of the dashboard + screenshots
//
// Run locally from the repository root:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot>
//
// In the grading sandbox it reads /input/snapshot.json and writes /output.
// No clock, no randomness, no network: two runs write byte-identical files.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRows } from './lib/model.ts';
import { RadarSteps } from './lib/farm.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));

function flagAfter(argv: string[], name: string): string | null {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1]! : null;
}

function main(): void {
  const argv = process.argv.slice(2);
  const inputPath =
    flagAfter(argv, '--input') ??
    process.env.MAKEFUN_INPUT ??
    '/input/snapshot.json';
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  const snapshot = JSON.parse(readFileSync(inputPath, 'utf8'));
  const rows = buildRows(snapshot);
  for (const row of rows) {
    row.farm_steps = RadarSteps.build(row);
  }

  mkdirSync(outputDir, { recursive: true });
  const dashOut = join(outputDir, 'dashboard');
  const shotsOut = join(outputDir, 'screenshots');
  mkdirSync(dashOut, { recursive: true });
  mkdirSync(shotsOut, { recursive: true });

  // The board: meta first, then the rows in rank order.
  const board = {
    model: 'radar-2',
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    rows,
  };
  writeFileSync(join(outputDir, 'board.json'), `${JSON.stringify(board, null, 2)}\n`);

  // The dashboard: copy the page, style and app, then generate the two
  // files the page's data lives in.
  const dashSrc = join(REPO_ROOT, 'dashboard');
  for (const name of readdirSync(dashSrc).sort()) {
    cpSync(join(dashSrc, name), join(dashOut, name));
  }
  const farmSrc = readFileSync(join(REPO_ROOT, 'lib', 'farm.ts'), 'utf8');
  const stepsJs = farmSrc.replace(/^export /gm, '');
  writeFileSync(join(dashOut, 'steps.js'), stepsJs);
  // Compact rows: categories and chains repeat heavily across 198 rows,
  // so data.js carries one dictionary of each and rows hold indices.
  const cats = [...new Set(rows.map((r) => r.category ?? ''))].sort();
  const catIdx = new Map(cats.map((c, i) => [c, i]));
  const chains = [...new Set(rows.flatMap((r) => r.chains))].sort();
  const chainIdx = new Map(chains.map((c, i) => [c, i]));
  const compactRows = rows.map((r) => [
    r.slug,
    r.name,
    catIdx.get(r.category ?? '')!,
    r.chains.map((c) => chainIdx.get(c)!).join('|'),
    r.tvl_usd,
    // Two decimals are all the page shows; the factors below stay at four
    // so the page's recompute of the implied value still matches the board.
    r.change_7d === null ? null : Math.round(r.change_7d * 100) / 100,
    r.listed_at,
    r.implied_value_usd,
    r.multiple,
    r.growth_factor,
    r.maturity_factor,
    r.breadth_factor,
    r.watchlist ? 1 : 0,
    // Peer TVL stays in board.json; the page shows slug and ratio only.
    r.comparables.map((c) => `${c.slug}:${Math.round(c.ratio * 100) / 100}`).join(','),
    r.peer_count,
  ]);
  const dataJs =
    `window.RADAR = ${JSON.stringify({ asOf: snapshot.as_of, model: 'radar-2', totalProtocols: snapshot.protocols.length, cats, chains, rows: compactRows })};\n`;
  writeFileSync(join(dashOut, 'data.js'), dataJs);

  // The screenshots, as committed in the repository.
  const shotsSrc = join(REPO_ROOT, 'screenshots');
  if (existsSync(shotsSrc)) {
    for (const name of readdirSync(shotsSrc).sort()) {
      if (name.startsWith('.')) continue;
      cpSync(join(shotsSrc, name), join(shotsOut, name));
    }
  }

  const dossier = buildDossier(outputDir, { text_max_bytes: 65536 });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);

  console.log(`token-radar v2 radar-2: ${rows.length} rows, as_of ${snapshot.as_of}`);
  console.log(`board: ${join(outputDir, 'board.json')}`);
  console.log(`dossier: ${dossier.length} bytes`);
}

main();
