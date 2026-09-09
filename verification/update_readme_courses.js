#!/usr/bin/env node
/* README の学歴と修得した科目の欄を作り直す。
 *
 *   node verification/update_readme_courses.js
 *
 * 源は researcher-profile の courses.json である。ここが読むのは、それを刷った
 * トップの頁のほうである。**README を手で直さない。**
 */

'use strict';

const fs = require('fs');
const { apply, PAIRS } = require('./readme_courses');

let changed = 0;
PAIRS.forEach(([readme, page, lang]) => {
  const r = apply(readme, page, lang);
  if (r.before === r.after) { console.log('  そのまま  ' + readme); return; }
  fs.writeFileSync(r.file, r.after);
  changed++;
  console.log('  書き直した  ' + readme);
});
console.log(changed ? changed + ' 件を書き直しました。' : '変わりませんでした。');
