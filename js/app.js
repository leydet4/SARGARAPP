fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${config.stations.primary}&product=water_level&datum=MLLW&time_zone=lst_ldt&units=english&format=json`)
.then(res => res.json())
.then(data => {
  document.getElementById("waterLevel").innerHTML =
    data.data[0].v + " ft";
});

fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=today&station=${config.stations.primary}&product=predictions&datum=MLLW&time_zone=lst_ldt&units=english&interval=hilo&format=json`)
.then(res => res.json())
.then(data => {
  let tides = data.predictions.map(t =>
    `${t.type}: ${t.v} ft @ ${t.t}`
  ).join("<br>");
  document.getElementById("tidePredictions").innerHTML = tides;
});

document.getElementById("windData").innerHTML = "Add NWS API here";
document.getElementById("waveData").innerHTML = "Add NDBC fallback logic here";
document.getElementById("forecast").innerHTML = "Add marine forecast feed here";
