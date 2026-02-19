// /public/local-conditions.js
// Prompts for location on user gesture; races getCurrentPosition + watchPosition.
// Clear source attribution with station IDs + JSON links. Fallback: Money Point.

const $ = (s) => document.querySelector(s);
const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
const toFixed = (n, d=1) => (n == null || !isFinite(n) ? "N/A" : Number(n).toFixed(d));
const ktsToMph = (k) => (k == null || !isFinite(k) ? null : k * 1.15078);
const msToMph  = (ms) => (ms == null || !isFinite(ms) ? null : ms * 2.23694);
const degToCardinal = (deg) => {
  if (deg == null || !isFinite(deg)) return "N/A";
  const a=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return a[Math.round(deg/22.5)%16];
};
const kmToMiles = (km) => km * 0.621371;

// Defaults (Money Point)
const DEFAULT = {
  label: "Money Point (Chesapeake)",
  lat: 36.7800, lon: -76.3000,
  coops: "8639348",
  nwsStation: "KORF"
};

// --- Fetch helper ---
async function getJSON(url){
  const r = await fetch(url, { cache: "no-store", headers: { "Accept": "application/json" }});
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// --- NOAA CO-OPS ---
let tideStationsCache = null;
async function getNoaaTideStations(){
  if (tideStationsCache) return tideStationsCache;
  const url = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions";
  const j = await getJSON(url);
  tideStationsCache = j.stationList || j.stations || [];
  return tideStationsCache;
}
function distKm(a,b){
  const R=6371, toRad=(x)=>x*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon);
  const sLat=toRad(a.lat), sLat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2 + Math.cos(sLat)*Math.cos(sLat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
async function getNearestTideStation(lat, lon){
  const stations = await getNoaaTideStations();
  let best = null, bestKm = Infinity;
  for(const s of stations){
    const d = distKm({lat, lon}, {lat: parseFloat(s.lat), lon: parseFloat(s.lng)});
    if (d < bestKm){ bestKm = d; best = s; }
  }
  return { best, bestKm };
}
async function getCoopsLatest(product, station, units="english"){
  const base = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
  const url = `${base}?product=${product}&station=${station}&time_zone=lst_ldt&units=${units}&format=json&date=latest`;
  const j = await getJSON(url);
  const d = j?.data?.[0];
  return d ? { v: parseFloat(d.v), t: new Date(d.t), d } : null;
}
async function getTideHiLo(station){
  const now = new Date();
  const begin = new Date(now.getTime() - 24*3600*1000);
  const base = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
  const y = begin.getFullYear(), m = String(begin.getMonth()+1).padStart(2,'0'), d = String(begin.getDate()).padStart(2,'0');
  const url = `${base}?product=predictions&station=${station}&datum=MLLW&time_zone=lst_ldt&units=english&interval=hilo&format=json&begin_date=${y}${m}${d}&range=72`;
  const j = await getJSON(url);
  const preds = j?.predictions || [];
  const nowMs = now.getTime();
  const last2 = preds.filter(p => new Date(p.t).getTime() < nowMs).slice(-2);
  const next2 = preds.filter(p => new Date(p.t).getTime() >= nowMs).slice(0,2);
  return { last2, next2, url }; // include url for source link
}

// --- NWS ---
async function getNwsObservation(lat, lon){
  try{
    const meta = await getJSON(`https://api.weather.gov/points/${lat},${lon}`);
    const stationsUrl = meta?.properties?.observationStations;
    if (!stationsUrl) return null;
    const list = await getJSON(stationsUrl);
    const st = list?.features?.[0]?.properties?.stationIdentifier;
    if (!st) return null;

    const obsUrl = `https://api.weather.gov/stations/${st}/observations/latest`;
    const latest = await getJSON(obsUrl);
    const p = latest?.properties;
    if (!p) return null;

    const airC = p?.temperature?.value;
    const windMs = p?.windSpeed?.value;
    const dir = p?.windDirection?.value;
    const cond = p?.textDescription || "";
    const t = p?.timestamp ? new Date(p.timestamp) : null;

    return {
      stationId: st, obsUrl,
      airF: airC==null ? null : (airC*9/5+32),
      windMph: windMs==null ? null : msToMph(windMs),
      dir, cond, t
    };
  }catch{ return null; }
}
async function getNwsStationLatest(stationId){
  try{
    const obsUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`;
    const latest = await getJSON(obsUrl);
    const p = latest?.properties;
    if (!p) return null;
    const airC = p?.temperature?.value;
    const windMs = p?.windSpeed?.value;
    const dir = p?.windDirection?.value;
    const cond = p?.textDescription || "";
    const t = p?.timestamp ? new Date(p.timestamp) : null;
    return {
      stationId, obsUrl,
      airF: airC==null ? null : (airC*9/5+32),
      windMph: windMs==null ? null : msToMph(windMs),
      dir, cond, t
    };
  }catch{ return null; }
}

// --- Rendering helpers ---
function renderTideList(elId, list){
  const el = document.getElementById(elId);
  if (!el) return;
  if (!list.length){
    el.innerHTML = '<li><div class="tide-row"><span class="tide-type">—</span><span class="tide-val">No data</span></div><div class="tide-time"></div></li>';
    return;
  }
  el.innerHTML = list.map(p => {
    const when = new Date(p.t);
    const type = p.type === 'H' ? 'High' : 'Low';
    return `<li>
      <div class="tide-row">
        <span class="tide-type">${type} Tide</span>
        <span class="tide-val">${toFixed(parseFloat(p.v))} ft</span>
      </div>
      <div class="tide-time">${when.toLocaleString()}</div>
    </li>`;
  }).join('');
}
function stampUpdated(elId, dates){
  const el = document.getElementById(elId);
  if (!el) return;
  if (!dates.length){ el.textContent = 'Updated: —'; return; }
  const latest = new Date(Math.max(...dates.map(d => d.getTime())));
  el.textContent = 'Updated: ' + latest.toLocaleString();
}

// --- Core loader ---
async function loadAll(lat, lon, opts={}){
  $("#notice").textContent = '';
  $("#locStatus").textContent = `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  let stationId = opts.stationId || null;
  let nearest = null, nearestKm = null;

  if (!stationId){
    try{
      const x = await getNearestTideStation(lat, lon);
      nearest = x.best; nearestKm = x.bestKm;
      stationId = nearest?.id || null;
    }catch{
      $("#notice").textContent = 'Could not load NOAA station list.';
      return;
    }
  }
  if (!nearest && stationId){
    $("#nearestTitle").textContent = `Station ${stationId}`;
  } else if (nearest){
    $("#nearestTitle").textContent = `${nearest.name} (${nearest.id}) • ${kmToMiles(nearestKm).toFixed(1)} mi`;
  }

  // Update CO-OPS chip + JSON links (base URLs set later when we know stationId/date)
  $("#chipCoops").textContent = `(station ${stationId || "—"})`;

  // Water temp
  const stamps = [];
  let waterUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_temperature&station=${stationId}&time_zone=lst_ldt&units=english&format=json&date=latest`;
  try{
    const water = await getCoopsLatest('water_temperature', stationId, 'english');
    setText('st-water', water ? `${toFixed(water.v)} °F` : 'No data');
    if (water?.t) stamps.push(water.t);
  }catch{ setText('st-water', 'No data'); }

  // Wind (knots -> mph)
  let windUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=wind&station=${stationId}&time_zone=lst_ldt&units=english&format=json&date=latest`;
  try{
    const wind = await getCoopsLatest('wind', stationId, 'english');
    if (wind?.d){
      const mph = ktsToMph(parseFloat(wind.d.s));
      const dir = parseFloat(wind.d.d);
      setText('st-wind', `${mph!=null?toFixed(mph):'—'} mph (${degToCardinal(dir)})`);
      if (wind?.t) stamps.push(wind.t);
    } else {
      setText('st-wind', 'No data');
    }
  }catch{ setText('st-wind', 'No data'); }

  // Tides
  let tidesMeta = null;
  try{
    tidesMeta = await getTideHiLo(stationId);
    renderTideList('st-last', tidesMeta.last2);
    renderTideList('st-next',  tidesMeta.next2);
  }catch{
    renderTideList('st-last', []); renderTideList('st-next', []);
  }

  // Wire up links
  const link = (id, href) => { const a = document.getElementById(id); if (a) a.href = href; };
  link('linkWater', waterUrl);
  link('linkWind',  windUrl);
  if (tidesMeta?.url) link('linkTides', tidesMeta.url);

  // Weather snapshot
  try{
    let wx = await getNwsObservation(lat, lon);
    if (!wx && DEFAULT.nwsStation){
      wx = await getNwsStationLatest(DEFAULT.nwsStation);
    }
    if (wx){
      setText('st-air', wx.airF!=null ? `${toFixed(wx.airF)} °F` : 'No data');
      const windTxt = (wx.windMph!=null ? `${toFixed(wx.windMph)} mph` : '—') +
                      (wx.dir!=null ? ` (${degToCardinal(wx.dir)})` : '');
      setText('wx-air',  wx.airF!=null ? `${toFixed(wx.airF)} °F` : 'No data');
      setText('wx-wind', windTxt.trim() || 'No data');
      setText('wx-cond', wx.cond || '—');
      stampUpdated('wx-updated', wx.t ? [wx.t] : []);
      if (wx.t) stamps.push(wx.t);

      // Update NWS chip + link
      $("#chipNws").textContent = `(station ${wx.stationId || DEFAULT.nwsStation})`;
      const a = document.getElementById('linkNws');
      if (a) a.href = wx.obsUrl || `https://api.weather.gov/stations/${wx.stationId || DEFAULT.nwsStation}/observations/latest`;
    } else {
      setText('st-air', 'No data');
      setText('wx-air','No data'); setText('wx-wind','No data'); setText('wx-cond','—');
      $("#chipNws").textContent = `(station —)`;
    }
  }catch{
    setText('st-air', 'No data');
    setText('wx-air','No data'); setText('wx-wind','No data'); setText('wx-cond','—');
    $("#chipNws").textContent = `(station —)`;
  }

  stampUpdated('st-updated', stamps);
}

// --- Geolocation prompt (user gesture) ---
function geoPromptOnce(){
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));

    let settled = false;
    const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

    // 1) Single-shot
    navigator.geolocation.getCurrentPosition(
      (p) => { if (!settled){ settled=true; if (watchId!=null) navigator.geolocation.clearWatch(watchId); resolve({lat:p.coords.latitude, lon:p.coords.longitude}); } },
      (err) => { if (!settled){ settled=true; if (watchId!=null) navigator.geolocation.clearWatch(watchId); reject(err); } },
      options
    );

    // 2) Watch (sometimes triggers the prompt more reliably)
    const watchId = navigator.geolocation.watchPosition(
      (p) => { if (!settled){ settled=true; navigator.geolocation.clearWatch(watchId); resolve({lat:p.coords.latitude, lon:p.coords.longitude}); } },
      (err) => { /* ignore watch errors; getCurrentPosition handler will fire too */ },
      options
    );
  });
}

