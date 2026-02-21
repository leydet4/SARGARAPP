exports.handler = async function () {
  try {

    const STATIONS = {
      nws: {
        id: "KORF",
        name: "Norfolk International Airport (NWS KORF)"
      },
      buoy: {
        id: "44099",
        name: "Cape Henry, VA (NOAA Buoy 44099)"
      },
      tides: {
        id: "8638610",
        name: "Sewells Point, VA"
      }
    };

    const now = new Date();
    const nowEST = now.toLocaleString("en-US", {
      timeZone: "America/New_York"
    });

    // ------------------------------------------------
    // NWS OBSERVATION (Wind + Air Temp)
    // ------------------------------------------------
    const nwsRes = await fetch(
      `https://api.weather.gov/stations/${STATIONS.nws.id}/observations/latest`
    );

    const nwsJson = await nwsRes.json();

    const windSpeedMps = nwsJson.properties.windSpeed?.value;
    const windDirDeg = nwsJson.properties.windDirection?.value;
    const airTempC = nwsJson.properties.temperature?.value;
    const windGustMps = nwsJson.properties.windGust?.value;

    function mpsToKts(mps) {
      return mps ? Math.round(mps * 1.94384) : null;
    }

    function cToF(c) {
      return c ? Math.round((c * 9) / 5 + 32) : null;
    }

    const windData = {
      windSpeedKnots: mpsToKts(windSpeedMps),
      windDirDeg,
      windGustKnots: mpsToKts(windGustMps),
      airTempF: cToF(airTempC)
    };

    // ------------------------------------------------
    // NOAA BUOY (Waves + Water Temp)
    // ------------------------------------------------
    const buoyRes = await fetch(
      `https://www.ndbc.noaa.gov/data/realtime2/${STATIONS.buoy.id}.txt`
    );

    const buoyText = await buoyRes.text();

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

      function mToFt(m) {
        return m ? (m * 3.28084).toFixed(1) : null;
      }

      function cToF(c) {
        return c ? Math.round((c * 9) / 5 + 32) : null;
      }

      return {
        waveHeightFt: mToFt(num(row.WVHT)),
        dominantPeriodSec: num(row.DPD),
        waterTempF: cToF(num(row.WTMP))
      };
    }

    const buoyData = parseNDBC(buoyText);

    // ------------------------------------------------
    // TIDES (48hr Window)
    // ------------------------------------------------
    const end = new Date();
    const start = new Date(end.getTime() - 48 * 60 * 60 * 1000);

    function fmt(d) {
      const pad = (n) => String(n).padStart(2, "0");
      return (
        d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate())
      );
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

    // ------------------------------------------------
    return {
      statusCode: 200,
      body: JSON.stringify({
        serverTimeEST: nowEST,
        windData: {
          stationName: STATIONS.nws.name,
          ...windData
        },
        buoyData: {
          stationName: STATIONS.buoy.name,
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
