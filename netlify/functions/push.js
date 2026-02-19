// netlify/functions/push.js
// Handles admin push subscriptions + broadcasting via Web Push (VAPID)

import webpush from 'web-push';

const {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_TOKEN,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  ADMIN_KEY,
} = process.env;

const BRANCH = 'main';
const SUBS_PATH = 'data/admin-subs.json';
const ghBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;

function j(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
function bad(msg, status = 400) { return j({ ok:false, error: msg }, status); }

async function ghGetFile(path) {
  const res = await fetch(`${ghBase}/${encodeURIComponent(path)}?ref=${BRANCH}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'netlify-fn' }
  });
  if (res.status === 404) return { sha:null, json:[] };
  if (!res.ok) throw new Error(`GitHub GET ${path} failed ${res.status}`);
  const jj = await res.json();
  const text = Buffer.from(jj.content || '', 'base64').toString('utf8');
  let parsed = [];
  if (text && text.trim()) {
    try { parsed = JSON.parse(text); } catch { parsed = []; }
  }
  return { sha: jj.sha, json: Array.isArray(parsed) ? parsed : [] };
}
async function ghPutFile(path, jsonData, sha = null, message = 'push: save subs') {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64'),
    branch: BRANCH
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${ghBase}/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'netlify-fn',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub PUT ${path} failed ${res.status}: ${t}`);
  }
  return res.json();
}

function requireAdmin(req) {
  if (!ADMIN_KEY) return false; // if no admin key set, don’t block (development)
  const supplied = req.headers.get('x-admin-key') || '';
  return supplied === ADMIN_KEY;
}

webpush.setVapidDetails(
  VAPID_SUBJECT || 'mailto:admin@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

async function broadcast(payload) {
  const { sha, json: subs } = await ghGetFile(SUBS_PATH);
  if (!subs.length) return { sent:0, removed:0 };

  let sent = 0;
  let removed = 0;
  const keep = [];

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s, JSON.stringify(payload));
      sent++;
      keep.push(s);
    } catch (err) {
      // Gone or invalid -> drop
      if (err.statusCode === 404 || err.statusCode === 410) {
        removed++;
      } else {
        keep.push(s); // transient error, keep it
      }
    }
  }));

  // Save pruned list if changed
  if (keep.length !== subs.length) {
    await ghPutFile(SUBS_PATH, keep, sha, 'push: prune invalid subs');
  }

  return { sent, removed };
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response('', {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key'
        }
      });
    }

    if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return bad('missing_env: GitHub and/or VAPID keys', 500);
    }

    if (method === 'POST') {
      const body = await req.json().catch(()=> ({}));
      const action = (body.action || '').toLowerCase();

      // subscribe / unsubscribe (admin gated)
      if (action === 'subscribe') {
        if (!requireAdmin(req)) return bad('unauthorized', 401);
        const sub = body.subscription;
        if (!sub || !sub.endpoint) return bad('missing subscription');

        const { sha, json: subs } = await ghGetFile(SUBS_PATH);
        const exists = subs.find(x => x.endpoint === sub.endpoint);
        if (!exists) subs.push(sub);
        await ghPutFile(SUBS_PATH, subs, sha, 'push: add subscription');
        return j({ ok:true });
      }

      if (action === 'unsubscribe') {
        if (!requireAdmin(req)) return bad('unauthorized', 401);
        const endpoint = body.endpoint;
        const { sha, json: subs } = await ghGetFile(SUBS_PATH);
        const n = subs.filter(s => s.endpoint !== endpoint);
        await ghPutFile(SUBS_PATH, n, sha, 'push: remove subscription');
        return j({ ok:true, removed: subs.length - n.length });
      }

      // test ping (admin)
      if (action === 'test') {
        if (!requireAdmin(req)) return bad('unauthorized', 401);
        const payload = {
          title: 'CFD Marine — Test',
          body: 'Push test from Admin.',
          tag: 'cfd-admin-test',
          url: '/pages/maintenance-admin.html'
        };
        const res = await broadcast(payload);
        return j({ ok:true, ...res });
      }

      // from maintenance.js after create
      if (action === 'broadcastnew') {
        const { id, boat, description, severity } = body;
        const payload = {
          title: 'New Maintenance Issue',
          body: `${boat}: ${description} (${severity || 'Severity n/a'})`,
          tag: 'cfd-new-issue',
          url: `/pages/maintenance-boat.html?boat=${encodeURIComponent(boat)}`
        };
        const res = await broadcast(payload);
        return j({ ok:true, ...res });
      }

      return bad('unknown_action');
    }

    return bad('method_not_allowed', 405);
  } catch (err) {
    return j({ ok:false, error:String(err) }, 500);
  }
};
