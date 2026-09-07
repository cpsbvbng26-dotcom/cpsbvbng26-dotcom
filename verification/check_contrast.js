/* 配色の読みやすさを測る。
 *
 *   node verification/check_contrast.js
 *
 * 「読みやすい配色」は好みの話に見えるが、一部は数字で決まる。WCAG 2.1 の
 * コントラスト比が本文で 4.5:1、大きな文字で 3:1 である。
 *
 * 一度これで測ったところ、--faint がライトで 2.65:1 しかなかった。この色は
 * 事実の欄の見出し、注記、脚注、表の見出しに使っていて、本文の相当量を占める。
 * 目では「薄いな」としか分からず、検査が無いので誰も気づかなかった。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = ['index.html', 'index.en.html', 'cv.html', 'research.html',
               'trinity.html', 'notes/index.html', 'notes/index.en.html'];

let pass = 0;
const failures = [];
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  OK   ' + label + (detail ? ' — ' + detail : '')); return; }
  console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
  failures.push(label + (detail ? ' — ' + detail : ''));
}

function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function ratio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* 本文に使う色。装飾（--wall, --ember, --line）は対象にしない。 */
const TEXT_TOKENS = ['text', 'muted', 'faint', 'accent'];
const AA = 4.5;

PAGES.forEach((page) => {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) { ok(page + ' がある', false); return; }
  const html = fs.readFileSync(file, 'utf8');

  const themeOf = (start, end) => {
    const i = html.indexOf(start);
    if (i < 0) return null;
    const j = end ? html.indexOf(end, i) : i + 1200;
    const block = html.slice(i, j < 0 ? i + 1200 : j);
    const out = {};
    [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)]
      .forEach((m) => { out[m[1]] = m[2]; });
    return out;
  };
  const light = themeOf(':root {', ':root[data-theme="dark"]');
  const dark = themeOf(':root[data-theme="dark"] {');
  if (!light || !dark) { ok(page + ' に配色の定義がある', false); return; }

  [['ライト', light], ['ダーク', dark]].forEach(([name, t]) => {
    ['bg', 'card'].forEach((baseName) => {
      const base = t[baseName];
      if (!base) return;
      TEXT_TOKENS.forEach((tok) => {
        if (!t[tok]) return;
        const r = ratio(t[tok], base);
        ok(page + ' ' + name + ' --' + tok + ' / --' + baseName,
           r >= AA, r.toFixed(2) + ':1（必要 ' + AA + '）');
      });
    });
  });

  /* 指し色と本文色の差は、どう選んでも 3:1 に届かない。
   * だからリンクは色ではなく下線で示す。下線の指定が残っているかを見る。 */
  if (/class="(?:facts|claim-kv|notes-list|prose)"/.test(html) || /notes-list/.test(html)) {
    ok(page + ' が本文中のリンクを下線で示している',
       /\.notes-list a[^{]*\{[^}]*text-decoration:\s*underline/.test(html) ||
       /\.prose a[^{]*\{[^}]*text-decoration:\s*underline/.test(html) ||
       /a,[^{]*\.prose a[^{]*\{[^}]*underline/.test(html));
  }
});

console.log('\n' + '-'.repeat(58));
if (failures.length) {
  console.log(pass + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
  process.exit(1);
}
console.log(pass + ' 件すべて通りました。');
