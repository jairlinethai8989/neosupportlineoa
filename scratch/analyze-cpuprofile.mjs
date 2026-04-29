import fs from 'node:fs/promises';
import path from 'node:path';

function frameKey(callFrame) {
  const fn = callFrame.functionName || '(anonymous)';
  const rawUrl = callFrame.url || '';
  const url = rawUrl.replace(/http:\/\/127\.0\.0\.1:\d+/g, 'http://localhost');
  const line = callFrame.lineNumber ?? -1;
  const col = callFrame.columnNumber ?? -1;
  return `${fn} @ ${url}:${line}:${col}`;
}

function summarizeProfile(profile) {
  const nodeById = new Map(profile.nodes.map((n) => [n.id, n]));
  const selfByFrame = new Map();
  const totalUs = (profile.timeDeltas || []).reduce((a, b) => a + b, 0);

  for (let i = 0; i < profile.samples.length; i += 1) {
    const nodeId = profile.samples[i];
    const deltaUs = profile.timeDeltas?.[i] ?? 0;
    const node = nodeById.get(nodeId);
    if (!node?.callFrame) continue;
    const key = frameKey(node.callFrame);
    selfByFrame.set(key, (selfByFrame.get(key) || 0) + deltaUs);
  }

  const rows = [...selfByFrame.entries()]
    .map(([frame, us]) => ({ frame, ms: us / 1000, pct: totalUs > 0 ? (us / totalUs) * 100 : 0 }))
    .sort((a, b) => b.ms - a.ms);

  return { totalMs: totalUs / 1000, rows };
}

async function loadProfiles(globBase) {
  const files = [];
  for (let r = 1; r <= 3; r += 1) {
    files.push(path.join(globBase.replace('{r}', String(r)), 'root.cpu-profile.json'));
  }
  const profiles = [];
  for (const f of files) {
    const raw = await fs.readFile(f, 'utf8');
    profiles.push(JSON.parse(raw));
  }
  return profiles;
}

function mergeTop(profiles, topN = 40) {
  const merged = new Map();
  let total = 0;
  for (const p of profiles) {
    const { totalMs, rows } = summarizeProfile(p);
    total += totalMs;
    for (const row of rows.slice(0, topN * 3)) {
      merged.set(row.frame, (merged.get(row.frame) || 0) + row.ms);
    }
  }
  return [...merged.entries()]
    .map(([frame, ms]) => ({ frame, ms, pct: total > 0 ? (ms / total) * 100 : 0 }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, topN);
}

function printTable(title, rows) {
  console.log(`\n=== ${title} ===`);
  for (const r of rows) {
    console.log(`${r.ms.toFixed(1).padStart(7)} ms  ${r.pct.toFixed(2).padStart(6)}%  ${r.frame}`);
  }
}

function diff(beforeRows, afterRows, topN = 30) {
  const b = new Map(beforeRows.map((r) => [r.frame, r.ms]));
  const a = new Map(afterRows.map((r) => [r.frame, r.ms]));
  const keys = new Set([...b.keys(), ...a.keys()]);
  return [...keys]
    .map((k) => ({ frame: k, deltaMs: (a.get(k) || 0) - (b.get(k) || 0), beforeMs: b.get(k) || 0, afterMs: a.get(k) || 0 }))
    .sort((x, y) => y.deltaMs - x.deltaMs)
    .slice(0, topN);
}

function printDiff(title, rows) {
  console.log(`\n=== ${title} ===`);
  for (const r of rows) {
    console.log(
      `${r.deltaMs >= 0 ? '+' : ''}${r.deltaMs.toFixed(1).padStart(7)} ms  (before ${r.beforeMs.toFixed(1)} -> after ${r.afterMs.toFixed(1)})  ${r.frame}`
    );
  }
}

const beforeBase = 'D:/Project APP/AntiGravity/neo_line_oa_before/scratch/profiles-dashboard-prod-clean-r{r}-cold';
const afterBase = 'D:/Project APP/AntiGravity/neo_line_oa/scratch/profiles-dashboard-prod-clean-r{r}-cold';

const beforeProfiles = await loadProfiles(beforeBase);
const afterProfiles = await loadProfiles(afterBase);

const beforeTop = mergeTop(beforeProfiles, 40);
const afterTop = mergeTop(afterProfiles, 40);
printTable('Before Top Self-Time (cold /, 3 runs)', beforeTop);
printTable('After Top Self-Time (cold /, 3 runs)', afterTop);
printDiff('Top Regressed Frames (after - before)', diff(beforeTop, afterTop, 35));
