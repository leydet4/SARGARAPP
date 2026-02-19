const https = require("https");

function getText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "POV-SAR-Forum-2026" }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.end();
  });
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "POV-SAR-Forum-2026" }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject("Invalid JSON from " + url);
        }
      });
    });
    req.on("error", reject);
    req.end();
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

exports.handler = async function () {

try {

// ======================
// TIDES (8638610)
// ======================
const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);

const formatDate = (d) =>
d.getFullYear().toString() +
String(d.getMonth() + 1).padStart(2, "0") +
String(d.getDate()).padStart(2, "0");

const beginDate = formatDate(today);
const endDate = formatDate(tomorrow);

const tideUrl =
`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=POV_SAR&begin_date=${beginDate}&end_date=${endDate}&datum=MLLW&station=8638610&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

const tideData = await getJSON(tideUrl);

// ======================
// BUOY (44099)
// ======================
const buoyText = await getText(
"https://www.ndbc.noaa.gov/data/realtime2/44099.txt"
);

const lines = buoyText.split("\n").filter(l => l.trim() !== "");

if (lines.length < 3) {
  throw new Error("Buoy data format unexpected");
}

const header = lines[0].trim().split(/\s+/);
const latest = lines[2].trim().split(/\s+/);

const col = (name) => header.indexOf(name);

const rawWave = latest[col("WVHT")];
const rawPeriod = latest[col("DPD")];
const rawWaterTemp = latest[col("WTMP")];
const rawWindSpeed = latest[col("WSPD")];
const rawWindDir = latest[col("WDIR")];

let windSpeedKnots = null;
let windDirDeg = null;
let windSource = null;

// ======================
// PRIMARY WIND (BUOY)
// ======================
if (rawWindSpeed !== "MM" && rawWindDir !== "MM") {
  windSpeedKnots = mpsToKnots(rawWindSpeed);
  windDirDeg = rawWindDir;
  windSource = "NOAA NDBC Buoy 44099";
}

// ======================
// FALLBACK WIND (KORF)
// ======================
if (!windSpeedKnots) {

  const weatherData = await getJSON(
    "https://api.weather.gov/stations/KORF/observations/latest"
  );

  const props = weatherData.properties;

  if (props.windSpeed?.value !== null && props.windDirection?.value !== null) {
    windSpeedKnots = mpsToKnots(props.windSpeed.value);
    windDirDeg = props.windDirection.value.toString();
    windSource = "NOAA Weather Station KORF (Norfolk)";
  }
}

// ======================
// BUILD RESPONSE
// ======================
const buoyData = {
waveHeightFt: rawWave !== "MM" ? metersToFeet(rawWave) : "N/A",
dominantPeriodSec: rawPeriod !== "MM" ? rawPeriod : "N/A",
waterTempF: rawWaterTemp !== "MM" ? cToF(rawWaterTemp) : "N/A",
windSpeedKnots: windSpeedKnots || "N/A",
windDirDeg: windDirDeg || "N/A",
windSource: windSource || "Unavailable"
};

return {
statusCode: 200,
headers: {
"Access-Control-Allow-Origin": "*",
"Content-Type": "application/json"
},
body: JSON.stringify({
tideStation: "NOAA CO-OPS 8638610 Sewells Point",
buoyStation: "NOAA NDBC Buoy 44099 Chesapeake Bay Entrance",
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
