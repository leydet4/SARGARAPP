exports.handler = async function () {
  try {

    const STATIONS = {
      marineWind: { id: "CHBV2", name: "Chesapeake Bay Bridge-Tunnel, VA" },
      buoy: { id: "44099", name: "Cape Henry, VA (NOAA Buoy 44099)" },
      nws: { id: "KORF", name: "Norfolk Intl Airport (NWS KORF)" },
      tides: { id: "8638610", name: "Sewells Point, VA" }
    };

    const now = new Date();
    const nowEST = now.toLocaleString("en-US", {
      timeZone: "America/New_York"
    });

    const num = (v) => {
      if (!v || v === "MM") return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    const msToKts = (ms) => ms ? Math.round(ms * 1.94384) : null;
    const mToFt = (m) => m ? (m * 3.28084).toFixed(1) : null;
    const cToF = (c) => c ? Math.round((c * 9) / 5 + 32) : null;

    function parseNDBC(text) {
      const lines = text.trim().split("\n");
      if (lines.length < 3) return null;

      const headers = lines[0].split(/\s+/);
      const values = lines[2].split(/\s+/);

      const row = {};
      headers.forEach((h, i) => row[h] = values[i]);

      return {
        windDirDeg: num(row.WDIR),
        windSpeedKnots: msToKts(num(row.WSPD)),
        windGustKnots: msToKts(num(row.GST)),
        waveHeightFt: mToFt(num(row.WVHT)),
        dominantPeriodSec: num(row.DPD),
        waterTempF: cToF(num(row.WTMP)),
        airTempF: cToF(num(row.ATMP))
      };
    }

    // ---------------- MARINE WIND (CHBV2)
    let windData = null;
    let airTempFallback = null;

    try {
      const marineRes = await fetch(
        `https://www.ndbc.noaa.gov/data/realtime2/${STATIONS.marineWind.id}.txt`
      );
      const marineText = await marineRes.text();
      const marineParsed = parseNDBC(marineText);

      if (marineParsed && marineParsed.windSpeedKnots != null) {
        windData = {
          stationName: STATIONS.marineWind.name,
          windSpeedKnots: marineParsed.windSpeedKnots,
          windDirDeg: marineParsed.windDirDeg,
          windGustKnots: marineParsed.windGustKnots
        };

        airTempFallback = marineParsed.airTempF;
      }
    } catch {}

    // ---------------- BUOY (44099)
    const buoyRes = await fetch(
      `https://www.ndbc.noaa.gov/data/realtime2/${STATIONS.buoy.id}.txt`
    );
    const buoyText = await buoyRes.text();
    const buoyParsed = parseNDBC(buoyText) || {};

    if (!airTempFallback && buoyParsed.airTempF) {
      airTempFallback = buoyParsed.airTempF;
    }

    // ---------------- NWS FALLBACK FOR AIR TEMP
    if (!airTempFallback) {
      const nwsRes = await fetch(
        `https://api.weather.gov/stations/${STATIONS.nws.id}/observations/latest`,
        { headers: { "User-Agent": "POV-SAR-Forum-2026" } }
      );
      const nwsJson = await nwsRes.json();

      const tempC = nwsJson.properties?.temperature?.value ?? null;
      airTempFallback = tempC ? cToF(tempC) : null;
    }

    // ---------------- TIDES
    const end = new Date();
    const start = new Date(end.getTime() - 48 * 60 * 60 * 1000);

    function fmt(d) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    }

    const tideRes = await fetch(
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
      `&format=json`
    );

    const tideData = await tideRes.json();

    // ---------------- RESPONSE
    return {
      statusCode: 200,
      body: JSON.stringify({
        serverTimeEST: nowEST,
        windData,
        buoyData: {
          stationName: STATIONS.buoy.name,
          waveHeightFt: buoyParsed.waveHeightFt,
          dominantPeriodSec: buoyParsed.dominantPeriodSec,
          waterTempF: buoyParsed.waterTempF,
          airTempF: airTempFallback
        },
        tideStationName: STATIONS.tides.name,
        tideData
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.toString() })
    };
  }
};
