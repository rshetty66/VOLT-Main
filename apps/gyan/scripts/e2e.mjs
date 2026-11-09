import { chromium } from '/home/kimi/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:3111';
const fail = (msg) => { console.error('FAIL:', msg); process.exit(1); };

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: 'networkidle' });

// 0. Hero copy: new headline, no agentic-finance kicker, no agent-count claims
const heroText = await page.locator('body').innerText();
if (!/Energize your AI outcomes/i.test(heroText)) fail('new hero headline missing');
if (/Agentic finance transformation/i.test(heroText)) fail('old kicker still present');
if (/89 specialist agents|89 agents/i.test(heroText)) fail('agent-count claim still present');
console.log('hero copy ok');

// 1. Marketplace flattened — one-pool kicker, no count, full registry, model layer
await page.getByRole('button', { name: 'Marketplace' }).click();
await page.waitForTimeout(600);
const kicker = await page.locator('header .micro').first().innerText();
if (!/one pool/i.test(kicker)) fail(`marketplace kicker: ${kicker}`);
if (/\d+ agents/i.test(kicker)) fail(`kicker still states a count: ${kicker}`);
const chips = await page.locator('button.micro.rounded-full').count();
if (chips > 0) fail(`service-line filter chips still present (${chips})`);
const cardCount = await page.locator('.grid button.lift').count();
if (cardCount < 230) fail(`expected full registry in marketplace, got ${cardCount} cards`);
console.log('marketplace ok — kicker:', kicker.trim(), '| cards:', cardCount);

// 1b. Model layer visible: search a dedicated-model specialist, open drawer, "Runs on"
await page.getByPlaceholder(/Search agents/i).fill('OSFI BCAR Master');
await page.waitForTimeout(400);
await page.locator('.grid button.lift').first().click();
await page.waitForTimeout(500);
const mkDrawer = await page.locator('aside').first().innerText();
if (!/runs on/i.test(mkDrawer)) fail('marketplace drawer missing Runs-on model section');
if (!/BCAR Advisor/i.test(mkDrawer)) fail('dedicated model not shown for BCAR specialist');
await page.getByRole('button', { name: 'Close' }).click();
await page.getByPlaceholder(/Search agents/i).fill('');
console.log('marketplace model layer ok');

// 2. Chat: send a short question, wait for the live answer to finish
await page.getByRole('button', { name: 'Assistant', exact: true }).click();
await page.getByPlaceholder(/Ask Gyan/i).fill('In two sentences, what does a record-to-report lead own in a close acceleration?');
await page.getByRole('button', { name: 'Send' }).click();
await page.waitForFunction(
  () => /k3-agent/i.test(document.body.innerText) && !/streaming…/.test(document.body.innerText),
  null,
  { timeout: 120000 },
);
await page.waitForTimeout(800); // let the debounced persistence write land

// 2b. Run card expands to show the model each engaged agent runs on
await page.locator('button', { hasText: /Engaged \d+ agent/i }).first().click();
await page.waitForTimeout(400);
const runCard = await page.locator('body').innerText();
if (!/◆/.test(runCard)) fail('run card does not show backing models');
console.log('run-card model layer ok');

// 3. Browser-local persistence: conversation + deliverable stored
const stored = await page.evaluate(() => ({
  convs: JSON.parse(localStorage.getItem('volt.conversations.v1') ?? '[]'),
  delivs: JSON.parse(localStorage.getItem('volt.deliverables.v1') ?? '[]'),
}));
if (stored.convs.length !== 1) fail(`expected 1 stored conversation, got ${stored.convs.length}`);
if (stored.convs[0].messages.length < 2) fail('stored conversation has no turns');
if (stored.delivs.length !== 1) fail(`expected 1 stored deliverable, got ${stored.delivs.length}`);
if (!stored.delivs[0].name.startsWith('VOLT - ')) fail(`deliverable name: ${stored.delivs[0].name}`);
console.log('persistence ok — conv:', JSON.stringify(stored.convs[0].title), '| deliverable:', stored.delivs[0].name);

// 4. History popover lists the conversation; restore after new conversation
await page.getByRole('button', { name: 'Past conversations' }).click();
await page.waitForTimeout(400);
if (!/saved in this browser only/i.test(await page.locator('body').innerText())) fail('honesty label missing');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'New conversation' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Past conversations' }).click();
await page.waitForTimeout(400);
await page.locator('.group button').first().click();
await page.waitForTimeout(600);
const restored = await page.locator('body').innerText();
if (!/k3-agent/i.test(restored)) fail('restored conversation did not render');
console.log('history restore ok');

// 5. Studio: live deliverable section with card, drawer preview, export row
await page.getByRole('button', { name: 'Studio' }).click();
await page.waitForTimeout(600);
const studioText = await page.locator('body').innerText();
if (!/From your chats/i.test(studioText)) fail('Studio live section missing');
if (!/Engagement showcase/i.test(studioText)) fail('showcase relabel missing');
await page.locator('.grid button.lift').first().click();
await page.waitForTimeout(600);
const drawerText = await page.locator('aside').first().innerText();
if (!/Markdown \(.md\)/i.test(drawerText)) fail('export row missing in deliverable drawer: ' + drawerText.slice(0, 200));
if (!/chat deliverable/i.test(drawerText)) fail('drawer kicker missing');
console.log('studio live deliverables ok');

if (errors.length) fail(`console errors: ${errors.join(' | ')}`);
console.log('ALL E2E PASS');
await browser.close();
