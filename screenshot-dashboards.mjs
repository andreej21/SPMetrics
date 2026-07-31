import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const routes = [
  { name: 'overview', url: 'http://localhost:3001/dashboard' },
  { name: 'attribution', url: 'http://localhost:3001/dashboard/attribution' },
  { name: 'campaigns', url: 'http://localhost:3001/dashboard/campaigns' },
  { name: 'cohorts', url: 'http://localhost:3001/dashboard/cohorts' },
];

for (const route of routes) {
  try {
    await page.goto(route.url, { waitUntil: 'networkidle', timeout: 10000 });
    await page.screenshot({ path: `screenshot-${route.name}.png`, fullPage: true });
    console.log(`✓ ${route.name}`);
  } catch (e) {
    console.log(`✗ ${route.name}: ${e.message}`);
  }
}

await browser.close();
console.log('Done');
