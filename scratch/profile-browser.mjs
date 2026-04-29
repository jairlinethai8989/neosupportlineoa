import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.argv[2];
const outDir = process.argv[3];
const routeArg = process.argv[4] || '/,/inbox,/tickets,/reports/daily,/reports/hub';
const routes = routeArg.split(',').map((r) => r.trim()).filter(Boolean);

if (!baseUrl || !outDir) {
  console.error('Usage: node scratch/profile-browser.mjs <baseUrl> <outDir> [routesCsv]');
  process.exit(1);
}

await fs.mkdir(outDir, { recursive: true });

async function saveCpuProfile(client, outFile) {
  const { profile } = await client.send('Profiler.stop');
  await fs.writeFile(outFile, JSON.stringify(profile));
}

const browser = await chromium.launch({ headless: true });

try {
  const metrics = [];

  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const label = route === '/' ? 'root' : route.replaceAll('/', '_').replaceAll(':', '_');
    const cpuPath = path.join(outDir, `${label}.cpu-profile.json`);
    const shotPath = path.join(outDir, `${label}.png`);

    const client = await page.context().newCDPSession(page);
    await client.send('Profiler.enable');
    await client.send('Profiler.start');

    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForTimeout(200);

    await saveCpuProfile(client, cpuPath);
    await client.detach();

    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find((p) => p.name === 'first-contentful-paint');
      return {
        route: window.location.pathname,
        domContentLoadedMs: nav ? Number(nav.domContentLoadedEventEnd.toFixed(2)) : null,
        loadEventMs: nav ? Number(nav.loadEventEnd.toFixed(2)) : null,
        responseEndMs: nav ? Number(nav.responseEnd.toFixed(2)) : null,
        transferSize: nav ? nav.transferSize : null,
        fcpMs: fcp ? Number(fcp.startTime.toFixed(2)) : null,
      };
    });

    metrics.push(perf);
    await page.screenshot({ path: shotPath, fullPage: true });
    await page.close();
  }

  await fs.writeFile(
    path.join(outDir, 'metrics.json'),
    JSON.stringify({ baseUrl, routes, metrics }, null, 2)
  );
} finally {
  await browser.close();
}
