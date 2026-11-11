/* 9 つのリポジトリの検査を全部回して、一枚の表で出す。
 *
 *     node verification/check_all.js
 *
 * 兄弟ディレクトリに並んでいることを前提にする。場所が違えば ECOSYSTEM_ROOT で渡す。
 * 無いリポジトリは飛ばす（飛ばしたことは表に出す）。一つでも落ちたら終了コードは 1。
 *
 * 各リポジトリの CI が同じものを回している。ここはその手元版であって、
 * CI の代わりではない。
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.ECOSYSTEM_ROOT ||
  path.resolve(__dirname, '..', '..');

/* [リポジトリ, 表示名, コマンド, 引数…] */
const CHECKS = [
  ['cpsbvbng26-dotcom', '誤変換ほか', 'node', 'verification/check_text.js'],
  ['cpsbvbng26-dotcom', '配色', 'node', 'verification/check_contrast.js'],
  ['cpsbvbng26-dotcom', 'サイトの構造', 'node', 'verification/check_site.js'],
  ['cpsbvbng26-dotcom', '作用素のページの数値', 'node', 'verification/check_trinity.js'],
  ['cpsbvbng26-dotcom', '秘密情報と連絡先', 'node', 'verification/check_secrets.js'],

  ['errata-check', '道具自身', 'python3', 'tests/check_tool.py'],
  ['errata-check', '見本（最小）', 'python3', 'errata_check.py', 'examples/minimal/audit.toml'],
  ['errata-check', '見本（分野ごと）', 'python3', 'errata_check.py', 'examples/disciplines/audit.toml'],
  ['errata-check', '見本（参考文献）', 'python3', 'errata_check.py', 'examples/references/audit.toml'],

  ['self-correction', '登録簿', 'python3', 'verification/check_register.py'],
  ['self-correction', 'データセット', 'python3', 'verification/check_dataset.py'],

  ['trinity-infinity', '誤変換', 'python3', 'verification/check_text.py'],
  ['trinity-infinity', '定理', 'python3', 'verification/independent_check.py'],
  ['trinity-infinity', '印字された数値', 'python3', 'verification/claims_audit.py'],
  ['trinity-infinity', '正誤表の監査', 'python3', 'verification/check_errata.py'],
  ['trinity-infinity', '経路', 'python3', 'verification/check_route.py'],
  ['trinity-infinity', '秘密情報', 'python3', 'verification/check_secrets.py'],
  ['trinity-infinity', '書誌の情報', 'python3', 'verification/check_meta.py'],

  ['trinity-operator', '誤変換', 'python3', 'verification/check_text.py'],
  ['trinity-operator', '作用素', 'python3', 'check.py'],
  ['trinity-operator', '証書', 'python3', 'verification/check_certificate.py'],
  ['trinity-operator', '展望', 'python3', 'verification/check_roadmap.py'],
  ['trinity-operator', '引用情報', 'python3', 'verification/check_citation.py'],
  ['trinity-operator', '秘密情報', 'python3', 'verification/check_secrets.py'],

  /* site/ と dist/ は生成物である。まっさらな checkout には無いので、
   * 生成そのものも一本の検査として先に回す。手元で通って CI で落ちたのがここ。 */
  ['autonomy-and-self-cultivation', '生成', 'node', 'build.js'],
  ['autonomy-and-self-cultivation', '紙面との照合', 'python3', 'verification/check_fidelity.py'],
  ['autonomy-and-self-cultivation', '正誤表の監査', 'python3', 'verification/check_errata.py'],
  ['autonomy-and-self-cultivation', '参考文献', 'python3', 'verification/check_references.py'],
  ['autonomy-and-self-cultivation', '誤変換ほか', 'node', 'verification/check_text.js'],
  ['autonomy-and-self-cultivation', 'サイトの構造', 'node', 'verification/check_site.js'],

  ['naval-gazette-notes', '誤変換', 'python3', 'verification/check_text.py'],
  ['naval-gazette-notes', '正誤表の監査', 'python3', 'verification/check_errata.py'],
  ['naval-gazette-notes', '検査の結果の表', 'python3', 'data/check.py'],

  ['researcher-profile', '誤変換ほか', 'node', 'verification/check_text.js'],
  ['researcher-profile', '生成', 'node', 'build.js'],
  ['researcher-profile', '生成物の中身', 'node', 'verification/check_build.js'],
  ['researcher-profile', '秘密情報と連絡先', 'node', 'verification/check_secrets.js'],

  ['justice-and-algorithms', '誤変換ほか', 'node', 'verification/check_text.js'],
  ['justice-and-algorithms', '生成', 'node', 'build.js'],
  ['justice-and-algorithms', 'サイトの構造', 'node', 'verification/check_site.js'],

  ['solitary-school', '誤変換ほかと二つの面の一致', 'node', 'verification/check_text.js']
];

/* 全角は 2 桁ぶん取る。ここを数えないと表がずれる。 */
function width(s) {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    w += (c >= 0x1100 && (c <= 0x115f || c === 0x2329 || c === 0x232a ||
      (c >= 0x2e80 && c <= 0xa4cf && c !== 0x303f) ||
      (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6))) ? 2 : 1;
  }
  return w;
}

function pad(s, n) {
  return s + ' '.repeat(Math.max(0, n - width(s)));
}

/* 出力の最後の中身のある行を、結果の要約として使う。 */
function summary(text, limit) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines.length ? lines[lines.length - 1] : '';
  let out = '';
  for (const ch of last) {
    if (width(out + ch) > limit) { out += '…'; break; }
    out += ch;
  }
  return out;
}

let passed = 0, failed = 0, missing = 0;
const broke = [];
const seen = new Set();
/* 一枚の頁にする表（Actions の要約）。毎日の横断の仕事が書く（2026-11-11）。 */
const rows = [];

console.log('');
console.log('  ' + pad('リポジトリ', 30) + pad('検査', 24) + '結果');
console.log('  ' + '-'.repeat(76));

for (const [repo, label, cmd, ...args] of CHECKS) {
  const dir = path.join(ROOT, repo);
  const shown = seen.has(repo) ? '' : repo;
  seen.add(repo);

  if (!fs.existsSync(dir)) {
    console.log('  ' + pad(shown, 30) + pad(label, 24) + '－  ディレクトリが無い');
    rows.push([repo, label, '－', 'ディレクトリが無い']);
    missing++;
    continue;
  }
  let out, ok;
  try {
    out = execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    ok = true;
  } catch (e) {
    out = String((e.stdout || '') + (e.stderr || '')) || String(e.message);
    ok = false;
  }
  console.log('  ' + pad(shown, 30) + pad(label, 24) +
    (ok ? '通' : '落') + '  ' + summary(out, 34));
  rows.push([repo, label, ok ? '通' : '落', summary(out, 60).replace(/\|/g, '／')]);
  if (ok) passed++; else { failed++; broke.push(repo + ' / ' + label); }
}

console.log('  ' + '-'.repeat(76));
console.log('  通 ' + passed + ' / 落 ' + failed + ' / 無い ' + missing);

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = ['## 各リポジトリの検査（' + new Date().toISOString().slice(0, 10) + '）', '',
    '通 ' + passed + ' / 落 ' + failed + ' / 無い ' + missing, '',
    '| リポジトリ | 検査 | 結果 | 最後の行 |', '| --- | --- | --- | --- |']
    .concat(rows.map((r) => '| ' + r.join(' | ') + ' |'));
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n\n');
}
console.log('');

if (failed) {
  broke.forEach((b) => console.log('  - ' + b));
  console.log('');
  process.exit(1);
}
