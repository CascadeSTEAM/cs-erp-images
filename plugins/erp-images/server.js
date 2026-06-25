'use strict';

const pkg = require('./plugin.json');

async function GET({ subpath }) {
  if (subpath === 'api/status') {
    return Response.json({ status: 'ok', plugin: pkg.name, version: pkg.version });
  }
  return new Response(`erp-images: unknown path "${subpath}"`, { status: 404 });
}

module.exports = { GET };
