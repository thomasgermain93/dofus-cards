/**
 * Boucle 1 : nouveau design des cartes et ouverture animée (captures + vérifications).
 * Lancer le serveur avec DEV_PACK_LAST_RARITY=5 pour forcer une Légendaire en dernière carte.
 *
 *   BASE=... OUT=... A_USER=... A_PASS=... PLAYWRIGHT=.../playwright/index.mjs node tests/e2e/b1-cards.mjs
 */
import { mkdirSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5180';
const OUT = process.env.OUT ?? './test-results';
const A = { user: process.env.A_USER ?? 'testeur1', pass: process.env.A_PASS ?? 'TestLocal123' };
mkdirSync(OUT, { recursive: true });

let failures = 0;
const ok = (c, m) => {
	console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
	if (!c) failures++;
};
const browser = await chromium.launch();

async function session(viewport, extra = {}) {
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'fr-FR', ...extra });
	const p = await ctx.newPage();
	const goto = p.goto.bind(p);
	p.goto = (url, opts) => goto(url, { waitUntil: 'networkidle', ...opts });
	p.on('pageerror', (e) => {
		console.log('erreur JS :', e.message);
		failures++;
	});
	await p.goto(BASE + '/login');
	await p.fill('input[name=username]', A.user);
	await p.fill('input[name=password]', A.pass);
	await p.click('button:has-text("Se connecter")');
	await p.waitForURL(BASE + '/');
	await p.waitForLoadState('networkidle');
	return p;
}
const shot = (p, n, full = false) => p.screenshot({ path: `${OUT}/b1-${n}.png`, fullPage: full });

for (const [vp, tag, extra] of [
	[{ width: 390, height: 844 }, 'm', { hasTouch: true, isMobile: true }],
	[{ width: 1440, height: 900 }, 'd', {}]
]) {
	const p = await session(vp, extra);

	// --- Ouverture ---
	const btn = p.locator('[data-testid=open-pack]');
	if (!(await btn.isDisabled())) {
		await btn.click();
		const pack = p.locator('[data-testid=pack]');
		await pack.waitFor();
		await p.waitForTimeout(400);
		await shot(p, `${tag}-ouverture-1-booster`);
		// geste de déchirure à moitié (souris), pour la capture
		const b = await pack.boundingBox();
		await p.mouse.move(b.x + 10, b.y + 20);
		await p.mouse.down();
		await p.mouse.move(b.x + b.width * 0.45, b.y + 20, { steps: 8 });
		await p.waitForTimeout(150);
		await shot(p, `${tag}-ouverture-2-dechirure`);
		await p.mouse.move(b.x + b.width * 0.95, b.y + 20, { steps: 6 });
		await p.mouse.up();
		await p.waitForSelector('[data-testid=reveal-stage]');
		await p.waitForTimeout(1300);
		await shot(p, `${tag}-ouverture-3-carte`);
		// cartes suivantes jusqu'à l'avant-dernière, puis suspense de la dernière
		for (let i = 0; i < 3; i++) {
			await p.click('[data-testid=reveal-stage]');
			await p.waitForTimeout(1900);
		}
		await p.click('[data-testid=reveal-stage]');
		await p.waitForTimeout(700);
		const teaser = await p.locator('.teaser').count();
		await shot(p, `${tag}-ouverture-4-suspense`);
		await p.waitForTimeout(1250);
		await shot(p, `${tag}-ouverture-5-revelation`);
		ok(teaser > 0, `[${tag}] suspense avant la dernière carte`);
		await p.waitForTimeout(1500);
		await shot(p, `${tag}-ouverture-6-carte-finale`);
		ok((await p.locator('.flipper.flipped').count()) === 1, `[${tag}] carte retournée`);
		await p.click('[data-testid=reveal-stage]');
		await p.waitForSelector('.summary');
		await p.waitForTimeout(700);
		await shot(p, `${tag}-ouverture-7-recap`);
		ok((await p.locator('.summary .card').count()) === 5, `[${tag}] récapitulatif de 5 cartes`);
		await p.keyboard.press('Escape');
	} else ok(true, `[${tag}] pas de paquet disponible`);

	// --- Album ---
	await p.goto(BASE + '/album?own=owned');
	await p.waitForTimeout(500);
	await shot(p, `${tag}-album`);
	ok((await p.locator('.grid-cards .card .frame').count()) > 0, `[${tag}] cartes au nouveau cadre dans l'album`);

	// --- Fiche : une commune et la plus rare ---
	await p.goto(BASE + '/album?own=owned&r=0');
	const common = p.locator('.grid-cards a.card-link').first();
	if (await common.count()) {
		await common.click();
		await p.waitForURL(/\/card\/\d+/);
		await p.waitForTimeout(400);
		await shot(p, `${tag}-carte-commune`);
		ok((await p.locator('.big .quote p').count()) === 1, `[${tag}] encart d'ambiance sur la fiche`);
	}
	await p.goto(BASE + '/album?own=owned&sort=rarity');
	await p.locator('.grid-cards a.card-link').first().click();
	await p.waitForURL(/\/card\/\d+/);
	const big = p.locator('.big');
	const bb = await big.boundingBox();
	await p.mouse.move(bb.x + bb.width * 0.8, bb.y + bb.height * 0.25);
	await p.waitForTimeout(500);
	await shot(p, `${tag}-carte-rare-holo`);
	ok((await p.locator('.big .holo').count()) === 1, `[${tag}] reflet holographique sur la carte rare`);
}

await browser.close();
console.log(failures ? `\n${failures} échec(s)` : '\nBoucle 1 OK.');
process.exit(failures ? 1 : 0);
