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

exports.handler = async function () {

try {

// ======================
// TIDES (36 hour window)
// ======================
const tideUrl =
`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=POV_SAR&begin_date=today&range=36&datum=MLLW&station=8638610&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

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
// WEATHER KORF
// ======================
const weatherData = await getJSON(
"https://api.weather.gov/stations/KORF/observations/latest"
);

const props = weatherData.properties;

const airTempF = props.temperature?.value !== null
  ? cToF(props.temperature.value)
  : "N/A";

let windSpeedKnots = null;
let windDirDeg = null;
let windSource = null;

if (rawWindSpeed !== "MM" && rawWindDir !== "MM") {
  windSpeedKnots = mpsToKnots(rawWindSpeed);
  windDirDeg = rawWindDir;
  windSource = "NOAA Buoy 44099 — Chesapeake Bay Entrance (Near HRBT)";
}

if (!windSpeedKnots && props.windSpeed?.value !== null) {
  windSpeedKnots = mpsToKnots(props.windSpeed.value);
  windDirDeg = props.windDirection?.value?.toString() || "N/A";
  windSource = "NOAA Weather Station KORF — Norfolk Airport";
}

const buoyData = {
  waveHeightFt: rawWave !== "MM" ? metersToFeet(rawWave) : "N/A",
  dominantPeriodSec: rawPeriod !== "MM" ? rawPeriod : "N/A",
  waterTempF: rawWaterTemp !== "MM" ? cToF(rawWaterTemp) : "N/A",
  airTempF,
  windSpeedKnots: windSpeedKnots || "N/A",
  windDirDeg: windDirDeg || "N/A",
  windSource: windSource || "Unavailable",
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
