/* Content-Security-Policy を、ページの中身から機械的に組み立てる。
 *
 * このサイトは外部リクエストを出さない。それを「そう書いてある」ではなく
 * **ブラウザが強制する制約**にする。default-src 'none' から始めて、
 * 実際に使っているものだけを名指しで許す。
 *
 * インラインの <style> と <script> は SHA-256 のハッシュで許す。
 * 'unsafe-inline' は使わない —— 使うと、注入されたスクリプトも通ってしまい、
 * CSP を置く意味がほとんど無くなる。
 *
 * 中身を書き換えるとハッシュが変わる。update_csp.js で入れ直す。
 * 入れ忘れは check_site.js が落とす（ブラウザも実行を拒む）。
 */

'use strict';

const crypto = require('crypto');

/* 外部へ照会するページが無くなったので、いまは空である。
 * 仕組みは残す —— 通信するページを足すときは、ここに書いた先だけが通る。
 * 書き忘れればブラウザが止める。 */
const CONNECT = [];

function sha256(text) {
  return "'sha256-" + crypto.createHash('sha256').update(text, 'utf8').digest('base64') + "'";
}

/* <style>…</style> と、src の無い <script>…</script> の中身をそのまま取り出す。
 * ハッシュは中身のバイト列に対して取るので、空白ひとつでも変われば変わる。 */
function inlineBlocks(html, tag) {
  const re = new RegExp('<' + tag + '(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</' + tag + '>', 'g');
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function build(html, opts) {
  const needsConnect = !!(opts && opts.connect) && CONNECT.length > 0;

  const scriptHashes = inlineBlocks(html, 'script').map(sha256);
  const styleHashes = inlineBlocks(html, 'style').map(sha256);

  const directives = [
    ["default-src", ["'none'"]],
    ["script-src", ["'self'"].concat(scriptHashes)],
    ["style-src", styleHashes],
    ["img-src", ["'self'", 'data:']],
    ["connect-src", needsConnect ? CONNECT : ["'none'"]],
    ["form-action", ["'none'"]],
    ["base-uri", ["'none'"]]
  ];

  return directives.map(([k, v]) => k + ' ' + v.join(' ')).join('; ');
}

const TAG_RE = /<meta http-equiv="Content-Security-Policy" content="[^"]*">\n?/;

/* CSP の meta 自身はハッシュの対象外（script でも style でもない）ので、
 * 入れ替えてもハッシュは変わらない。 */
function apply(html, opts) {
  const stripped = html.replace(TAG_RE, '');
  const csp = build(stripped, opts);
  const tag = '<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n';
  const anchor = '<meta name="viewport"';
  const i = stripped.indexOf(anchor);
  if (i < 0) throw new Error('viewport の meta が見つかりません');
  const nl = stripped.indexOf('\n', i) + 1;
  return { html: stripped.slice(0, nl) + tag + stripped.slice(nl), csp: csp };
}

function current(html) {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  return m ? m[1] : null;
}

module.exports = { build, apply, current, sha256, inlineBlocks, CONNECT };
