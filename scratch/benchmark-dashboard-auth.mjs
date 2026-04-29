import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.argv[2];
const outFile = process.argv[3];
const username = process.argv[4];
const password = process.argv[5];

if (!baseUrl || !outFile || !username || !password) {
  console.error('Usage: node benchmark-dashboard-auth.mjs <baseUrl> <outFile.json> <username> <password>');
  process.exit(1);
}

async function saveCpuProfile(client, outFilePath) {
  const { profile } = await client.send('Profiler.stop');
  await fs.writeFile(outFilePath, JSON.stringify(profile));
}

async function measurePage(context, url, cpuOutPath) {
  const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
  const client = await page.context().newCDPSession(page);
  await client.send('Profiler.enable');
  await client.send('Profiler.start');

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  await page.waitForTimeout(200);

  await saveCpuProfile(client, cpuOutPath);
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

  await page.close();
  return perf;
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const loginPage = await context.newPage({ viewport: { width: 1440, height: 900 } });

  await loginPage.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await loginPage.fill('input[type="text"]', username);
  await loginPage.fill('input[type="password"]', password);
  await Promise.all([
    loginPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 }),
    loginPage.click('button[type="submit"]'),
  ]);
  await loginPage.waitForLoadState('networkidle', { timeout: 60000 });
  await loginPage.close();

  const dir = path.dirname(outFile);
  await fs.mkdir(dir, { recursive: true });

  const coldCpu = outFile.replace(/\.json$/i, '.cold.cpu-profile.json');
  const warmCpu = outFile.replace(/\.json$/i, '.warm.cpu-profile.json');

  const cold = await measurePage(context, `${baseUrl}/`, coldCpu);
  const warm = await measurePage(context, `${baseUrl}/`, warmCpu);

  await fs.writeFile(outFile, JSON.stringify({ baseUrl, cold, warm }, null, 2));
  await context.close();
} finally {
  await browser.close();
}

