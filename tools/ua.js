'use strict';
/* The User-Agent of the requests of tools/live.js. request() is fetch() with this User-Agent over any other. */
const UA = 'live-site-check (+https://github.com/' + (process.env.GITHUB_REPOSITORY || '') + ')';

function request(url, opts = {}) {
  const headers = {};
  for (const [k, v] of Object.entries(opts.headers || {})) if (k.toLowerCase() !== 'user-agent') headers[k] = v;
  headers['User-Agent'] = UA;
  return fetch(url, { ...opts, headers });
}

module.exports = { UA, request };
