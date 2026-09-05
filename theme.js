/*!
 * テーマ切り替え
 * 端末の設定を初期値にし、利用者が選んだ場合はその選択を localStorage に保存する。
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

    // アドレスバーの色も切り替える
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121214' : '#faf9f7');

    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var toDark = theme === 'light';
    btn.textContent = toDark ? '☾' : '☀';
    btn.setAttribute('aria-label', toDark ? 'ダークテーマに切り替える' : 'ライトテーマに切り替える');
    btn.setAttribute('title', btn.getAttribute('aria-label'));
  }

  // ちらつきを避けるため、描画前に保存済みの選択を反映する
  var saved = stored();
  if (saved) root.setAttribute('data-theme', saved);

  document.addEventListener('DOMContentLoaded', function () {
    apply(current());
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = current() === 'light' ? 'dark' : 'light';
      apply(next);
      save(next);
    });
  });
})();
