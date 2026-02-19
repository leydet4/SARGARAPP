// netlify/functions/ndbc.js
// Proxy NDBC realtime2 -> JSON (wave height & dominant period)
// Usage: /.netlify/functions/ndbc?station=CHLV2

exports.handler = async (event) => {
  const station = (event.queryStringParameters?.station || "CHLV2").toUpperCase();
  const url = `https://www.ndbc.noaa.gov/data/realtime2/${station}.txt`;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return json({ error: `Upstream HTTP ${res.status}` }, res.status);
    }

    const txt = await res.text();
    const line = txt.split(/\r?\n/).find(l => l && !l.startsWith("#"));
    if (!line) return ok({ station, error: "No data rows found" });

    // realtime2 columns:
    // YYYY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE
    const p = line.trim().split(/\s+/);
    if (p.length < 17) return ok({ station, error: "Unexpected NDBC format" });

    const [YYYY, MM, DD, hh, mm] = p;
    const WVHT_m = p[8];
    const DPD_s  = p[9];

    const iso = new Date(`${YYYY}-${MM}-${DD}T${hh}:${mm}:00Z`).toISOString();
    const wave_m  = parseFloat(WVHT_m);
    const wave_ft = Number.isFinite(wave_m) ? wave_m * 3.28084 : null;
    const period  = parseFloat(DPD_s);
    const period_s = Number.isFinite(period) ? period : null;

    return ok({ station, updated: iso, wave_ft, period_s });
  } catch (e) {
    return json({ error: "Fetch failed (timeout/CORS/network)", details: String(e) }, 502);
  }
};

function ok(body) {
  return {
    statusCode: 200,
    headers: cors(),
    body: JSON.stringify(body)
  };
}
function json(body, status = 200) {
  return {
    statusCode: status,
    headers: cors(),
    body: JSON.stringify(body)
  };
}
function cors() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  };
}
