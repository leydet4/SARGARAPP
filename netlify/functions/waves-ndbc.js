// netlify/functions/waves-ndbc.js
// Fetch wave data from NDBC "realtime2" text files (server-side, no CORS).
// Primary: 44087 (Thimble Shoal)  | Fallback: 44072 (York Spit)
// Returns: { ok, source, updated, wave_ft, period_s, dir_deg?, reason? }

exports.handler = async () => {
  const stations = [
    { id: "44087", label: "NDBC 44087 (Thimble Shoal)" },
    { id: "44072", label: "NDBC 44072 (York Spit)" }
  ];

  // consider data fresh if <= 6 hours
  const isFresh = (d) => d && (Date.now() - d.getTime() <= 6 * 60 * 60 * 1000);

  async function getText(url, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } finally { clearTimeout(t); }
  }

  function parseRealtime2(txt) {
    // realtime2 format:
    // Header rows start with "#", first data row fields:
    // YYYY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE
    const line = txt.split(/\r?\n/).find(l => l && !l.startsWith("#"));
    if (!line) throw new Error("No data rows found");
    const p = line.trim().split(/\s+/);
    if (p.length < 17) throw new Error("Unexpected realtime2 format");

    const [YYYY, MM, DD, hh, mm] = p;
    const WVHT_m = p[8];
    const DPD_s  = p[9];
    const MWD_deg = p[12]; // mean wave direction (from), may be "MM"

    const iso = new Date(`${YYYY}-${MM}-${DD}T${hh}:${mm}:00Z`);
    const wave_m  = parseFloat(WVHT_m);
    const wave_ft = Number.isFinite(wave_m) ? wave_m * 3.28084 : null;

    const period  = parseFloat(DPD_s);
    const period_s = Number.isFinite(period) ? period : null;

    const dir     = parseFloat(MWD_deg);
    const dir_deg = Number.isFinite(dir) ? dir : null;

    return { updated: iso, wave_ft, period_s, dir_deg };
  }

  const reasons = [];

  for (const s of stations) {
    try {
      const url = `https://www.ndbc.noaa.gov/data/realtime2/${s.id}.txt`;
      const txt = await getText(url);
      const out = parseRealtime2(txt);

      if (isFresh(out.updated) && (out.wave_ft != null || out.period_s != null)) {
        return respond({ ok: true, source: s.label, ...out });
      }
      reasons.push(`${s.label}: stale or missing values`);
    } catch (e) {
      reasons.push(`${s.label}: ${e.message || "fetch failed"}`);
    }
  }

  return respond({ ok: false, reason: reasons.join(" • ") });
};

function respond(body) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
