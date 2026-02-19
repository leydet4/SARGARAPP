exports.handler = async function() {

try {

const tide = await fetch(
"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=web&begin_date=today&range=36&datum=MLLW&station=8638610&time_zone=lst_ldt&units=english&interval=hilo&format=json"
);

const tideData = await tide.json();

const level = await fetch(
"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&application=web&date=latest&station=8638610&time_zone=lst_ldt&units=english&format=json"
);

const levelData = await level.json();

const weather = await fetch(
"https://api.weather.gov/stations/KORF/observations/latest"
);

const weatherData = await weather.json();

return {
statusCode: 200,
headers: {
"Access-Control-Allow-Origin": "*"
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
body: JSON.stringify({ error: error.toString() })
};
}

};
