/**
 * Parcours de bout en bout (Playwright) : deux joueurs testent paquets, album,
 * enchères, échanges, amis, duels (ami + ordinateur), guilde, en 390 px puis 1440 px.
 *
 *   BASE=http://127.0.0.1:5180 OUT=./test-results A_USER=testeur1 A_PASS=... B_USER=testeur2 B_PASS=... \
 *   PLAYWRIGHT=/chemin/vers/playwright/index.mjs node tests/e2e/run.mjs
 *
 * Les comptes doivent exister, être neufs (aucune amitié entre eux) et avoir au moins 3 paquets.
 */
import { mkdirSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5180';
const OUT = process.env.OUT ?? './test-results';
const A = { user: process.env.A_USER ?? 'testeur1', pass: process.env.A_PASS ?? 'TestLocal123' };
const B = { user: process.env.B_USER ?? 'testeur2', pass: process.env.B_PASS ?? 'TestLocal123' };
mkdirSync(OUT, { recursive: true });

let failures = 0;
const ok = (cond, msg) => {
	console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
	if (!cond) failures++;
};

const browser = await chromium.launch();

async function session(who, viewport) {
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'fr-FR' });
	const page = await ctx.newPage();
	// Attendre l'hydratation (sinon les clics sur les boutons Svelte partent dans le vide)
	const goto = page.goto.bind(page);
	page.goto = (url, opts) => goto(url, { waitUntil: 'networkidle', ...opts });
	page.on('pageerror', (e) => {
		console.log(`[${who.user}] erreur JS : ${e.message}`);
		failures++;
	});
	await page.goto(BASE + '/login');
	await page.fill('input[name=username]', who.user);
	await page.fill('input[name=password]', who.pass);
	await page.click('button:has-text("Se connecter")');
	await page.waitForURL(BASE + '/');
	return page;
}

const shot = (page, name, full = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });

async function openPacks(page, prefix, n = 10) {
	let opened = 0;
	for (let i = 0; i < n; i++) {
		await page.goto(BASE + '/');
		const btn = page.locator('[data-testid=open-pack]');
		if (await btn.isDisabled()) break;
		await btn.click();
		await page.waitForSelector('.overlay');
		if (i === 0 && prefix) await shot(page, `${prefix}-paquet-1-ferme`);
		await page.click('.stage');
		await page.waitForTimeout(900);
		if (i === 0 && prefix) await shot(page, `${prefix}-paquet-2-carte`);
		for (let k = 0; k < 5; k++) {
			await page.click('.stage');
			await page.waitForTimeout(250);
		}
		await page.waitForSelector('.summary');
		await page.waitForTimeout(500);
		if (i === 0 && prefix) await shot(page, `${prefix}-paquet-3-recap`);
		opened++;
		await page.keyboard.press('Escape');
	}
	return opened;
}

const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 900 };

// ---------- Joueur A : paquets, album, carte, mise en vente ----------
const a = await session(A, mobile);
await shot(a, 'm-01-accueil');
// récompense quotidienne (si disponible) = 1 paquet de plus
const daily = a.locator('button:has-text("Récupérer")');
if (await daily.count()) await daily.click(), await a.waitForTimeout(500);
const openedA = await openPacks(a, 'm-02');
ok(openedA >= 3, `A ouvre ${openedA} paquets`);

await a.goto(BASE + '/album?own=owned');
const ownedA = await a.locator('.grid-cards .card-link').count();
ok(ownedA >= 5, `album de A : ${ownedA} cartes possédées affichées`);
await shot(a, 'm-03-album', true);
await a.goto(BASE + '/album');
await shot(a, 'm-03b-album-silhouettes');

// carte la plus rare possédée
await a.goto(BASE + '/album?own=owned&sort=rarity');
await a.locator('.grid-cards .card-link').first().click();
await a.waitForURL(/\/card\/\d+/);
await shot(a, 'm-04-carte', true);

// mise en vente de la dernière carte de l'album (la moins rare)
await a.goto(BASE + '/album?own=owned&sort=rarity');
const lastCard = a.locator('.grid-cards .card-link').last();
await lastCard.click();
await a.waitForURL(/\/card\/\d+/);
const soldCardUrl = a.url();
await a.click('button:has-text("Vendre aux enchères")');
await a.fill('input[name=price]', '5');
await a.selectOption('select[name=duration]', '1');
await a.click('form[action="?/sell"] button');
await a.waitForSelector('text=Carte mise en vente');
ok(true, 'A met une carte aux enchères');
await a.click('a:has-text("Voir l\'enchère")');
await a.waitForURL(/\/market\/\d+/);
const auctionUrl = a.url();

// ---------- Joueur B : ami, paquets, enchère ----------
const b = await session(B, mobile);
const dailyB = b.locator('button:has-text("Récupérer")');
if (await dailyB.count()) await dailyB.click(), await b.waitForTimeout(500);
ok((await openPacks(b, null)) >= 3, 'B ouvre ses paquets');
await b.goto(BASE + '/social');
await b.fill('input[name=username]', A.user);
await b.click('button:has-text("Ajouter")');
await b.waitForSelector('text=Demande envoyée');
ok(true, 'B envoie une demande d’ami à A');

await a.goto(BASE + '/social');
await a.click('[data-testid=accept-friend]');
await a.waitForTimeout(600);
ok((await a.locator(`text=${B.user}`).count()) > 0, 'A accepte B en ami');

await b.goto(BASE + '/market');
await shot(b, 'm-05-marche');
await b.goto(auctionUrl);
await b.click('[data-testid=bid]');
await b.waitForSelector('text=Enchère placée');
ok(true, 'B enchérit sur la carte de A');
await shot(b, 'm-06-enchere', true);

