/**
 * Captures avant / après de 4 écrans clés en mobile (390 px), clair et sombre.
 *   PREFIX=avant|apres BASE=... OUT=... node tests/e2e/b4-shots.mjs
 */
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5180';
const OUT = process.env.OUT ?? './test-results';
const PREFIX = process.env.PREFIX ?? 'apres';
const A = { user: process.env.A_USER ?? 'testeur1', pass: process.env.A_PASS ?? 'TestLocal123' };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, hasTouch: true, isMobile: true });
	const p = await ctx.newPage();
	const go = (u) => p.goto(BASE + u, { waitUntil: 'networkidle' });
	await go('/login');
	await p.fill('input[name=username]', A.user);
	await p.fill('input[name=password]', A.pass);
	await p.click('button:has-text("Se connecter")');
	await p.waitForURL(BASE + '/');
	await p.waitForLoadState('networkidle');
	const s = scheme === 'dark' ? '-sombre' : '';
	await p.screenshot({ path: `${OUT}/b4-${PREFIX}-1-accueil${s}.png` });
	await go('/album?own=owned');
	await p.screenshot({ path: `${OUT}/b4-${PREFIX}-2-album${s}.png` });
	await go('/album?own=owned&sort=rarity');
	await p.locator('.grid-cards a.card-link').first().click();
	await p.waitForURL(/\/card\/\d+/);
	await p.waitForTimeout(400);
	await p.screenshot({ path: `${OUT}/b4-${PREFIX}-3-carte${s}.png`, fullPage: true });
	if (scheme === 'light') {
		await go('/duels/new?vs=bot');
		const deck = p.locator('.picker .pick');
		for (let i = 0; i < 3; i++) await deck.nth(i).click();
		await p.click('[data-testid=start-duel]');
		await p.waitForURL(/\/duels\/\d+/);
		await p.waitForTimeout(500);
		await p.screenshot({ path: `${OUT}/b4-${PREFIX}-4-duel${s}.png` });
	} else {
		await go('/quests');
		await p.screenshot({ path: `${OUT}/b4-${PREFIX}-4-quetes${s}.png` });
	}
	await ctx.close();
}
await browser.close();
console.log('captures', PREFIX, 'OK');
