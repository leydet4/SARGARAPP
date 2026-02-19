const https = require("https");

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

const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);

const formatDate = (d) =>
d.getFullYear().toString() +
String(d.getMonth() + 1).padStart(2, "0") +
String(d.getDate()).padStart(2, "0");

const beginDate = formatDate(today);
const endDate = formatDate(tomorrow);

// Tide predictions
const tideUrl =
`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=POV_SAR&begin_date=${beginDate}&end_date=${endDate}&datum=MLLW&station=8638610&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

// Chesapeake Bay Entrance Buoy 44099
const buoyUrl =
"https://www.ndbc.noaa.gov/data/realtime2/44099.json";

const tideData = await getJSON(tideUrl);
const buoyData = await getJSON(buoyUrl);

return {
statusCode: 200,
headers: {
"Access-Control-Allow-Origin": "*",
"Content-Type": "application/json"
},
body: JSON.stringify({
tideData,
buoyData
})
};

} catch (error) {
return {
statusCode: 500,
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ error: error.toString() })
};
}

};
