exports.handler = async function () {
  try {

    const STATIONS = {
      wind: { id: "CHBV2", name: "Chesapeake Bay Bridge-Tunnel, VA" },
      waves: { id: "44099", name: "Cape Henry, VA" },
      tides: { id: "8638610", name: "Sewells Point, VA" }
    };

    const nowEST = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York"
    });

    // -------- Parse NDBC Text --------
    function parseNDBC(text) {
      const lines = text.trim().split("\n");
      if (lines.length < 3) return null;

      const headers = lines[0].split(/\s+/);
      const values = lines[2].split(/\s+/);

      const row = {};
      headers.forEach((h, i) => row[h] = values[i]);

      function num(v) {
        if (!v || v === "MM") return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      }

      function msToKts(ms) {
        return ms ? Math.round(ms * 1.94384) : null;
      }

      function mToFt(m) {
        return m ? (m * 3.28084).toFixed(1) : null;
      }

      function cToF(c) {
        return c ? Math.round((c * 9) / 5 + 32) : null;
      }

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

    // -------- Fetch Wind (HRBT) --------
    const windRes = await fetch(
      `https://www.ndbc.noaa.gov/data/realtime2/${STATIONS.wind.id}.txt`
    );
    const windText = await windRes.text();
    const windData = parseNDBC(windText);

    // -------- Fetch Waves --------
    const wavesRes = await fetch(
      `https://www.ndbc.noaa.gov/data/realtime2/${STATIONS.waves.id}.txt`
    );
    const wavesText = await wavesRes.text();
    const buoyData = parseNDBC(wavesText);

    // -------- Fetch Tides --------
    const tideRes = await fetch(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&station=${STATIONS.tides.id}&datum=MLLW&interval=hilo&units=english&time_zone=lst_ldt&format=json`
    );
    const tideData = await tideRes.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        serverTimeEST: nowEST,
        windData: {
          stationName: STATIONS.wind.name,
          ...windData
        },
        buoyData: {
          stationName: STATIONS.waves.name,
          ...buoyData
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
