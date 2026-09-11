/* キーボードだけで辿れるかを、実際にブラウザを起こして測る。
 *
 *   node verification/check_keyboard.js
 *
 * 他の検査は HTML を文字列として見る。ここだけは違う。
 * **焦点がどこに置かれ、そのとき何が見えているか**は、字面からは出ない。
 * opacity は祖先から掛かるし、登場演出は時間の関数だからである。
 *
 * 要るもの —— playwright と Chromium。無ければ 1 を返して止まる。
 * 黙って通したことにはしない。走らなかった検査は、通った検査ではない。
 *
 *   PLAYWRIGHT_CHROMIUM=/path/to/chrome   実行ファイルを指す（任意）
 *
 * check_all.js には入れていない。ブラウザの要る検査を毎回の並びに混ぜると、
 * 環境の都合で落ちたのか中身が壊れたのかが見分けられなくなる。
 */

'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = require('./pages.json').pages.map((p) => p.file);
const BASE = '/cpsbvbng26-dotcom';
/* 横へ流れないことを測る幅。広い側を入れてあるのは、**ここで壊れていたから**である。 */
const WIDTHS = [1440, 1200, 900, 390];

let pass = 0;
const failures = [];
function ok(label, cond, detail) {
  if (cond) { console.log('  OK   ' + label); pass++; return; }
  console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
  failures.push(label + (detail ? ' — ' + detail : ''));
}
function section(n) { console.log('\n' + n); }

/* ------------------------------------------------------------------ *
 * 道具を見つける
 * ------------------------------------------------------------------ */

function loadPlaywright() {
  const extra = ['/opt/node22/lib/node_modules', '/usr/lib/node_modules',
                 '/usr/local/lib/node_modules'];
  try { return require('playwright'); } catch (e) { /* 次を試す */ }
  for (const dir of extra) {
    try { return require(path.join(dir, 'playwright')); } catch (e) { /* 次 */ }
  }
  return null;
}

/* playwright が自分で見つけられるなら、それに任せる（CI はそちら）。
 * この作業環境では版がずれているので、置いてある実行ファイルを直に指す。 */
