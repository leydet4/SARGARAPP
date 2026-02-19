// netlify/functions/gar.js — Final Clean Neon Database Version (safe JSON + null fixes)
import { neon } from '@neondatabase/serverless';

const { DATABASE_URL, ADMIN_KEY } = process.env;
const sql = neon(DATABASE_URL);

function j(obj, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key'
    },
    body: JSON.stringify(obj)
  };
}
function bad(msg, status = 400) { return j({ ok: false, error: msg }, status); }

// Helper to sanitize plain values
function clean(val, fallback = '') {
  if (val === undefined || val === null) return fallback;
  if (Array.isArray(val)) return val.length ? JSON.stringify(val) : fallback;
  if (typeof val === 'object') return Object.keys(val).length ? JSON.stringify(val) : fallback;
  return String(val).trim() || fallback;
}

// ✅ Safe JSON parser for legacy rows
function safeJSON(str, fallback) {
  try {
    if (!str) return fallback;
    const val = typeof str === 'string' ? JSON.parse(str) : str;
    return Array.isArray(val) ? val : fallback;
  } catch {
    // Wrap non-JSON strings like "D.Leydet" into ["D.Leydet"]
    return [String(str)];
  }
}

// ID generator
function genId(prefix = 'GAR') {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${rand}`;
}

export async function handler(event) {
  try {
    const method = event.httpMethod || 'GET';
    const qs = event.queryStringParameters || {};
    const adminHeader = event.headers['x-admin-key'] || event.headers['X-Admin-Key'] || '';
    const isAdmin = ADMIN_KEY ? adminHeader === ADMIN_KEY : true;

    if (method === 'OPTIONS') return j({}, 204);
    if (!DATABASE_URL) return bad('missing_env: DATABASE_URL', 500);

    // === GET: retrieve all GARs for a boat ===
    if (method === 'GET') {
      const boat = String(qs.boat || '').trim();
      if (!boat) return bad('missing boat');

      const rows = await sql`
        SELECT id, name, boat, date, time, shift, location, crew, overallrisk, overallgain,
               commanddecision, color, riskelements, submittedat
        FROM gar
        WHERE boat = ${boat}
        ORDER BY date DESC, time DESC;
      `;

      return j({
        ok: true,
        items: rows.map(r => ({
          id: r.id,
          name: r.name || '',
          boat: r.boat || '',
          date: r.date || '',
          time: r.time || '',
          shift: r.shift || '',
          location: r.location || '',
          crew: safeJSON(r.crew, []),
          overallRisk: r.overallrisk || '',
          overallGain: r.overallgain || '',
          commandDecision: r.commanddecision || '',
          color: r.color || '',
          riskElements: safeJSON(r.riskelements, {}),
          submittedAt: r.submittedat || ''
        })),
        meta: { count: rows.length }
      });
    }

    // === POST: create/update/delete ===
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
    const action = String(body.action || '').toLowerCase();

    // --- CREATE ---
    if (method === 'POST' && (!action || action === 'create')) {
      if (!body.name || !body.boat) return bad('missing name or boat');
      const now = new Date().toISOString();
      const id = genId();

      const name = clean(body.name);
      const boat = clean(body.boat);
      const date = clean(body.date);
      const time = clean(body.time);
      const shift = clean(body.shift);
      const location = clean(body.location);

      // ✅ Always store crew as valid JSON array
      const crew = Array.isArray(body.crew)
        ? JSON.stringify(body.crew)
        : (() => {
            if (!body.crew) return '[]';
            if (typeof body.crew === 'string') return JSON.stringify([body.crew]);
            return '[]';
          })();

      const overallRisk = clean(body.overallRisk);
      const overallGain = clean(body.overallGain);
      const commandDecision = clean(body.commandDecision);
      const color = clean(body.color);
      const riskElements = clean(body.riskElements, '{}');

      await sql`
        INSERT INTO gar (id, name, boat, date, time, shift, location, crew,
                         overallrisk, overallgain, commanddecision, color, riskelements, submittedat)
        VALUES (${id}, ${name}, ${boat}, ${date}, ${time}, ${shift}, ${location}, ${crew},
                ${overallRisk}, ${overallGain}, ${commandDecision}, ${color}, ${riskElements}, ${now});
      `;

      return j({ ok: true, saved: true, id });
    }

    // --- UPDATE (admin only) ---
    if (method === 'POST' && action === 'update') {
      if (!isAdmin) return bad('unauthorized', 401);
      if (!body.id) return bad('missing id');

      const fields = {
        location: clean(body.location),
        overallrisk: clean(body.overallRisk),
        overallgain: clean(body.overallGain),
        commanddecision: clean(body.commandDecision),
        color: clean(body.color)
      };

      await sql`
        UPDATE gar
        SET location = ${fields.location},
            overallrisk = ${fields.overallrisk},
            overallgain = ${fields.overallgain},
            commanddecision = ${fields.commanddecision},
            color = ${fields.color}
        WHERE id = ${body.id};
      `;

      return j({ ok: true, updated: true, id: body.id });
    }

    // --- DELETE (admin only) ---
    if (method === 'POST' && action === 'delete') {
      if (!isAdmin) return bad('unauthorized', 401);
      if (!body.id) return bad('missing id');

      await sql`DELETE FROM gar WHERE id = ${body.id};`;
      return j({ ok: true, deleted: true, id: body.id });
    }

    return bad('unknown_action_or_method', 400);
  } catch (err) {
    console.error('GAR function error:', err);
    return j({ ok: false, error: err.message }, 500);
  }
}
