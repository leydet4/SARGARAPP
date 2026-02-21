exports.handler = async function () {
  try {
    const STATIONS = {
      marineWind: { id: "CHBV2", name: "Chesapeake Bay Bridge-Tunnel, VA" }, // Marine wind near HRBT
      nwsFallback: { id: "KORF", name: "Norfolk Intl Airport (NWS KORF)" },  // Land fallback
      buoy: { id: "44099", name: "Cape Henry, VA (NOAA Buoy 44099)" },       // Waves + water temp
      tides: { id: "8638610", name: "Sewells Point, VA" }                   // Tides
    };

    const now = new Date();
    const nowEST = now.toLocaleString("en-US", { timeZone: "America/New_York" });

    // -----------------------------
    // Helpers
    // -----------------------------
    const num = (v) => {
      if (v === undefined || v === null) return null;
      if (v === "MM") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const msToKts = (ms) => (ms == null ? null : Math.round(ms * 1.943844));
    const kmhToKts = (kmh) => (kmh == null ? null : Math.round(kmh * 0.539957));
    const mphToKts = (mph) => (mph == null ? null : Math.round(mph * 0.868976));
    const cToF = (c) => (c == null ? null : Math.round((c * 9) / 5 + 32));
    const mToFt = (m) => (m == null ? null : +(m * 3.28084).toFixed(1));

    function convertToKnots(value, unitCode) {
      if (value == null) return null;
      // unitCode examples from api.weather.gov: "unit:m_s-1", "unit:km_h-1", "unit:mi_h-1"
      if (!unitCode) return msToKts(value); // safe default for NWS

      if (unitCode.includes("m_s-1")) return msToKts(value);
      if (unitCode.includes("km_h-1")) return kmhToKts(value);
      if (unitCode.includes("mi_h-1")) return mphToKts(value);

      // If it ever comes in knots already (rare), just round
      if (unitCode.includes("kn")) return Math.round(value);

      // Unknown: default to m/s conversion (better than nothing)
      return msToKts(value);
    }

    // NDBC realtime2 text file parser (wind/waves)
    function parseNDBCRealtime2(text) {
      const lines = text.trim().split("\n").filter(Boolean);
      if (lines.length < 3) return null;

      const headers = lines[0].trim().split(/\s+/);
      const values = lines[2].trim().split(/\s+/);

      const row = {};
      headers.forEach((h, i) => (row[h] = values[i]));

      const wdir = num(row.WDIR);
      const wspd_ms = num(row.WSPD);
      const gst_ms = num(row.GST);
      const wvht_m = num(row.WVHT);
      const dpd_s = num(row.DPD);
      const wtmp_c = num(row.WTMP);
      const atmp_c = num(row.ATMP);

      return {
        windDirDeg: wdir,
        windSpeedKnots: wspd_ms == null ? null : Math.round(wspd_ms * 1.943844),
        windGustKnots: gst_ms == null ? null : Math.round(gst_ms * 1.943844),
        waveHeightFt: wvht_m == null ? null : mToFt(wvht_m),
        dominantPeriodSec: dpd_s,
        waterTempF: wtmp_c == null ? null : cToF(wtmp_c),
        airTempF: atmp_c == null ? null : cToF(atmp_c)
      };
    }

    // METAR parser fallback (wind group like 18012G18KT)
    function parseMetarWind(raw) {
      if (!raw) return null;
      const m = raw.match(/\b(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT\b/);
      if (!m) return null;
      const dir = m[1] === "VRB" ? null : Number(m[1]);
      const spd = Number(m[2]);
      const gst = m[4] ? Number(m[4]) : null;
      return {
        windDirDeg: Number.isFinite(dir) ? dir : null,
        windSpeedKnots: Number.isFinite(spd) ? spd : null,
        windGustKnots: Number.isFinite(gst) ? gst : null
      };
    }

    // -----------------------------
    // 1) Marine wind near HRBT (CHBV2)
    // -----------------------------
    let windData = null;
    let windSourceName = STATIONS.marineWind.name;

    try {
      const marineWindRes = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${STATIONS.marineWind.id}.txt`);
      const marineWindTxt = await marineWindRes.text();
      const parsed = parseNDBCRealtime2(marineWindTxt);

      // Use CHBV2 wind if it has a valid speed
      if (parsed && parsed.windSpeedKnots != null) {
        windData = {
          stationName: STATIONS.marineWind.name,
          windSpeedKnots: parsed.windSpeedKnots,
          windDirDeg: parsed.windDirDeg,
          windGustKnots: parsed.windGustKnots,
          airTempF: parsed.airTempF ?? null
        };
      }
    } catch (_) {
      // ignore; fall back to NWS below
    }

    // -----------------------------
    // 2) NWS fallback wind + air temp (KORF)
    // -----------------------------
    if (!windData) {
      windSourceName = STATIONS.nwsFallback.name;

      const nwsRes = await fetch(`https://api.weather.gov/stations/${STATIONS.nwsFallback.id}/observations/latest`, {
        headers: { "User-Agent": "POV-SAR-Forum-2026 (Netlify Function)" }
      });
      const nwsJson = await nwsRes.json();
      const p = nwsJson?.properties || {};

      const wsVal = p.windSpeed?.value ?? null;
      const wsUnit = p.windSpeed?.unitCode ?? null;

      const wgVal = p.windGust?.value ?? null;
      const wgUnit = p.windGust?.unitCode ?? null;

      const wd = p.windDirection?.value ?? null;

      const tempC = p.temperature?.value ?? null;

      // Convert carefully based on unitCode
      let wsKts = convertToKnots(wsVal, wsUnit);
      let wgKts = convertToKnots(wgVal, wgUnit);

      // METAR fallback if missing OR looks suspiciously high
      // (you can tighten/loosen this threshold)
      const metarWind = parseMetarWind(p.rawMessage);

      if (wsKts == null || wsKts > 60) {
        if (metarWind?.windSpeedKnots != null) wsKts = metarWind.windSpeedKnots;
        if (metarWind?.windGustKnots != null) wgKts = metarWind.windGustKnots;
      }

      const windDir = (wd != null) ? wd : (metarWind?.windDirDeg ?? null);

      windData = {
        stationName: STATIONS.nwsFallback.name,
        windSpeedKnots: wsKts,
        windDirDeg: windDir,
        windGustKnots: wgKts,
        airTempF: tempC == null ? null : cToF(tempC)
      };
    }

    // -----------------------------
    // Buoy (waves + water temp) — 44099 Cape Henry
    // -----------------------------
    const buoyRes = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${STATIONS.buoy.id}.txt`);
    const buoyTxt = await buoyRes.text();
    const buoyParsed = parseNDBCRealtime2(buoyTxt) || {};

    // Air temp preference:
    // 1) CHBV2/NWS wind station air temp
    // 2) Buoy air temp (if present)
    const airTempF = windData?.airTempF ?? buoyParsed.airTempF ?? null;

    // -----------------------------
    // Tides (48hr range) — Sewells Point
    // -----------------------------
    const end = new Date();
    const start = new Date(end.getTime() - 48 * 60 * 60 * 1000);

    function fmt(d) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    }

    const tideUrl =
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
      `product=predictions` +
      `&application=POV_SAR` +
      `&begin_date=${fmt(start)}` +
      `&end_date=${fmt(end)}` +
      `&datum=MLLW` +
      `&station=${STATIONS.tides.id}` +
      `&time_zone=lst_ldt` +
      `&units=english` +
      `&interval=hilo` +
      `&format=json`;

    const tideRes = await fetch(tideUrl);
    const tideData = await tideRes.json();

    // -----------------------------
    // Response (keep the same keys your frontend uses)
    // -----------------------------
    return {
      statusCode: 200,
      body: JSON.stringify({
        serverTimeEST: nowEST,

        // Wind near HRBT (marine first, NWS fallback)
        windData: {
          stationName: windData.stationName,
          windSpeedKnots: windData.windSpeedKnots,
          windDirDeg: windData.windDirDeg,
          windGustKnots: windData.windGustKnots
        },

        // Buoy data (waves/water + air fallback)
        buoyData: {
          stationName: STATIONS.buoy.name,
          waveHeightFt: buoyParsed.waveHeightFt,
          dominantPeriodSec: buoyParsed.dominantPeriodSec,
          waterTempF: buoyParsed.waterTempF,
          airTempF
        },

        tideStationName: STATIONS.tides.name,
        tideData
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) })
    };
  }
};
