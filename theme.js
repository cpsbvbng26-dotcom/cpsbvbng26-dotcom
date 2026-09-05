/*!
 * テーマ切り替え
 * 端末の設定を初期値にし、利用者が選んだ場合はその選択を localStorage に保存する。
 * フッターの Claude 表示の横に Grok を出す。
 */
(function () {
  'use strict';

  var KEY = 'site-theme';
  var root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function save(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* 保存できなくても動作に支障はない */ }
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function current() {
    return root.getAttribute('data-theme') || stored() || systemTheme();
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121214' : '#faf9f7');

    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var toDark = theme === 'light';
    btn.textContent = toDark ? '☾' : '☀';
    btn.setAttribute('aria-label', toDark ? 'ダークテーマに切り替える' : 'ライトテーマに切り替える');
    btn.setAttribute('title', btn.getAttribute('aria-label'));
  }

  function addGrokMark() {
    var foot = document.querySelector('footer .foot');
    if (!foot || foot.querySelector('.built-with.grok')) return;

    if (!document.getElementById('grok-mark-style')) {
      var style = document.createElement('style');
      style.id = 'grok-mark-style';
      style.textContent =
        '.built-with.grok:hover{border-color:#4b5563;background:rgba(75,85,99,.08)}' +
        '.built-with.grok .dot{background:#4b5563}' +
        '.built-with-row{display:inline-flex;flex-wrap:wrap;gap:.5rem;align-items:center}';
      document.head.appendChild(style);
    }

    var claude = foot.querySelector('a.built-with');
    var row = document.createElement('span');
    row.className = 'built-with-row';
    var mark = document.createElement('a');
    mark.className = 'built-with grok';
    mark.href = 'https://grok.com';
    mark.target = '_blank';
    mark.rel = 'noopener';
    mark.innerHTML = '<span class="dot" aria-hidden="true"></span>Assisted by Grok';
    if (claude && claude.parentNode === foot) {
      foot.insertBefore(row, claude);
      row.appendChild(claude);
    } else {
      foot.appendChild(row);
    }
    row.appendChild(mark);
  }

  var saved = stored();
  if (saved) root.setAttribute('data-theme', saved);

  document.addEventListener('DOMContentLoaded', function () {
    apply(current());
    addGrokMark();
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = current() === 'light' ? 'dark' : 'light';
      apply(next);
      save(next);
    });
  });
})();
