/**
 * Parcours « vente rapide » (Playwright) en 390 px puis 1440 px :
 * vente depuis l'ouverture de paquet, depuis la fiche (avec confirmation du
 * dernier exemplaire), vente de tous les doublons et mode sélection de l'album.
 *
 *   BASE=... OUT=... A_USER=... A_PASS=... PLAYWRIGHT=.../playwright/index.mjs node tests/e2e/sell.mjs
 */
import { mkdirSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5180';
const OUT = process.env.OUT ?? './test-results';
const A = { user: process.env.A_USER ?? 'testeur1', pass: process.env.A_PASS ?? 'TestLocal123' };
const PREFIX = process.env.PREFIX ?? 'vente';
mkdirSync(OUT, { recursive: true });

let failures = 0;
const ok = (cond, msg) => {
	console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
	if (!cond) failures++;
};
const browser = await chromium.launch();

async function session(viewport) {
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'fr-FR' });
	const page = await ctx.newPage();
	const goto = page.goto.bind(page);
	page.goto = (url, opts) => goto(url, { waitUntil: 'networkidle', ...opts });
	page.on('pageerror', (e) => {
		console.log(`erreur JS : ${e.message}`);
		failures++;
	});
	await page.goto(BASE + '/login');
	await page.fill('input[name=username]', A.user);
	await page.fill('input[name=password]', A.pass);
	await page.click('button:has-text("Se connecter")');
	await page.waitForURL(BASE + '/');
	await page.waitForLoadState('networkidle');
	return page;
}
const kamas = async (page) => Number(await page.locator('[data-testid=kamas-counter]').first().getAttribute('data-value'));
const shot = (page, name, full = false) => page.screenshot({ path: `${OUT}/${PREFIX}-${name}.png`, fullPage: full });

