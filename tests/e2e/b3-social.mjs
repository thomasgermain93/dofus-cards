/**
 * Boucle 3 : vitrine et avatar, profil public, liste de souhaits, bataille de groupe à 3 joueurs,
 * duel (chrono, dégâts, revanche), contre-proposition d'échange.
 * A et B doivent être amis et posséder au moins 8 cartes ; C au moins 3.
 *
 *   BASE=... OUT=... A_USER=... A_PASS=... B_USER=... B_PASS=... C_USER=... C_PASS=... node tests/e2e/b3-social.mjs
 */
import { mkdirSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5180';
const OUT = process.env.OUT ?? './test-results';
const A = { user: process.env.A_USER ?? 'testeur1', pass: process.env.A_PASS ?? 'TestLocal123' };
const B = { user: process.env.B_USER ?? 'testeur2', pass: process.env.B_PASS ?? 'TestLocal123' };
const C = { user: process.env.C_USER ?? 'thomas-admin', pass: process.env.C_PASS ?? 'TestLocal123' };
mkdirSync(OUT, { recursive: true });

let failures = 0;
const ok = (c, m) => {
	console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
	if (!c) failures++;
};
const browser = await chromium.launch();
async function session(who, viewport, extra = {}) {
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'fr-FR', ...extra });
	const p = await ctx.newPage();
	const goto = p.goto.bind(p);
	p.goto = (url, opts) => goto(url, { waitUntil: 'networkidle', ...opts });
	p.on('pageerror', (e) => {
		console.log(`[${who.user}] erreur JS : ${e.message}`);
		failures++;
	});
	await p.goto(BASE + '/login');
	await p.fill('input[name=username]', who.user);
	await p.fill('input[name=password]', who.pass);
	await p.click('button:has-text("Se connecter")');
	await p.waitForURL(BASE + '/');
	await p.waitForLoadState('networkidle');
	return p;
}
const shot = (p, n, full = false) => p.screenshot({ path: `${OUT}/b3-${n}.png`, fullPage: full });
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 900 };

const a = await session(A, mobile, { hasTouch: true, isMobile: true });
const b = await session(B, mobile, { hasTouch: true, isMobile: true });
const c = await session(C, desktop);

// ---------- Avatar et vitrine ----------
await a.goto(BASE + '/profile/edit');
await a.locator('section').first().locator('.pick').first().click();
await a.locator('input[type=range]').first().fill('35');
await a.click('[data-testid=save-avatar]');
await a.waitForSelector('text=Enregistré');
ok(true, 'avatar-carte enregistré');
await a.click('[data-testid=new-showcase]');
await a.fill('input[name=name]', 'Mes plus belles');
const picks = a.locator('#vitrines .pick');
for (let i = 0; i < 6; i++) await picks.nth(i).click();
await shot(a, 'm-01-vitrine-edition');
await a.click('[data-testid=save-showcase]');
await a.waitForSelector('text=principale');
ok(true, 'vitrine de 6 cartes créée');

// Profil public vu par B (390) et par C (1440)
await b.goto(BASE + `/u/${A.user}`);
await b.waitForTimeout(900);
ok((await b.locator('[data-testid=showcase] .card').count()) === 6, 'vitrine visible sur le profil public');
await shot(b, 'm-02-profil-public', true);
await c.goto(BASE + `/u/${A.user}`);
await c.waitForTimeout(900);
await shot(c, 'd-02-profil-public');

// ---------- Liste de souhaits + alerte enchère ----------
// B met en vente une carte qu'A n'a pas ; A la souhaite avant
await b.goto(BASE + '/album?own=owned&sort=rarity');
await b.locator('.grid-cards a.card-link').last().click();
await b.waitForURL(/\/card\/\d+/);
const cardUrl = b.url().replace(BASE, '');
await a.goto(BASE + cardUrl);
const wishBtn = a.locator('[data-testid=wish-toggle]');
await wishBtn.click();
await a.waitForTimeout(500);
ok((await a.locator('text=Dans ta liste de souhaits').count()) === 1, 'carte ajoutée à la liste de souhaits');
await b.click('button:has-text("Vendre aux enchères")');
await b.fill('input[name=price]', '7');
await b.click('form[action="?/sell"] button');
await b.waitForSelector('text=Carte mise en vente');
await a.goto(BASE + '/notifications');
ok((await a.locator('text=liste de souhaits').count()) > 0, 'alerte : carte souhaitée mise aux enchères');
await a.goto(BASE + '/wishlist');
ok((await a.locator('text=En vente').count()) > 0, 'liste de souhaits : enchère signalée');
await shot(a, 'm-03-souhaits');

// ---------- Bataille de groupe à 3 joueurs ----------
await a.goto(BASE + '/battle');
await a.click('[data-testid=create-battle]');
await a.waitForURL(/\/battle\/[A-Z0-9]{6}$/);
const code = a.url().split('/').pop();
for (const p of [b, c]) {
	await p.goto(BASE + '/battle');
	await p.fill('input[name=code]', code);
	await p.click('[data-testid=join-battle]');
	await p.waitForURL(new RegExp(`/battle/${code}$`));
}
for (const p of [a, b, c]) {
	const picks3 = p.locator('.pick');
	for (let i = 0; i < 3; i++) await picks3.nth(i).click();
	await p.click('[data-testid=battle-cards]');
	await p.waitForTimeout(400);
}
await a.waitForTimeout(1800);
await shot(a, 'm-04-bataille-salon', true);
await a.click('[data-testid=battle-start]');
await a.waitForSelector('[data-testid=battle-countdown], [data-testid=battle-question]', { timeout: 10000 });
ok(true, `bataille ${code} lancée à 3 joueurs`);

