/* IndexNow に、変わった頁を知らせる。Sophaxis の tools/indexnow.js と同じ考え方の、小さい版である。
 *
 *   node verification/indexnow.js            # BEFORE の sitemap と比べて、変わった頁と消えた頁を送る
 *   node verification/indexnow.js --dry-run  # 送らずに、送るものを出す
 *
 * 鍵はリポジトリの根の <鍵>.txt に置き、中身も鍵そのものにする（IndexNow の決まり）。鍵は秘密ではない。
 * Google は IndexNow を読まない。sitemap を読む（robots.txt が名指している）。
 * 配備が済むまで待ってから送る。鍵のファイルが読めるようになるまで、最大 10 分待つ。 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://cpsbvbng26-dotcom.vercel.app/';
const KEY = fs.readdirSync(ROOT).map((f) => /^([0-9a-f]{32})\.txt$/.exec(f)).filter(Boolean).map((m) => m[1])[0];
const DRY = process.argv.includes('--dry-run');

const entries = (xml) => new Map([...String(xml || '').matchAll(/<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => [m[1], m[2] || '']));

function before() {
  const at = process.env.BEFORE;
  if (!at || /^0+$/.test(at)) return '';
  try { return execFileSync('git', ['show', at + ':sitemap.xml'], { cwd: ROOT, encoding: 'utf8' }); } catch (e) { return ''; }
}

(async () => {
  if (!KEY || fs.readFileSync(path.join(ROOT, KEY + '.txt'), 'utf8').trim() !== KEY) throw new Error('鍵のファイルが無いか、中身が鍵と違う');
  const now = entries(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8'));
  const was = entries(before());
  const all = process.env.ALL === 'yes';
  const urls = [...now].filter(([u, d]) => all || was.get(u) !== d).map(([u]) => u)
    .concat([...was.keys()].filter((u) => !now.has(u)));
  console.log('送る頁 ' + urls.length + ' 件');
  urls.forEach((u) => console.log('  ' + u));
  if (DRY || !urls.length) return;
  for (let i = 0; i < 20; i++) {
    const r = await fetch(BASE + KEY + '.txt', { signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (r && r.ok && (await r.text()).trim() === KEY) break;
    if (i === 19) throw new Error('鍵のファイルが配られていない');
    await new Promise((ok) => setTimeout(ok, 30000));
  }
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(BASE).host, key: KEY, keyLocation: BASE + KEY + '.txt', urlList: urls }),
  });
  console.log('IndexNow の答え: ' + r.status);
  if (r.status !== 200 && r.status !== 202) process.exit(1);
})().catch((e) => { console.error(e.message); process.exit(1); });
