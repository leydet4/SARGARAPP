exports.handler = async function () {

try {

const headers = {
"User-Agent": "POV-SAR-Forum-2026"
};

// ===== Generate Today + Tomorrow =====
const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);

const formatDate = (d) =>
d.getFullYear().toString() +
String(d.getMonth() + 1).padStart(2, "0") +
String(d.getDate()).padStart(2, "0");

const beginDate = formatDate(today);
const endDate = formatDate(tomorrow);

// ===== Tide Predictions =====
const tideUrl =
`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=POV_SAR&begin_date=${beginDate}&end_date=${endDate}&datum=MLLW&station=8638610&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

const tideResponse = await fetch(tideUrl, { headers });

if (!tideResponse.ok) {
throw new Error(`Tide API failed: ${tideResponse.status}`);
}

const tideData = await tideResponse.json();

// ===== Water Level =====
const levelUrl =
`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&application=POV_SAR&date=latest&station=8638610&time_zone=lst_ldt&units=english&format=json`;

const levelResponse = await fetch(levelUrl, { headers });

if (!levelResponse.ok) {
throw new Error(`Water Level API failed: ${levelResponse.status}`);
}

const levelData = await levelResponse.json();

// ===== Weather (Norfolk Intl Airport) =====
const weatherResponse = await fetch(
"https://api.weather.gov/stations/KORF/observations/latest",
{ headers }
);

if (!weatherResponse.ok) {
throw new Error(`Weather API failed: ${weatherResponse.status}`);
}

const weatherData = await weatherResponse.json();

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
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
error: error.message
})
};

}

};