// Chaque joueur répond à chaque question (A choisit la 1re réponse, B la 2e, C la 3e)
async function play(p, pick, capture) {
	let answered = 0;
	let lastPrompt = '';
	const deadline = Date.now() + 260_000;
	while (Date.now() < deadline) {
		if (await p.locator('[data-testid=battle-results]').count()) break;
		const qEl = p.locator('[data-testid=battle-question]');
		if (await qEl.count()) {
			const prompt = await qEl.innerText().catch(() => '');
			const btn = p.locator('[data-testid=battle-choice]').nth(pick);
			if (prompt !== lastPrompt && (await btn.isEnabled().catch(() => false))) {
				await btn.click().catch(() => {});
				lastPrompt = prompt;
				answered++;
				if (capture && answered === 2) {
					await p.waitForTimeout(400);
					await shot(p, capture.q);
				}
				if (capture && answered === 2) {
					await p.waitForSelector('.choice.right', { timeout: 20000 }).catch(() => {});
					await p.waitForTimeout(300);
					await shot(p, capture.r);
				}
			}
		}
		await p.waitForTimeout(400);
	}
	return answered;
}
const [na, nb, nc] = await Promise.all([
	play(a, 0, { q: 'm-05-bataille-question', r: 'm-06-bataille-revelation' }),
	play(b, 1),
	play(c, 2, { q: 'd-05-bataille-question', r: 'd-06-bataille-revelation' })
]);
ok(na >= 5 && nb >= 5 && nc >= 5, `réponses envoyées : ${na}, ${nb}, ${nc}`);
await a.waitForSelector('[data-testid=battle-results]', { timeout: 30000 });
await a.waitForTimeout(1200);
ok((await a.locator('[data-testid=battle-results] .cell').count()) === 3, 'classement final des 3 joueurs');
await shot(a, 'm-07-bataille-resultat', true);
await c.waitForTimeout(1000);
await shot(c, 'd-07-bataille-resultat');

// ---------- Duel : chrono, dégâts animés, revanche ----------
await a.goto(BASE + '/duels/new?vs=bot');
const deck = a.locator('.picker .pick');
for (let i = 0; i < 3; i++) await deck.nth(i).click();
await a.click('[data-testid=start-duel]');
await a.waitForURL(/\/duels\/\d+/);
ok((await a.locator('[data-testid=duel-timer]').count()) === 1, 'chrono affiché pendant le duel');
let n = 0;
while ((await a.locator('[data-testid=choice]').count()) && n < 12) {
	await a.locator('[data-testid=choice]').nth(n % 2 ? 1 : 0).click();
	await a.waitForTimeout(1400);
	n++;
}
await a.waitForSelector('.banner');
await a.waitForTimeout(700);
await shot(a, 'm-08-duel-degats');
await a.waitForTimeout(1800);
await shot(a, 'm-09-duel-resultat', true);
const duelUrl = a.url();
await a.click('[data-testid=rematch]');
await a.waitForURL((u) => u.toString() !== duelUrl && /\/duels\/\d+/.test(u.toString()));
await a.waitForSelector('[data-testid=choice]');
ok((await a.locator('[data-testid=choice]').count()) > 0, 'revanche en un clic');

// ---------- Contre-proposition ----------
await a.goto(BASE + `/trades/new?to=${B.user}`);
const tp = a.locator('.picker');
await tp.nth(0).locator('.pick').first().click();
await tp.nth(1).locator('.pick').first().click();
await a.click('button:has-text("Proposer (")');
await a.waitForURL(/\/trades\/\d+/);
const tradeUrl = a.url();
await b.goto(tradeUrl);
await b.click('[data-testid=counter-trade]');
await b.waitForURL(/counter=/);
await b.locator('.picker').nth(1).locator('.pick').nth(1).click().catch(() => {});
await shot(b, 'm-10-contre-proposition', true);
await b.click('button:has-text("Contre-proposer")');
await b.waitForURL(/\/trades\/\d+/);
await a.goto(tradeUrl);
ok((await a.locator('text=Contre-proposition envoyée').count()) === 1, 'échange d’origine marqué « contre-proposé »');

// ---------- Profil privé ----------
await a.goto(BASE + `/u/${A.user}`);
await a.click('[data-testid=privacy]');
await a.waitForTimeout(500);
await c.goto(BASE + `/u/${A.user}`);
ok((await c.locator('text=Ce profil est privé').count()) === 0, 'les modérateurs voient un profil privé');
await a.click('[data-testid=privacy]');

// ---------- Classement avec avatars et vitrines ----------
await c.goto(BASE + '/leaderboard');
await c.waitForTimeout(500);
await shot(c, 'd-11-classement');

await browser.close();
console.log(failures ? `\n${failures} échec(s)` : '\nBoucle 3 OK.');
process.exit(failures ? 1 : 0);
