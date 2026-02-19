const https = require("https");

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "POV-SAR-Forum-2026"
      }
    }, (res) => {
      let data = "";

      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
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

    const tideUrl =
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=POV_SAR&begin_date=${beginDate}&end_date=${endDate}&datum=MLLW&station=8638610&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

    const levelUrl =
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&application=POV_SAR&date=latest&station=8638610&time_zone=lst_ldt&units=english&format=json`;

    const weatherUrl =
      "https://api.weather.gov/stations/KORF/observations/latest";

    const tideData = await getJSON(tideUrl);
    const levelData = await getJSON(levelUrl);
    const weatherData = await getJSON(weatherUrl);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tideData,
        levelData,
        weatherData
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
