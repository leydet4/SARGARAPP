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

exports.handler = async function () {

try {

// ===== TIDES (Sewells Point 8638610) =====
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

// ===== BUOY TEXT DATA (44099) =====
const buoyText = await getText(
"https://www.ndbc.noaa.gov/data/realtime2/44099.txt"
);

const lines = buoyText.split("\n").filter(l => l.trim() !== "");

// Line 0 = headers
// Line 1 = units
// Line 2 = latest observation

const header = lines[0].trim().split(/\s+/);
const latest = lines[2].trim().split(/\s+/);

const col = (name) => header.indexOf(name);

const buoyData = {
waveHeight: latest[col("WVHT")],
dominantPeriod: latest[col("DPD")],
waterTemp: latest[col("WTMP")],
windSpeed: latest[col("WSPD")],
windDir: latest[col("WDIR")]
};


// Column positions
const col = (name) => header.indexOf(name);

const buoyData = {
waveHeight: latest[col("WVHT")],
dominantPeriod: latest[col("DPD")],
waterTemp: latest[col("WTMP")],
windSpeed: latest[col("WSPD")],
windDir: latest[col("WDIR")]
};

return {
statusCode: 200,
headers: {
"Access-Control-Allow-Origin": "*",
"Content-Type": "application/json"
},
body: JSON.stringify({
tideStation: "NOAA 8638610 Sewells Point",
buoyStation: "NOAA Buoy 44099 Chesapeake Bay Entrance",
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