// ---------- Échange : A propose une carte + 10 kamas contre une carte de B ----------
await a.goto(BASE + `/trades/new?to=${B.user}`);
const pickers = a.locator('.picker');
await pickers.nth(0).locator('.pick').first().click();
await a.fill('input[name=kamas]', '10');
await pickers.nth(1).locator('.pick').first().click();
await shot(a, 'm-07a-echange-proposition', true);
await a.click('button:has-text("Proposer (")');
await a.waitForURL(/\/trades\/\d+/);
const tradeUrl = a.url();
await b.goto(tradeUrl);
await b.click('[data-testid=accept-trade]');
await b.waitForSelector('text=Accepté');
ok(true, 'B accepte l’échange (transfert atomique)');
await shot(b, 'm-07-echange', true);

// ---------- Duel entre amis ----------
await a.goto(BASE + `/duels/new?vs=${B.user}`);
const deckA = a.locator('.picker .pick');
for (let i = 0; i < 3; i++) await deckA.nth(i).click();
await a.click('[data-testid=start-duel]');
await a.waitForURL(/\/duels\/\d+/);
const duelUrl = a.url();
await b.goto(duelUrl);
await shot(b, 'm-08a-duel-defi', true);
const deckB = b.locator('.picker .pick');
for (let i = 0; i < 3; i++) await deckB.nth(i).click();
await b.click('[data-testid=accept-duel]');
await b.waitForTimeout(800);

async function playQuiz(page, label, capture) {
	await page.goto(duelUrl);
	let n = 0;
	while ((await page.locator('[data-testid=choice]').count()) && n < 12) {
		if (capture && n === 1) await shot(page, capture);
		await page.locator('[data-testid=choice]').nth(n % 4).click();
		if (capture && n === 1) {
			await page.waitForTimeout(300);
			await shot(page, capture + '-reponse');
		}
		await page.waitForTimeout(1500);
		n++;
	}
	ok(n === 9, `${label} répond à ${n} questions`);
}
await playQuiz(a, 'A', 'm-08-duel-question');
await playQuiz(b, 'B', null);
await a.goto(duelUrl);
ok((await a.locator('.banner').count()) === 1, 'résultat du duel affiché');
await a.waitForTimeout(1500);
await shot(a, 'm-09-duel-resultat', true);

// ---------- Duel contre l'ordinateur ----------
await a.goto(BASE + '/duels/new?vs=bot');
const deckBot = a.locator('.picker .pick');
for (let i = 0; i < 3; i++) await deckBot.nth(i).click();
await a.click('[data-testid=start-duel]');
await a.waitForURL(/\/duels\/\d+/);
let q = 0;
while ((await a.locator('[data-testid=choice]').count()) && q < 12) {
	await a.locator('[data-testid=choice]').first().click();
	await a.waitForTimeout(1400);
	q++;
}
ok((await a.locator('.banner').count()) === 1, `duel contre l'ordinateur terminé (${q} questions)`);

// ---------- Guilde ----------
const guildName = `Les Bouftous ${Date.now() % 1000}`;
await a.goto(BASE + '/guilds');
await a.click('button:has-text("Créer une guilde")');
await a.fill('input[name=name]', guildName);
await a.fill('input[name=tag]', 'BFT');
await a.click('form[action="?/create"] button');
await a.waitForURL(/\/guilds\/\d+/);
const guildUrl = a.url();
await a.fill('input[name=body]', 'Bienvenue dans la guilde !');
await a.click('form[action="?/post"] button');
await b.goto(guildUrl);
await b.click('button:has-text("Rejoindre la guilde")');
await b.waitForTimeout(500);
await b.fill('input[name=body]', 'Merci, content d’être là');
await b.click('form[action="?/post"] button');
await b.waitForTimeout(500);
ok((await b.locator('.msg').count()) >= 2, 'chat de guilde fonctionnel');
await shot(b, 'm-10-guilde', true);

// ---------- Autres écrans ----------
for (const [path, name] of [
	['/leaderboard', 'm-11-classement'],
	['/achievements', 'm-12-succes'],
	[`/u/${A.user}`, 'm-13-profil'],
	['/duels', 'm-14-duels'],
	['/trades', 'm-15-echanges']
]) {
	await a.goto(BASE + path);
	await shot(a, name, true);
}
await a.goto(BASE + `/messages/${B.user}`);
await a.fill('input[name=body]', 'Salut, bien joué pour le duel !');
await a.click('button[aria-label=Envoyer]');
await a.waitForTimeout(500);
ok((await a.locator('.bubble').count()) >= 1, 'message privé envoyé');

// ---------- Desktop 1440 ----------
const ad = await session(A, desktop);
for (const [path, name] of [
	['/', 'd-01-accueil'],
	['/album?own=owned', 'd-03-album'],
	['/market', 'd-05-marche'],
	[auctionUrl.replace(BASE, ''), 'd-06-enchere'],
	[tradeUrl.replace(BASE, ''), 'd-07-echange'],
	[duelUrl.replace(BASE, ''), 'd-09-duel-resultat'],
	[guildUrl.replace(BASE, ''), 'd-10-guilde'],
	['/leaderboard', 'd-11-classement']
]) {
	await ad.goto(BASE + path);
	await ad.waitForTimeout(400);
	await shot(ad, name);
}
await ad.goto(BASE + '/album?own=owned&sort=rarity');
await ad.locator('.grid-cards .card-link').first().click();
await ad.waitForURL(/\/card\/\d+/);
await ad.waitForTimeout(400);
await shot(ad, 'd-04-carte');

await browser.close();
console.log(failures ? `\n${failures} échec(s)` : '\nTous les parcours sont passés.');
process.exit(failures ? 1 : 0);
