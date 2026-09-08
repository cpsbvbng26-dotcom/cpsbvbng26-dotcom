/* 各ページの CSP を、いまの中身から入れ直す。
 *
 *   node verification/update_csp.js
 *
 * インラインの <style> や <script> を編集したら、これを実行する。
 * 忘れると check_site.js が落ち、ブラウザもそのスクリプトの実行を拒む。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const csp = require('./csp.js');

const ROOT = path.resolve(__dirname, '..');
/* 配っているページの一覧は verification/pages.json が唯一の出所である。
 * 三箇所にベタ書きしていたのをやめた。ページを足したら pages.json だけ直す。 */
const PAGES = require('./pages.json').pages.map((p) => p.file);

PAGES.forEach((page) => {
  const file = path.join(ROOT, page);
  const before = fs.readFileSync(file, 'utf8');
  const { html, csp: policy } = csp.apply(before);
  if (html !== before) fs.writeFileSync(file, html);
  const n = (policy.match(/sha256-/g) || []).length;
  console.log('%s  ハッシュ %d 件  %s',
    page.padEnd(15), n, /connect-src 'none'/.test(policy) ? "connect-src 'none'" : 'connect-src 6 ホスト');
});
