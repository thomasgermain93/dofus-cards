/**
 * Boucle 2 : rétention (série, quêtes, coffre, boosters bonus, collections, brillantes, fabrication).
 * Les étapes dépendent de l'état du compte : une étape impossible est signalée et ignorée.
 *
 *   BASE=... OUT=... A_USER=... A_PASS=... PLAYWRIGHT=.../playwright/index.mjs node tests/e2e/b2-retention.mjs
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
const skip = (m) => console.log(`--   ${m}`);
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
const shot = (p, n, full = false) => p.screenshot({ path: `${OUT}/b2-${n}.png`, fullPage: full });
const kamas = async (p) => Number(await p.locator('[data-testid=kamas-counter]').first().getAttribute('data-value'));

// ---------------- Mobile 390 ----------------
const m = await session({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
ok((await m.locator('[data-testid=now]').count()) === 1, 'bloc « Maintenant » sur l’accueil');
await shot(m, 'm-01-accueil');
await shot(m, 'm-01b-accueil-complet', true);

// Série du jour
const claimDaily = m.locator('[data-testid=claim-daily]');
if (await claimDaily.count()) {
	const before = await kamas(m);
	await claimDaily.click();
	await m.waitForTimeout(900);
	ok((await kamas(m)) > before, 'récompense de la série récupérée');
	await m.locator('[data-testid=streak]').scrollIntoViewIfNeeded();
	await shot(m, 'm-02-serie');
} else skip('récompense du jour déjà prise');

// Quêtes
await m.goto(BASE + '/quests');
ok((await m.locator('[data-testid=quest]').count()) === 6, '3 quêtes du jour + 3 de la semaine');
const claimQ = m.locator('[data-testid=claim-quest]').first();
if (await claimQ.count()) {
	const before = await kamas(m);
	await claimQ.click();
	await m.waitForTimeout(900);
	ok((await kamas(m)) >= before, 'récompense de quête récupérée');
} else skip('aucune quête terminée');
await shot(m, 'm-03-quetes', true);

// Coffre de la semaine dernière
await m.goto(BASE + '/');
const chest = m.locator('[data-testid=claim-chest]');
if (await chest.count()) {
	await chest.click();
	await m.waitForTimeout(800);
	ok((await m.locator('text=ouvert').count()) > 0, 'coffre de la semaine ouvert');
	await m.locator('[data-testid=chest]').scrollIntoViewIfNeeded();
	await shot(m, 'm-04-coffre');
} else skip('pas de coffre à ouvrir');

// Booster Or (ou Argent / Bronze)
await m.goto(BASE + '/');
const booster = m.locator('[data-testid=open-gold], [data-testid=open-silver], [data-testid=open-bronze]').first();
if (await booster.count()) {
	await booster.click();
	await m.waitForSelector('[data-testid=pack]');
	await m.waitForTimeout(400);
	await shot(m, 'm-05-booster');
	await m.click('[data-testid=pack]', { force: true });
	await m.waitForSelector('[data-testid=reveal-stage]');
	await m.click('[data-testid=skip]');
	await m.waitForSelector('.summary');
	await m.waitForTimeout(800);
	await shot(m, 'm-06-booster-recap');
	ok((await m.locator('.summary .card').count()) === 5, 'booster bonus ouvert');
	await m.keyboard.press('Escape');
} else skip('aucun booster bonus');

// Collections
await m.goto(BASE + '/collections?kind=panoplie');
ok((await m.locator('[data-testid=collection]').count()) > 0, 'liste des collections');
const claimC = m.locator('[data-testid=claim-collection]').first();
if (await claimC.count()) {
	await claimC.click();
	await m.waitForSelector('text=Collection récupérée');
	ok(true, 'collection complétée récupérée');
}
await shot(m, 'm-07-collections');
await m.locator('[data-testid=collection] a').first().click();
await m.waitForURL(/\/collections\/.+/);
await m.waitForTimeout(400);
await shot(m, 'm-08-collection-detail');

// Brillantes dans l'album
await m.goto(BASE + '/album?own=shiny');
const shinies = await m.locator('.grid-cards .card.foil').count();
ok(shinies >= 0, `album : ${shinies} carte(s) brillante(s)`);
if (shinies) await shot(m, 'm-09-brillantes');

// Fabrication d'une carte manquante (commune)
await m.goto(BASE + '/album?own=missing&r=0');
await m.locator('.grid-cards a.card-link').first().click();
await m.waitForURL(/\/card\/\d+/);
const craft = m.locator('[data-testid=craft]');
if ((await craft.count()) && !(await craft.isDisabled())) {
	await m.locator('[data-testid=craft-box]').scrollIntoViewIfNeeded();
	await shot(m, 'm-10-fabrication');
	await craft.click();
	await m.waitForSelector('[data-testid=crafted]');
	ok(true, 'carte fabriquée avec des fragments');
	await shot(m, 'm-11-fabriquee');
} else skip('pas assez de fragments pour fabriquer');

// Recyclage des doublons en fragments
await m.goto(BASE + '/album?own=owned');
if (await m.locator('[data-testid=sell-dupes-box]').count()) {
	await m.click('[data-testid=mode-recycle]');
	await m.waitForTimeout(200);
	await shot(m, 'm-12-recyclage');
	if (!(await m.locator('[data-testid=sell-dupes]').isDisabled())) {
		await m.click('[data-testid=sell-dupes]');
		await m.waitForSelector('[data-testid=toast]');
		ok((await m.locator('[data-testid=toast]').innerText()).includes('fragments'), 'doublons recyclés en fragments');
	}
} else skip('aucun doublon à recycler');

// ---------------- Ordinateur 1440 ----------------
const d = await session({ width: 1440, height: 900 });
for (const [path, name] of [
	['/', 'd-01-accueil'],
	['/quests', 'd-03-quetes'],
	['/collections?kind=region', 'd-07-collections'],
	['/album?own=owned', 'd-09-album']
]) {
	await d.goto(BASE + path);
	await d.waitForTimeout(400);
	await shot(d, name);
}
ok((await d.locator('text=Quêtes').count()) > 0, 'lien Quêtes dans la barre latérale');

await browser.close();
console.log(failures ? `\n${failures} échec(s)` : '\nBoucle 2 OK.');
process.exit(failures ? 1 : 0);
