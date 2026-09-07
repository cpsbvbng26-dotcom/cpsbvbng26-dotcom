/* sitemap.xml を、いまのページと git の記録から入れ直す。
 *
 *   node verification/update_sitemap.js
 *
 * ページを足したり作り直したりしたら、これを実行する。忘れると check_site.js が
 * 落ちる。lastmod は「そのファイルを最後に触ったコミットの日付」で、作業ツリーに
 * 未コミットの変更があるファイルは今日の日付にする。
 *
 * つまり、ページの変更と sitemap.xml は同じコミットに入れる。別のコミットに
 * すると、あいだのコミットで lastmod が実際より古いままになる。
 *
 * 手で日付を書くと必ず古くなる。実際に 2 ページぶん古くなっていた。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/';

/* 索引に載せるページ。404.html は noindex なので入れない。
 * loc は正準 URL に合わせる（トップだけ index.html を付けない）。 */
const PAGES = [
  { file: 'index.html', loc: '', priority: '1.0' },
  { file: 'index.en.html', loc: 'index.en.html', priority: '0.9' },
  { file: 'research.html', loc: 'research.html', priority: '0.8' },
  { file: 'trinity.html', loc: 'trinity.html', priority: '0.7' },
  { file: 'doi.html', loc: 'doi.html', priority: '0.7' },
  { file: 'notes/index.html', loc: 'notes/index.html', priority: '0.5' },
  { file: 'notes/index.en.html', loc: 'notes/index.en.html', priority: '0.5' },
  { file: 'cv.html', loc: 'cv.html', priority: '0.4' },
];

const CHANGEFREQ = 'monthly';

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function lastmod(file) {
  /* 未コミットの変更があるなら、これから入るコミットの日付になる。 */
  if (git(['status', '--porcelain', '--', file])) {
    return new Date().toISOString().slice(0, 10);
  }
  const d = git(['log', '-1', '--format=%cs', '--', file]);
  if (!d) throw new Error(file + ' の履歴が取れません（浅いクローンかもしれません）');
  return d;
}

const body = PAGES.map((p) => [
  '  <url>',
  '    <loc>' + BASE + p.loc + '</loc>',
  '    <lastmod>' + lastmod(p.file) + '</lastmod>',
  '    <changefreq>' + CHANGEFREQ + '</changefreq>',
  '    <priority>' + p.priority + '</priority>',
  '  </url>',
].join('\n')).join('\n');

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + body + '\n</urlset>\n';

const out = path.join(ROOT, 'sitemap.xml');
const before = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
if (before !== xml) fs.writeFileSync(out, xml);
console.log('sitemap.xml  %d ページ  %s', PAGES.length,
  before === xml ? '変更なし' : '書き直しました');
PAGES.forEach((p) => console.log('  ' + p.file.padEnd(22) + ' ' + lastmod(p.file)));

module.exports = { PAGES, BASE, CHANGEFREQ };
