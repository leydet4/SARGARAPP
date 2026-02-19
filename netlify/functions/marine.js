exports.handler = async function () {

try {

const headers = {
"User-Agent": "POV-SAR-Forum-2026 (operations dashboard)"
};

// ===== Tide Predictions =====
const tideResponse = await fetch(
"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=web&begin_date=today&range=36&datum=MLLW&station=8638610&time_zone=lst_ldt&units=english&interval=hilo&format=json",
{ headers }
);

if (!tideResponse.ok) {
throw new Error("Tide API failed");
}

const tideData = await tideResponse.json();

// ===== Water Level =====
const levelResponse = await fetch(
"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&application=web&date=latest&station=8638610&time_zone=lst_ldt&units=english&format=json",
{ headers }
);

if (!levelResponse.ok) {
throw new Error("Water Level API failed");
}

const levelData = await levelResponse.json();

// ===== Weather =====
const weatherResponse = await fetch(
"https://api.weather.gov/stations/KORF/observations/latest",
{ headers }
);

if (!weatherResponse.ok) {
throw new Error("Weather API failed");
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
