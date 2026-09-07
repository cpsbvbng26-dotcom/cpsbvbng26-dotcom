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
const PAGES = ['index.html', 'index.en.html', 'research.html', 'doi.html', 'trinity.html', 'cv.html', 'notes/index.html', 'notes/index.en.html', '404.html'];

PAGES.forEach((page) => {
  const file = path.join(ROOT, page);
  const before = fs.readFileSync(file, 'utf8');
  const { html, csp: policy } = csp.apply(before);
  if (html !== before) fs.writeFileSync(file, html);
  const n = (policy.match(/sha256-/g) || []).length;
  console.log('%s  ハッシュ %d 件  %s',
    page.padEnd(15), n, /connect-src 'none'/.test(policy) ? "connect-src 'none'" : 'connect-src 6 ホスト');
});