function showHelp(){
  const ov = $("#helpOverlay");
  if (!ov) return;
  ov.style.display = "flex";
}
function hideHelp(){
  const ov = $("#helpOverlay");
  if (!ov) return;
  ov.style.display = "none";
}

// Try device; if denied/timeout -> show help + default to Money Point
async function tryDeviceLocationOrDefault(){
  const locStatus = $("#locStatus");
  locStatus.textContent = "Requesting device location…";
  try{
    const { lat, lon } = await geoPromptOnce();
    hideHelp();
    await loadAll(lat, lon);
  }catch(err){
    console.warn("Geolocation error:", err);
    const reason = (err && err.code === 1) ? "Permission denied" :
                   (err && err.code === 2) ? "Position unavailable" :
                   (err && err.code === 3) ? "Timeout" : "Unavailable";
    locStatus.textContent = `${reason}. Using default: ${DEFAULT.label}`;
    showHelp();
    await loadAll(DEFAULT.lat, DEFAULT.lon, { stationId: DEFAULT.coops });
  }
}

// --- UI wiring ---
function validNum(x){ return x!=null && x!=='' && isFinite(Number(x)); }

document.getElementById('useLocation').addEventListener('click', async () => {
  await tryDeviceLocationOrDefault(); // user gesture => prompt must appear (unless previously blocked)
});
document.getElementById('useManual').addEventListener('click', async () => {
  const lat = parseFloat($("#latIn").value);
  const lon = parseFloat($("#lonIn").value);
  if (validNum(lat) && validNum(lon)) {
    hideHelp();
    await loadAll(lat, lon);
    $("#locStatus").textContent = `Manual location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } else {
    $("#locStatus").textContent = "Please enter valid numbers for lat and lon.";
  }
});
document.getElementById('refreshBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  const txt = $("#locStatus").textContent || '';
  const m = txt.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m){ await loadAll(parseFloat(m[1]), parseFloat(m[2])); }
});
document.getElementById('helpClose').addEventListener('click', hideHelp);
document.getElementById('helpRetry').addEventListener('click', async () => {
  hideHelp();
  await tryDeviceLocationOrDefault();
});

// On first load: show trying… then default quickly if blocked/timeout
(async () => {
  $("#locStatus").textContent = "Trying device location…";
  await tryDeviceLocationOrDefault();
})();
