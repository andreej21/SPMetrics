import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'screenshot-full.png', fullPage: true });
await browser.close();
console.log('Screenshot saved');