for (const [vp, tag] of [
	[{ width: 390, height: 844 }, 'm'],
	[{ width: 1440, height: 900 }, 'd']
]) {
	const p = await session(vp);

	// 1. Ouverture de paquet : vendre / garder / vendre les doublons du paquet
	const open = p.locator('[data-testid=open-pack]');
	if (!(await open.isDisabled())) {
		await open.click();
		await p.click('[data-testid=pack]', { force: true });
		await p.waitForSelector('[data-testid=reveal-stage]');
		await p.click('[data-testid=skip]');
		await p.waitForSelector('.summary');
		await p.waitForTimeout(600);
		const before = await kamas(p);
		await p.locator('[data-testid=pack-keep]').first().click();
		const dupes = p.locator('[data-testid=pack-sell-dupes]');
		if (await dupes.count()) {
			await dupes.click();
		} else {
			await p.locator('[data-testid=pack-sell]').first().click();
			const sheet = p.locator('[data-testid=confirm-sheet]');
			if (await sheet.count()) await sheet.click();
		}
		await p.waitForTimeout(500);
		await shot(p, `${tag}-paquet`);
		await p.waitForTimeout(800);
		ok((await kamas(p)) > before, `[${tag}] vente depuis le paquet : ${before} -> ${await kamas(p)} kamas`);
		await p.keyboard.press('Escape');
	} else ok(true, `[${tag}] aucun paquet disponible, étape paquet ignorée`);

	// 1b. Double clic : l'API ne vend qu'une fois pour un même identifiant
	await p.goto(BASE + '/album?own=dupes');
	const dupLink = p.locator('.grid-cards a.card-link').first();
	if (await dupLink.count()) {
		const id = Number((await dupLink.getAttribute('href')).split('/').pop());
		const res = await p.evaluate(async (cardId) => {
			const body = JSON.stringify({ items: [{ cardId, count: 1 }], nonce: 'e2e-' + Date.now() });
			const r = await Promise.all([1, 2].map(() => fetch('/api/sell', { method: 'POST', headers: { 'content-type': 'application/json' }, body }).then((x) => x.json())));
			return r;
		}, id);
		ok(res.filter((r) => r.duplicate).length === 1 && res[0].gain === res[1].gain, `[${tag}] double clic : une seule vente`);
	}

	// 2. Album : bloc « vendre tous les doublons »
	await p.goto(BASE + '/album?own=owned');
	const box = p.locator('[data-testid=sell-dupes-box]');
	if (await box.count()) {
		await p.selectOption('[data-testid=sell-dupes-box] select', '2');
		await shot(p, `${tag}-album-doublons`);
		const before = await kamas(p);
		const btn = p.locator('[data-testid=sell-dupes]');
		if (!(await btn.isDisabled())) {
			await btn.click();
			await p.waitForSelector('[data-testid=toast]');
			await p.waitForTimeout(300);
			ok((await kamas(p)) > before, `[${tag}] vendre tous les doublons : +${(await kamas(p)) - before} kamas`);
		}
	}

	// 3. Album : mode sélection (2 cartes) avec total et confirmation
	await p.goto(BASE + '/album?own=owned&sort=rarity');
	await p.click('[data-testid=select-mode]');
	const picks = p.locator('[data-testid=album-pick]:not(.off)');
	const n = await picks.count();
	await picks.nth(n - 1).click();
	await picks.nth(n - 2).click();
	await p.waitForTimeout(300);
	await shot(p, `${tag}-album-selection`);
	ok(/Vendre \+\d/.test(await p.locator('[data-testid=sell-selection]').innerText()), `[${tag}] total affiché avant confirmation`);
	await p.click('[data-testid=sell-selection]');
	await p.waitForSelector('[data-testid=confirm-sheet]');
	await p.waitForTimeout(450);
	await shot(p, `${tag}-album-confirmation`);
	const beforeSel = await kamas(p);
	await p.click('[data-testid=confirm-sheet]');
	await p.waitForSelector('[data-testid=toast]');
	await p.waitForTimeout(250);
	await shot(p, `${tag}-album-vendu`);
	ok((await kamas(p)) > beforeSel, `[${tag}] sélection vendue : +${(await kamas(p)) - beforeSel} kamas`);

	// 4. Fiche : vendre le dernier exemplaire (confirmation obligatoire)
	await p.goto(BASE + '/album?own=owned&sort=rarity');
	// carte la moins rare dont un exemplaire est vendable (les cartes engagées n'ont pas de bouton)
	const links = await p.locator('.grid-cards a.card-link').evaluateAll((els) => els.map((e) => e.getAttribute('href')).reverse());
	let cardUrl = '';
	for (const href of links.slice(0, 8)) {
		await p.goto(BASE + href);
		if (await p.locator('[data-testid=sell]').count()) {
			cardUrl = p.url();
			break;
		}
	}
	ok(!!cardUrl, `[${tag}] carte vendable trouvée`);
	await p.locator('[data-testid=sell-box] .chip:has-text("Tout")').click().catch(() => {});
	await p.click('[data-testid=sell]');
	await p.waitForSelector('[data-testid=confirm-sheet]');
	await p.waitForTimeout(450);
	await shot(p, `${tag}-fiche-confirmation`);
	const beforeCard = await kamas(p);
	await p.click('[data-testid=confirm-sheet]');
	await p.waitForSelector('[data-testid=sold]');
	await p.waitForTimeout(250);
	await shot(p, `${tag}-fiche-vendue`);
	ok((await kamas(p)) > beforeCard, `[${tag}] fiche : dernier exemplaire vendu`);
	await p.goto(cardUrl);
	ok((await p.locator('text=Tu n\'as pas encore cette carte').count()) === 1, `[${tag}] la carte a quitté l'album`);

	// 6. Historique des gains dans le profil
	await p.goto(BASE + `/u/${A.user}`);
	ok((await p.locator('[data-testid=ledger] >> text=Vente au jeu').count()) > 0, `[${tag}] historique des ventes dans le profil`);
	if (tag === 'm') await shot(p, `${tag}-profil-historique`, true);
}

await browser.close();
console.log(failures ? `\n${failures} échec(s)` : '\nParcours de vente OK.');
process.exit(failures ? 1 : 0);
