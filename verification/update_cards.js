/* 共有カードの画像を、頁ごとに作る（2026-11-12）。
 *
 *   node verification/update_cards.js
 *
 * 生成した頁を読み、og:image が `<base>/og/<名>.png` を指すものについて、
 * 1200×630 の PNG を `<CARDS_SITE>/og/<名>.png` に書く。名は researcher-profile の build.js
 * （cardName）が正の URL から作る。**画像の中身は頁から取る。**題は og:title の「 | 」の前、
 * 二行目は og:description、ロゴはその場所の favicon.svg である。
 *
 * ブラウザ（playwright の chromium）で描く。CI では回さない。頁を直したら手元で回し、
 * 出た画像を頁と一緒にコミットする。頁が指す画像があることは check_site.js が見る。
 * 外へは何も取りに行かない。字は端末にある書体だけを使う。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const OUT = path.join(SITE, 'og');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const meta = (html, re) => { const m = re.exec(html); return m ? unesc(m[1]) : ''; };

function pages(dir, rel = '') {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) return /^(\.|node_modules|og$|docs$|drafts$|deploy$|verification$)/.test(e.name) ? [] : pages(dir, r);
    return /\.html$/.test(e.name) ? [r] : [];
  });
}

function cardHtml(logo, title, sub, where, lang) {
  return `<!DOCTYPE html><html lang="${esc(lang)}"><head><meta charset="utf-8"><style>
html, body { margin: 0; width: 1200px; height: 630px; }
body { box-sizing: border-box; padding: 72px 80px; background: #faf9f7; color: #17171a;
  font-family: "Hiragino Sans", "Noto Sans CJK JP", "IPAGothic", "IPAPGothic", sans-serif;
  display: flex; flex-direction: column; justify-content: space-between;
  border-left: 16px solid #8a6a3d; }
.logo svg { width: 96px; height: 96px; display: block; }
h1 { margin: 0; font-size: 60px; line-height: 1.3; font-weight: 700; letter-spacing: .01em;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
p { margin: 18px 0 0; font-size: 28px; line-height: 1.6; color: #55555c;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.foot { font-size: 24px; color: #63636b; }
</style></head><body>
<div class="logo">${logo}</div>
<div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
<div class="foot">${esc(where)}</div>
</body></html>`;
}

async function main() {
  let pw;
  try { pw = require('playwright'); } catch (e) {
    console.error('playwright がありません。共有カードはブラウザで描きます。');
    process.exit(1);
  }
  const logoFile = path.join(SITE, 'favicon.svg');
  if (!fs.existsSync(logoFile)) throw new Error('ロゴがありません: ' + logoFile);
  const logo = fs.readFileSync(logoFile, 'utf8').replace(/<title>[\s\S]*?<\/title>/, '');
  const jobs = [];
  pages(SITE).forEach((rel) => {
    const html = fs.readFileSync(path.join(SITE, rel), 'utf8');
    const img = meta(html, /<meta property="og:image" content="([^"]+)">/);
    const m = /\/og\/([A-Za-z0-9._-]+)\.png$/.exec(img);
    if (!m) return;
    const title = meta(html, /<meta property="og:title" content="([^"]*)">/).split(' | ')[0];
    const sub = meta(html, /<meta property="og:description" content="([^"]*)">/);
    const url = meta(html, /<meta property="og:url" content="([^"]+)">/).replace(/^https?:\/\//, '');
    const lang = (/<html lang="([^"]+)"/.exec(html) || [])[1] || 'ja';
    jobs.push({ name: m[1], html: cardHtml(logo, title, sub, url, lang) });
  });
  const seen = new Set();
  jobs.forEach((j) => {
    if (seen.has(j.name)) throw new Error('同じ名の共有カードを二つの頁が指しています: ' + j.name);
    seen.add(j.name);
  });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const j of jobs) {
    await page.setContent(j.html);
    await page.screenshot({ path: path.join(OUT, j.name + '.png'), type: 'png' });
  }
  await browser.close();
  /* 指す頁の無くなった画像は消す。残すと、どこからも使われない画像が溜まる。 */
  fs.readdirSync(OUT).filter((f) => /\.png$/.test(f) && !seen.has(f.replace(/\.png$/, '')))
    .forEach((f) => fs.unlinkSync(path.join(OUT, f)));
  console.log('共有カードを ' + jobs.length + ' 枚描きました: ' + path.relative(process.cwd(), OUT));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
