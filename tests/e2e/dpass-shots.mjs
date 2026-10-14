/**
 * Passe design : captures avant / après de 6 écrans en 390 px et 2 en 1440 px (clair et sombre pour l'accueil).
 *   PREFIX=avant|apres BASE=... OUT=... node tests/e2e/dpass-shots.mjs
 */
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5180';
const OUT = process.env.OUT ?? './test-results';
const PREFIX = process.env.PREFIX ?? 'apres';
const A = { user: process.env.A_USER ?? 'testeur1', pass: process.env.A_PASS ?? 'TestLocal123' };
const SCHEMES = (process.env.SCHEMES ?? 'dark,light').split(',');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const login = async (p) => {
	await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
	await p.fill('input[name=username]', A.user);
	await p.fill('input[name=password]', A.pass);
	await p.click('button:has-text("Se connecter")');
	await p.waitForURL(BASE + '/');
	await p.waitForLoadState('networkidle');
};
for (const scheme of SCHEMES) {
	const s = scheme === 'dark' ? '' : '-clair';
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, hasTouch: true, isMobile: true, locale: 'fr-FR' });
	const p = await ctx.newPage();
	const go = async (u) => (await p.goto(BASE + u, { waitUntil: 'networkidle' }), p.waitForTimeout(500));
	const shot = (n, full = false) => p.screenshot({ path: `${OUT}/dpass-${PREFIX}-${n}${s}.png`, fullPage: full });
	await login(p);
	await p.waitForTimeout(500);
	await shot('1-accueil');
	await go('/album?own=owned');
	await shot('2-album');
	await go('/album?own=owned&sort=rarity');
	await p.locator('.grid-cards a.card-link').first().click();
	await p.waitForURL(/\/card\/\d+/);
	await p.waitForTimeout(500);
	await shot('3-fiche');
	await go('/market');
	await shot('4-marche');
	await go('/duels');
	await shot('5-jouer');
	await go('/u/' + A.user);
	await shot('6-profil');
	await go('/quests');
	await shot('7-quetes');
	// Ouverture d'un paquet (récapitulatif)
	await go('/');
	const b = p.locator('[data-testid=open-pack]');
	if (!(await b.isDisabled().catch(() => true))) {
		await b.click();
		await p.waitForSelector('[data-testid=pack]');
		await p.waitForTimeout(900);
		await shot('8-paquet');
		await p.click('[data-testid=pack]', { force: true });
		await p.waitForSelector('[data-testid=reveal-stage]');
		await p.waitForTimeout(1200);
		await shot('9-revelation');
		await p.click('[data-testid=skip]');
		await p.waitForSelector('.summary');
		await p.waitForTimeout(700);
		await shot('10-recapitulatif');
		await p.keyboard.press('Escape');
	}
	await ctx.close();
	const d = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: scheme, locale: 'fr-FR' });
	const q = await d.newPage();
	await login(q);
	await q.waitForTimeout(500);
	await q.screenshot({ path: `${OUT}/dpass-${PREFIX}-d1-accueil${s}.png` });
	await q.goto(BASE + '/album?own=owned', { waitUntil: 'networkidle' });
	await q.waitForTimeout(500);
	await q.screenshot({ path: `${OUT}/dpass-${PREFIX}-d2-album${s}.png` });
	await d.close();
}
await browser.close();
console.log('captures', PREFIX, 'OK');