function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const bases = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers',
                 path.join(os.homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    const dirs = fs.readdirSync(base).filter((d) => /^chromium-/.test(d)).sort().reverse();
    for (const d of dirs) {
      const exe = path.join(base, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

/* 実行ファイルを指しても、指さなくても、とにかく起こす。
 * **どちらでも駄目なら止まる。**黙って通したことにはしない。 */
async function launch(pw, exe) {
  const args = ['--no-sandbox'];
  if (exe) {
    try { return { browser: await pw.chromium.launch({ executablePath: exe, args }), exe }; }
    catch (e) { /* playwright 自身の一式を試す */ }
  }
  return { browser: await pw.chromium.launch({ args }),
           exe: pw.chromium.executablePath() };
}

/* ------------------------------------------------------------------ *
 * 配る
 * ------------------------------------------------------------------ */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml',
  '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.png': 'image/png', '.pdf': 'application/pdf',
  '.ico': 'image/x-icon', '.txt': 'text/plain',
};

function serve() {
  return new Promise((res) => {
    const s = http.createServer((req, rep) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.startsWith(BASE)) p = p.slice(BASE.length) || '/';
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        rep.writeHead(404); return rep.end('not found');
      }
      rep.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      rep.end(fs.readFileSync(f));
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

/* ------------------------------------------------------------------ *
 * 測る
 * ------------------------------------------------------------------ */

/* 焦点を受けた要素について、祖先までさかのぼった実効の不透明度と、
 * 焦点の枠が出ているかを返す。**祖先が透けていれば、本人も見えない。** */
const PROBE = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  let op = 1, n = el;
  while (n && n !== document.documentElement) {
    op = Math.min(op, parseFloat(getComputedStyle(n).opacity));
    n = n.parentElement;
  }
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    text: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('href') || '').trim().slice(0, 40),
    ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
    opacity: op,
    w: Math.round(r.width), h: Math.round(r.height),
    order: [...document.querySelectorAll('*')].indexOf(el),
  };
};

async function walk(pg) {
  const seen = [];
  let trap = null;
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.keyboard.press('Tab');
  for (let i = 0; i < 300; i++) {
    const info = await pg.evaluate(PROBE);
    if (!info) break;
    const key = info.tag + '|' + info.text + '|' + info.order;
    if (seen.some((x) => x.key === key)) {
      if (seen.length && seen[0].key === key) break;   /* 一周した */
      trap = key;                                       /* 先へ進まない */
      break;
    }
    seen.push(Object.assign({ key }, info));
    await pg.keyboard.press('Tab');
  }
  return { seen, trap };
}

(async () => {
  const pw = loadPlaywright();
  if (!pw) {
    console.error('playwright が無い。この検査は走らなかった。');
    console.error('走らなかった検査は、通った検査ではない。');
    process.exit(1);
  }
  let browser, exe;
  try {
    ({ browser, exe } = await launch(pw, findChromium()));
  } catch (e) {
    console.error('Chromium を起こせなかった。この検査は走らなかった。');
    console.error('PLAYWRIGHT_CHROMIUM に実行ファイルを指すか、playwright install chromium を先に走らせる。');
    console.error(String(e.message || e).split('\n')[0]);
    process.exit(1);
  }

  const server = await serve();
  const port = server.address().port;

  console.log('キーボードで辿れるか —— Chromium で ' + PAGES.length + ' ページを Tab で辿る\n');
  console.log('  ' + exe);

  for (const page of PAGES) {
    section(page);
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const pg = await ctx.newPage();
    const errors = [];
    pg.on('pageerror', (e) => errors.push(e.message));
    await pg.goto('http://127.0.0.1:' + port + BASE + '/' + page, { waitUntil: 'networkidle' });

    const { seen, trap } = await walk(pg);

    ok('焦点が先へ進む（罠が無い）', trap === null, trap || '');
    ok('辿れる要素がある', seen.length > 0, String(seen.length));

    /* **透けたまま焦点を受けない。**登場演出の待ちに焦点が追い越されると起きる。 */
    const dim = seen.filter((x) => x.opacity < 0.99);
    ok('透けたまま焦点を受ける要素が無い', dim.length === 0,
       dim.slice(0, 4).map((x) => x.tag + ' ' + x.text + ' (' + x.opacity.toFixed(2) + ')').join(' / ')
       + (dim.length > 4 ? ' ほか計 ' + dim.length : ''));

    /* 焦点の枠。出ない要素があると、いまどこにいるかが読めない。 */
    const blind = seen.filter((x) => !x.ring);
    ok('焦点の枠が出ない要素が無い', blind.length === 0,
       blind.slice(0, 4).map((x) => x.tag + ' ' + x.text).join(' / ')
       + (blind.length > 4 ? ' ほか計 ' + blind.length : ''));

    /* 大きさ 0 の要素に焦点が乗ると、枠も出ない。 */
    const flat = seen.filter((x) => x.w === 0 || x.h === 0);
    ok('大きさの無い要素に焦点が乗らない', flat.length === 0,
       flat.map((x) => x.tag + ' ' + x.text).join(' / '));

    /* Tab の順が、読む順（DOM の並び）とずれていないこと。 */
    const jumps = seen.filter((x, i) => i > 0 && x.order < seen[i - 1].order);
    ok('辿る順が読む順と同じ', jumps.length === 0,
       jumps.map((x) => x.tag + ' ' + x.text).join(' / '));

    ok('読み込みで例外が出ない', errors.length === 0, errors.join(' / '));

    await ctx.close();

    /* **横スクロールは、狭い画面だけの話ではない。**ナビが折り返さない作りだと、
     * 節の多い頁では 1440px でも横幅を 776px 押し広げ、頁ごと横へ流れていた。
     * 項目が増えた分だけ黙って壊れるので、広い側から狭い側まで測る。 */
    for (const w of WIDTHS) {
      const c2 = await browser.newContext({ viewport: { width: w, height: 900 } });
      const p2 = await c2.newPage();
      await p2.goto('http://127.0.0.1:' + port + BASE + '/' + page, { waitUntil: 'networkidle' });
      const over = await p2.evaluate(() => {
        const de = document.documentElement;
        const nav = document.querySelector('.nav');
        return {
          doc: de.scrollWidth - de.clientWidth,
          nav: nav ? Math.round(nav.getBoundingClientRect().right) - window.innerWidth : 0,
        };
      });
      ok(w + 'px で横へ流れない', over.doc <= 1 && over.nav <= 1,
         '頁 ' + over.doc + ' / ナビ ' + over.nav);
      await c2.close();
    }
  }

  await browser.close();
  server.close();

  /* **散文に数を書いたら、その数を機械で確かめる。**
   * この検査はブラウザが要るので check_ecosystem.js の並びに入れていない。
   * 名乗りを見るのは、だからここになる。
   * expected は、この二件を足したあとの総数である。 */
  section('名乗っている数');
  {
    const expected = pass + 2;   /* 1 頁あたり 7 + WIDTHS.length 件、最後にこの二件 */
    [['README.md', /check_keyboard\.js\s+# Tab で辿って測る (\d+) 項目/],
     ['README.en.md', /check_keyboard\.js\s+# Tab traversal, (\d+) checks/]].forEach(([f, re]) => {
      const m = re.exec(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      ok(f + ' が名乗る数が実際と合う', m !== null && Number(m[1]) === expected,
         (m ? '名乗り ' + m[1] : '名乗りが無い') + ' / 実際 ' + expected);
    });
  }

  console.log('\n--------------------------------------------------------');
  if (failures.length) {
    console.log(failures.length + ' 件が落ちました。');
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  console.log(pass + ' 件すべて通りました。');
})().catch((e) => { console.error(e); process.exit(1); });
