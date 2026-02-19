// helpers.js (robust v3) — no MDAPI, infer capabilities via real fetches

// Generic fetch with timeout & JSON parsing
async function getJSON(url, { timeoutMs = 10000 } = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(id);
  }
}

// Simple retry wrapper for transient errors
async function withRetry(fn, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; await new Promise(res => setTimeout(res, 400 + i * 400)); }
  }
  throw lastErr;
}

function dirToCardinal(deg) {
  if (deg === null || deg === undefined) return 'N/A';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/* --- Product fetchers (capability inferred) ---
   We call the CO-OPS datagetter endpoints directly.
   If station doesn't provide it, CO-OPS usually returns an empty array or a 4xx.
   We convert that into { data: null, reason: '...' } with a human message.
*/

async function fetchWaterTemp(stationId) {
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_temperature&application=NOS.COOPS.TAC.MET&station=${stationId}&time_zone=lst_ldt&units=english&format=json&date=latest`;
  try {
    const data = await withRetry(() => getJSON(url));
    const d = data?.data?.[0];
    if (!d) return { data: null, reason: 'No water temperature returned (station may not provide it or no recent obs).' };
    if (d.v == null) return { data: null, reason: 'No recent water temperature observation.' };
    return { data: { value: parseFloat(d.v), time: d.t }, reason: null };
  } catch (e) {
    return { data: null, reason: 'Water temperature API error.' };
  }
}

async function fetchWind(stationId) {
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=wind&application=NOS.COOPS.TAC.MET&station=${stationId}&time_zone=lst_ldt&units=english&format=json&date=latest`;
  try {
    const data = await withRetry(() => getJSON(url));
    const d = data?.data?.[0];
    if (!d) return { data: null, reason: 'No wind data returned (station may not provide it or no recent obs).' };
    const mph = d.s ? parseFloat(d.s) * 1.15078 : null; // knots → mph
    return { data: { speed_mph: mph, dir_deg: d.d ?? null, time: d.t }, reason: null };
  } catch (e) {
    return { data: null, reason: 'Wind API error.' };
  }
}

async function fetchAirTempKORF() {
  const url = 'https://api.weather.gov/stations/KORF/observations/latest';
  try {
    const data = await withRetry(() => getJSON(url));
    const c = data?.properties?.temperature?.value;
    if (c == null) return { data: null, reason: 'No recent air temperature observation.' };
    return { data: { value: c * 9 / 5 + 32, time: data?.properties?.timestamp || null }, reason: null };
  } catch (e) {
    return { data: null, reason: 'Air temperature API error.' };
  }
}

async function fetchTidePredictions(stationId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const begin = `${y}${m}${d}`;
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=NOS.COOPS.TAC.WL&station=${stationId}&datum=MLLW&time_zone=lst_ldt&units=english&interval=hilo&format=json&begin_date=${begin}&range=48`;
  try {
    const data = await withRetry(() => getJSON(url));
    const preds = data?.predictions || [];
    if (!preds.length) return { data: [], reason: 'No tide predictions returned (station may not provide predictions).' };
    return { data: preds, reason: null };
  } catch (e) {
    return { data: [], reason: 'Tide predictions API error.' };
  }
}
