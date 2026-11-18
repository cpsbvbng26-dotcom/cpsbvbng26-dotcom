/* 散文に書いた「NN 件・NN 項目・NN 通り」（と英語の同じもの）を、13 のリポジトリから拾う。
 *
 *     node verification/prose_numbers.js          # どの区分にも入っていない数を挙げる（無ければ終了コード 0）
 *
 * 決めごと 5。散文に数を書いたら、その数を機械で確かめられるようにする。
 * 2026-11-18 に、13 のリポジトリの散文の数を一つずつ壊して、どの検査が落ちるかを見た。
 * 落ちた数と、数え直せない数と、数ではないものを verification/prose-numbers.json に分けて置いた。
 * check_ecosystem.js の 13e が、ここで拾った数がすべてどれかの区分にあり、区分の側に余りが無いことを見る。
 *
 * 数の見分けには、数の前の 16 字（数字は # に替える）と助数詞を使う。数そのものは使わない。
 * 数が動いても区分は動かない。数の前の文を書き換えれば、区分を決め直すことになる。
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPOS = ['cpsbvbng26-dotcom', 'errata-check', 'self-correction', 'trinity-infinity', 'trinity-operator',
  'autonomy-and-self-cultivation', 'naval-gazette-notes', 'researcher-profile', 'justice-and-algorithms',
  'solitary-school', 'sophaxis', 'deposit-check', 'nusquama'];

const TEXT = /\.(md|html|json|ya?ml|toml|cff|txt|xml|bib|csv|ics)$|(^|\/)\.zenodo\.json$|(^|\/)(LICENSE[^/]*)$/;
const CODE = /\.(js|py|css|sh|svg)$/;
/* 見ないもの。理由は右に書く。紙面の翻刻・見本・試験の作り物・指示書・他人の文・生成物・検査の中身。 */
const 外す = [
  [/(^|\/)papers\/[^/]+\.md$/, '紙面の逐語の翻刻（check_fidelity が照合する）'],
  [/(^|\/)examples\//, '見本'],
  [/(^|\/)fixtures\//, '試験の作り物'],
  [/\/CLAUDE\.md$/, '指示書'],
  [/(^|\/)LICENSE[^/]*$/, 'ライセンスの文（他人の文）'],
  [/(sources-raw|statutes-texts|world-2026|\/world\/|legal-matrix|world\/data)/, '取り寄せた他人の法令の文'],
  [/^sophaxis\/site\/|^nusquama\/site\/|^trinity-operator\/site\/index\.html$|^self-correction\/(REGISTER\.md|data\/register\.csv|views\/)|^autonomy-and-self-cultivation\/SHELF\.md$|^researcher-profile\/register-timeline\.json$|^cpsbvbng26-dotcom\/docs\/library\.bib$|^trinity-operator\/(examples|games)\/[^/]+\.txt$|^nusquama\/verification\/gazette-numbers\.json$/, '生成物（生成もとで見る）'],
  [/^cpsbvbng26-dotcom\/(index(\.[a-z]{2})?\.html|cv\.html|card\.html|notes\/.*\.html|papers\/.*\.html|catalog\.(html|en\.html|json|bib)|tools(\.en)?\.html|sitemap\.xml|404\.html)$/, 'researcher-profile から生成した頁'],
  [/\/verification\/|^[^/]+\/tests\/|\/\.github\/checked-intake\//, '検査の中身'],
];
const 写しの区間 = {
  'cpsbvbng26-dotcom/README.md': ['<!-- 自己紹介:ここから -->', '<!-- 自己紹介:ここまで -->'],
  'cpsbvbng26-dotcom/README.en.md': ['<!-- 自己紹介:ここから -->', '<!-- 自己紹介:ここまで -->'],
  'solitary-school/README.md': ['読む時間:ここから', '読む時間:ここまで'],
  'solitary-school/index.html': ['読む時間:ここから', '読む時間:ここまで'],
};
const JP = /(?<![0-9０-９.\-/])([0-9]+)\s?(件|項目|通り)/g;
const EN = /(?<![0-9.\-/])\b([0-9]+)\s+(items?|checks?|entries|entry|repositories|repository|cases?|ways?|records?|rows?|findings?|errors?|tests?|works?|issues?|files?|papers?|pages?|DOIs?|versions?|sections?|rules?|steps?|lines?|languages?)\b/g;

function 前(line, col) {
  return line.slice(Math.max(0, col - 16), col).replace(/[0-9]+/g, '#');
}

/* 一つのファイルの文から、数を拾う。f は「リポジトリ/パス」。 */
function scanText(f, text) {
  const out = [];
  const lines = text.split('\n');
  let skip = null;
  const 区間 = 写しの区間[f];
  if (区間) {
    const a = lines.findIndex((x) => x.indexOf(区間[0]) >= 0);
    const b = lines.findIndex((x) => x.indexOf(区間[1]) >= 0);
    if (a >= 0 && b >= 0) skip = [a, b];
  }
  lines.forEach((l, i) => {
    if (skip && i >= skip[0] && i <= skip[1]) return;
    for (const rx of [JP, EN]) {
      for (const m of l.matchAll(rx)) {
        const col = m.index;
        out.push({ f, line: i + 1, col, num: m[1], 語: m[2], 前: 前(l, col), ctx: l.trim().slice(0, 200) });
      }
    }
  });
  return out;
}

function 見るファイルか(f) {
  if (CODE.test(f) || !TEXT.test(f)) return false;
  return !外す.some(([rx]) => rx.test(f));
}

/* 13 のリポジトリの、git が追っているファイルから拾う。 */
function scan(ROOT, repos = REPOS, override = {}) {
  const out = [];
  const 無い = [];
  for (const repo of repos) {
    const dir = path.join(ROOT, repo);
    let files;
    try {
      files = execFileSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
        .split('\n').filter(Boolean);
    } catch (e) { 無い.push(repo); continue; }
    for (const rel of files) {
      const f = repo + '/' + rel;
      if (!見るファイルか(f)) continue;
      let text = override[f];
      if (text === undefined) {
        try { text = fs.readFileSync(path.join(dir, rel), 'utf8'); } catch (e) { continue; }
      }
      out.push(...scanText(f, text));
    }
  }
  return { found: out, 無い };
}

/* 区分の表と突き合わせる。表の一行は [ファイル, 前, 語]。数は同じ鍵の多重集合として数える。 */
function 鍵(f, 前の字, 語) { return f + '\u0000' + 前の字 + '\u0000' + 語; }

function 突き合わせる(found, 表) {
  const 残り = new Map();
  const 区分 = new Map();
  for (const [名, rows] of Object.entries(表)) {
    for (const r of rows) {
      const k = 鍵(r[0], r[1], r[2]);
      残り.set(k, (残り.get(k) || 0) + 1);
      if (!区分.has(k)) 区分.set(k, 名);
    }
  }
  const 無区分 = [];
  for (const x of found) {
    const k = 鍵(x.f, x.前, x.語);
    const n = 残り.get(k) || 0;
    if (n > 0) 残り.set(k, n - 1); else 無区分.push(x);
  }
  const 余り = [];
  for (const [k, n] of 残り) for (let i = 0; i < n; i++) 余り.push(k.split('\u0000'));
  return { 無区分, 余り, 区分 };
}

/* prose-numbers.json を、[ファイル, 前, 語] の行の表にする。 */
function 表にする(decl) {
  const 表 = { 捕まる: [], 数えられない: [], 外す: [] };
  for (const [f, rows] of Object.entries(decl['捕まる'] || {})) for (const r of rows) 表['捕まる'].push([f, r[0], r[1]]);
  for (const r of decl['数えられない'] || []) 表['数えられない'].push([r['ファイル'], r['前'], r['語']]);
  for (const r of decl['外す'] || []) 表['外す'].push([r['ファイル'], r['前'], r['語']]);
  return 表;
}

module.exports = { REPOS, scan, scanText, 見るファイルか, 突き合わせる, 表にする, 前 };

if (require.main === module) {
  const ROOT = process.env.ECOSYSTEM_ROOT || path.resolve(__dirname, '..', '..');
  const decl = JSON.parse(fs.readFileSync(path.join(__dirname, 'prose-numbers.json'), 'utf8'));
  const { found, 無い } = scan(ROOT);
  const r = 突き合わせる(found, 表にする(decl));
  if (無い.length) console.log('無いリポジトリ: ' + 無い.join(', '));
  console.log('拾った数 ' + found.length + '、区分の無い数 ' + r.無区分.length + '、区分の余り ' + r.余り.length);
  r.無区分.forEach((x) => console.log('  区分が無い  ' + x.f + ':' + x.line + '  ' + x.num + ' ' + x.語 + '  ' + x.ctx.slice(0, 80)));
  r.余り.forEach((k) => console.log('  余り  ' + k.join(' | ')));
  process.exit(r.無区分.length || r.余り.length || 無い.length ? 1 : 0);
}
