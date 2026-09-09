/* 学歴と修得した科目の欄を、生成されたトップの頁から組み立てる。
 *
 *   node verification/update_readme_courses.js
 *
 * **README は手で書かない。**単位は 124 単位まで増える予定で、そのたびに
 * 日英二つの表と学歴の欄を手で直せば、いつか必ず写し忘れる。
 * 源は researcher-profile の courses.json 一つで、トップの頁がそれを刷る。
 * ここはその頁から読み直して Markdown に組み直すだけである。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARK = ['<!-- 経歴:ここから -->', '<!-- 経歴:ここまで -->'];

const WORDS = {
  ja: { history: '経歴', earned: '修得', courses: '修得した科目',
        course: '科目', category: '区分', credits: '単位',
        more: ' —— これから増える。' },
  en: { history: 'Education', earned: 'Credits earned', courses: 'Courses I have credit for',
        course: 'Course', category: 'Category', credits: 'Credits',
        more: ' — more to come.' },
};

const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/* トップの頁の学歴から、行と科目を取り出す。
 *
 * **入れ子の <li> があるので、<li> では切らない。**科目の一覧そのものが <li> の
 * 並びで、正規表現で外側だけを取ろうとすると内側で切れる。実際に一度切れた。
 * 行の頭は path-name である。そこで切る。 */
function readPath(html) {
  const i = html.indexOf('<ol class="path">');
  if (i < 0) return [];
  const block = html.slice(i, html.indexOf('</ol>', i));
  const parts = block.split('<span class="path-name">').slice(1);
  return parts.map((row) => {
    const name = /^([\s\S]*?)<\/span>/.exec(row);
    const state = /<span class="path-state">([\s\S]*?)<\/span>/.exec(row);
    const note = /<span class="path-note">([\s\S]*?)<\/span>/.exec(row);
    const list = /<ul class="path-courses">([\s\S]*?)<\/ul>/.exec(row);
    const items = list
      ? [...list[1].matchAll(/<li data-category="([^"]*)" data-credits="(\d+)">([\s\S]*?)<\/li>/g)]
          .map((c) => ({ category: c[1], credits: Number(c[2]),
                         /* 区分の札は名前ではない。外してから読む。 */
                         name: strip(c[3].replace(/<i>[\s\S]*?<\/i>/g, '')) }))
      : [];
    return {
      name: strip(name ? name[1] : ''),
      state: strip(state ? state[1] : ''),
      total: strip(note ? note[1] : ''),
      items,
    };
  });
}

function blockFor(page, lang) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const rows = readPath(html);
  const w = WORDS[lang];
  const out = [MARK[0], '', '### ' + w.history, '',
    '| | | ' + w.earned + ' |', '| --- | --- | --- |'];
  rows.forEach((r) => out.push(`| ${r.name} | ${r.state} | ${r.total} |`));
  out.push('', '### ' + w.courses, '');
  rows.filter((r) => r.items.length).forEach((r, i, all) => {
    out.push(`**${r.name}**` + (i === all.length - 1 ? w.more : ''), '',
      `| ${w.course} | ${w.category} | ${w.credits} |`, '| --- | --- | --- |');
    r.items.forEach((c) => out.push(`| ${c.name} | ${c.category} | ${c.credits} |`));
    out.push('', `**${r.total}**`, '');
  });
  out.push(MARK[1]);
  return out.join('\n');
}

function apply(readme, page, lang) {
  const file = path.join(ROOT, readme);
  const s = fs.readFileSync(file, 'utf8');
  const i = s.indexOf(MARK[0]);
  const j = s.indexOf(MARK[1]);
  if (i < 0 || j < 0) throw new Error(readme + ' に印がありません: ' + MARK.join(' / '));
  return { file, before: s, after: s.slice(0, i) + blockFor(page, lang) + s.slice(j + MARK[1].length) };
}

const PAIRS = [['README.md', 'index.html', 'ja'], ['README.en.md', 'index.en.html', 'en']];

module.exports = { blockFor, apply, PAIRS, MARK };
