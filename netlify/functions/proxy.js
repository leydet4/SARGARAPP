// netlify/functions/proxy.js
export const handler = async (event) => {
  try {
    const url = (event.queryStringParameters?.u || '').trim();
    const type = (event.queryStringParameters?.type || 'json').trim(); // 'json' or 'text'

    if (!url) {
      return { statusCode: 400, body: 'Missing ?u=' };
    }

    // Whitelist hosts we’ll allow
    const allowedHosts = new Set([
      'erddap.marine.usf.edu',
      'erddap.sensors.ioos.us',
      'www.ndbc.noaa.gov'
    ]);

    let target;
    try {
      target = new URL(url);
    } catch {
      return { statusCode: 400, body: 'Invalid URL' };
    }

    if (!allowedHosts.has(target.hostname)) {
      return { statusCode: 403, body: `Host not allowed: ${target.hostname}` };
    }

    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'CFD-Marine-Team-App/1.0' }
    });

    if (!upstream.ok) {
      return { statusCode: upstream.status, body: `Upstream ${upstream.status}` };
    }

    let body;
    let contentType = 'application/json; charset=utf-8';

    if (type === 'text') {
      body = await upstream.text();
      contentType = 'text/plain; charset=utf-8';
    } else {
      const json = await upstream.json();
      body = JSON.stringify(json);
      contentType = 'application/json; charset=utf-8';
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      },
      body
    };
  } catch (err) {
    return { statusCode: 500, body: 'Proxy error: ' + (err?.message || String(err)) };
  }
};
