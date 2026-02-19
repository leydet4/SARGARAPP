// netlify/functions/erddap-waves.js
// Robust server-side wave fetch for HRBT area.
// Tries multiple ERDDAP datasets in order:
//
// 1) CDIP 240 (Thimble Shoal): edu_ucsd_cdip_240
// 2) NDBC 44087 (station dataset): gov-ndbc-44087
// 3) NDBC standard met: ndbcStdMet?station="44087"
// 4) CBIBS York Spit 44072 (station dataset): gov-ndbc-44072
// 5) NDBC standard met: ndbcStdMet?station="44072"
//
// Returns JSON:
// { ok, source, updated, wave_ft, period_s, dir_deg, reason? }

exports.handler = async () => {
  const HOSTS = [
    "https://erddap.sensors.ioos.us/erddap",
    "https://erddap.ioos.us/erddap"
  ];

  // “fresh” if <= 6 hours old
  const isFresh = (d) => d && (Date.now() - d.getTime() <= 6 * 60 * 60 * 1000);

  async function getJSON(url, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { "Accept": "application/json" }});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  // Normalize a row into {updated, wave_ft, period_s, dir_deg}
  function normalizeFromColumns(cols, row, map) {
    const ix = {};
    for (const k in map) ix[k] = cols.indexOf(map[k]); // may be -1
    const val = (k) => (ix[k] >= 0 ? row[ix[k]] : null);

    const time = val("time");
    const updated = time ? new Date(time) : null;

    let wave_m = val("height");
    if (wave_m != null) wave_m = parseFloat(wave_m);
    const wave_ft = (wave_m != null && isFinite(wave_m)) ? wave_m * 3.28084 : null;

    let period_s = val("period");
    if (period_s != null) period_s = parseFloat(period_s);
    if (period_s != null && !isFinite(period_s)) period_s = null;

    let dir_deg = val("direction");
    if (dir_deg != null) dir_deg = parseFloat(dir_deg);
    if (dir_deg != null && !isFinite(dir_deg)) dir_deg = null;

    return { updated, wave_ft, period_s, dir_deg };
  }

  async function tryDatasetSequence(seq) {
    let lastReason = null;

    for (const step of seq) {
      for (const host of HOSTS) {
        try {
          const url = host + step.path + step.qs;
          const j = await getJSON(url);
          const table = j?.table;
          const cols = table?.columnNames || [];
          const rows = table?.rows || [];
          if (!cols.length || !rows.length) { lastReason = "No rows"; continue; }

          const row = rows[0];
          const normalized = normalizeFromColumns(cols, row, step.map);
          if (isFresh(normalized.updated) && (normalized.wave_ft != null || normalized.period_s != null)) {
            return { ok: true, source: step.label, ...normalized };
          }
          lastReason = `${step.label}: stale or missing values`;
        } catch (e) {
          lastReason = `${step.label}: ${e.message || "fetch failed"}`;
        }
      }
    }
    return { ok: false, reason: lastReason || "All sources unavailable" };
  }

  // Build the 5-step sequence
  const seq = [
    // 1) CDIP 240 (Thimble Shoal)
    {
      label: "CDIP 240 (Thimble Shoal)",
      path: "/tabledap/edu_ucsd_cdip_240.json",
      qs: "?time,sea_surface_wave_significant_height,sea_surface_wave_period_at_variance_spectral_density_maximum,sea_surface_wave_from_direction&orderByMax(%22time%22)",
      map: {
        time: "time",
        height: "sea_surface_wave_significant_height",
        period: "sea_surface_wave_period_at_variance_spectral_density_maximum",
        direction: "sea_surface_wave_from_direction"
      }
    },
    // 2) NDBC 44087 station dataset
    {
      label: "NDBC 44087 (station dataset)",
      path: "/tabledap/gov-ndbc-44087.json",
      qs: "?time,sea_surface_wave_significant_height,sea_surface_wave_period_at_variance_spectral_density_maximum,sea_surface_wave_from_direction&orderByMax(%22time%22)",
      map: {
        time: "time",
        height: "sea_surface_wave_significant_height",
        period: "sea_surface_wave_period_at_variance_spectral_density_maximum",
        direction: "sea_surface_wave_from_direction"
      }
    },
    // 3) ndbcStdMet filtered to 44087
    {
      label: "ndbcStdMet 44087",
      path: "/tabledap/ndbcStdMet.json",
      qs: "?station%2Ctime%2CWVHT%2CDPD%2CMWD&station=%2244087%22&orderByMax(%22time%22)",
      map: { time: "time", height: "WVHT", period: "DPD", direction: "MWD" }
    },
    // 4) NDBC 44072 station dataset (York Spit)
    {
      label: "NDBC 44072 (York Spit station dataset)",
      path: "/tabledap/gov-ndbc-44072.json",
      qs: "?time,sea_surface_wave_significant_height,sea_surface_wave_period_at_variance_spectral_density_maximum,sea_surface_wave_from_direction&orderByMax(%22time%22)",
      map: {
        time: "time",
        height: "sea_surface_wave_significant_height",
        period: "sea_surface_wave_period_at_variance_spectral_density_maximum",
        direction: "sea_surface_wave_from_direction"
      }
    },
    // 5) ndbcStdMet filtered to 44072
    {
      label: "ndbcStdMet 44072",
      path: "/tabledap/ndbcStdMet.json",
      qs: "?station%2Ctime%2CWVHT%2CDPD%2CMWD&station=%2244072%22&orderByMax(%22time%22)",
      map: { time: "time", height: "WVHT", period: "DPD", direction: "MWD" }
    }
  ];

  const result = await tryDatasetSequence(seq);
  return respond(result);
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
