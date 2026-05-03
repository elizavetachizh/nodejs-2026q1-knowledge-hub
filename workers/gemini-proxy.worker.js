const DEFAULT_UPSTREAM = 'https://generativelanguage.googleapis.com';

const DENY_HEADERS = new Set([
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'connection',
  'expect',
  'host',
  'keep-alive',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
]);

function cloneHeadersExcept(from, deny) {
  const out = new Headers();
  for (const [name, value] of from.entries()) {
    if (deny.has(name.toLowerCase())) continue;
    out.append(name, value);
  }
  return out;
}

function mergeApiKey(searchParams, env) {
  const next = new URLSearchParams(searchParams);
  const inject =
    String(env.GEMINI_PROXY_INJECT_KEY ?? '').toLowerCase() === 'true';
  if (inject && !next.has('key') && env.GEMINI_API_KEY) {
    next.set('key', env.GEMINI_API_KEY);
  }
  return next;
}

export default {
  async fetch(request, env, _ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    const allowed = new Set(['GET', 'POST', 'HEAD', 'DELETE']);
    if (!allowed.has(request.method)) {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const upstreamOrigin = (env.GEMINI_PROXY_UPSTREAM_ORIGIN || DEFAULT_UPSTREAM).replace(
      /\/$/,
      '',
    );
    const incoming = new URL(request.url);
    const upstream = new URL(upstreamOrigin);

    const search = mergeApiKey(incoming.searchParams, env);
    const proxiedUrl = `${upstream.origin}${incoming.pathname}?${search}`;

    const fwdHeaders = cloneHeadersExcept(request.headers, DENY_HEADERS);

    /** @type {RequestInit & { duplex?: string }} */
    const init = {
      method: request.method,
      headers: fwdHeaders,
      redirect: 'manual',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      if (request.body) init.duplex = 'half';
    }

    try {
      const upstreamResponse = await fetch(proxiedUrl, init);

      const outHeaders = new Headers(upstreamResponse.headers);
      outHeaders.delete('set-cookie');

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: outHeaders,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(
        JSON.stringify({ error: 'Upstream fetch failed', detail: msg }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
