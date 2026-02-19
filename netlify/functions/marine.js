const https = require("https");

function getText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "POV-SAR-Forum-2026" } }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "POV-SAR-Forum-2026" } }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject("Invalid JSON from " + url);
        }
      });
    }).on("error", reject);
  });
}

function metersToFeet(m) {
  return (parseFloat(m) * 3.28084).toFixed(1);
}

function mpsToKnots(ms) {
  return (parseFloat(ms) * 1.94384).toFixed(1);
}

function cToF(c) {
  return ((parseFloat(c) * 9/5) + 32).toFixed(1);
}

function formatEastern(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function todayYYYYMMDD() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

exports.handler = async function () {

try {

// ======================
// TIDES
// ======================
const beginDate = todayYYYYMMDD();

const tideUrl =
`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=POV_SAR&begin_date=${beginDate}&range=36&datum=MLLW&station=8638610&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

const tideData = await getJSON(tideUrl);

// ======================
// BUOY 44099
// ======================
const buoyText = await getText(
"https://www.ndbc.noaa.gov/data/realtime2/44099.txt"
);

const lines = buoyText.split("\n").filter(l => l.trim() !== "");
const header = lines[0].trim().split(/\s+/);
const latest = lines[2].trim().split(/\s+/);

const col = name => header.indexOf(name);

const rawWave = latest[col("WVHT")];
const rawPeriod = latest[col("DPD")];
const rawWaterTemp = latest[col("WTMP")];
const rawWindSpeed = latest[col("WSPD")];
const rawWindDir = latest[col("WDIR")];

const utcDate = new Date(Date.UTC(
  latest[0], latest[1] - 1, latest[2], latest[3], latest[4]
));

const easternObservation = formatEastern(utcDate);

// ======================
// WEATHER KORF (PRIMARY)
// ======================
const latestWeather = await getJSON(
"https://api.weather.gov/stations/KORF/observations/latest"
);

const weatherProps = latestWeather.properties;

const airTempF = weatherProps.temperature?.value !== null
  ? cToF(weatherProps.temperature.value)
  : "N/A";

// ======================
// WIND FALLBACK LOGIC
// ======================

let windSpeedKnots = null;
let windDirDeg = null;
let windSource = null;

function validWind(speed) {
  return speed !== null && !isNaN(speed) && speed > 1;
}

// 1️⃣ Buoy
if (rawWindSpeed !== "MM" && rawWindDir !== "MM") {
  const buoyKnots = parseFloat(mpsToKnots(rawWindSpeed));
  if (validWind(buoyKnots)) {
    windSpeedKnots = buoyKnots.toFixed(1);
    windDirDeg = rawWindDir;
    windSource = "NOAA Buoy 44099 — Chesapeake Bay Entrance (Near HRBT)";
  }
}

// 2️⃣ KORF latest
if (!windSpeedKnots && weatherProps.windSpeed?.value !== null) {
  const korfKnots = parseFloat(mpsToKnots(weatherProps.windSpeed.value));
  if (validWind(korfKnots)) {
    windSpeedKnots = korfKnots.toFixed(1);
    windDirDeg = weatherProps.windDirection?.value?.toString() || "N/A";
    windSource = "NOAA Weather Station KORF — Norfolk Airport";
  }
}

// 3️⃣ KORF recent observations (backup sweep)
if (!windSpeedKnots) {
  const recent = await getJSON(
    "https://api.weather.gov/stations/KORF/observations?limit=5"
  );

  for (let obs of recent.features) {
    const props = obs.properties;
    if (props.windSpeed?.value !== null) {
      const knots = parseFloat(mpsToKnots(props.windSpeed.value));
      if (validWind(knots)) {
        windSpeedKnots = knots.toFixed(1);
        windDirDeg = props.windDirection?.value?.toString() || "N/A";
        windSource = "NOAA Weather Station KORF — Recent Observation";
        break;
      }
    }
  }
}

if (!windSpeedKnots) {
  windSpeedKnots = "Calm / Unavailable";
  windDirDeg = "N/A";
  windSource = "NOAA Data Unavailable";
}

const buoyData = {
  waveHeightFt: rawWave !== "MM" ? metersToFeet(rawWave) : "N/A",
  dominantPeriodSec: rawPeriod !== "MM" ? rawPeriod : "N/A",
  waterTempF: rawWaterTemp !== "MM" ? cToF(rawWaterTemp) : "N/A",
  airTempF,
  windSpeedKnots,
  windDirDeg,
  windSource,
  buoyObservationTimeEST: easternObservation
};

return {
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    serverTimeEST: formatEastern(new Date()),
    tideData,
    buoyData
  })
};

} catch (error) {

return {
  statusCode: 500,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    error: error.toString()
  })
};

}

};
