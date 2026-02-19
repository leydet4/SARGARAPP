<!-- helpers/stations-common.js -->
<script type="module">
// ---------- Utilities ----------
const getJSON = async (url) => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const toFixed = (n, d = 1) => (n == null || !isFinite(n) ? "N/A" : Number(n).toFixed(d));
const ktsToMph = (k) => (k == null || !isFinite(k) ? null : k * 1.15078);
const degToCardinal = (deg) => {
  if (deg == null || !isFinite(deg)) return "N/A";
  const a = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return a[Math.round(deg / 22.5) % 16];
};

// ---------- Render helpers ----------
const kv = (label, value) =>
  `<div class="kv"><span class="label">${label}</span><span class="value">${value}</span></div>`;

function stampHTML(dates) {
  if (!dates.length) return "";
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
  return `<div class="stamp">Updated: ${latest.toLocaleString()}</div>`;
}

// ---------- Live block (water, air, wind) ----------
export async function renderLive(stationId, nwsStation, containerId = "liveCard") {
  const box = document.getElementById(containerId);
  if (!box) return;
  let out = ['<h2 class="section-title">Live</h2>'];
  const stamps = [];

  // Water temperature (NOAA CO-OPS)
  try {
    const j = await getJSON(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_temperature&station=${stationId}&time_zone=lst_ldt&units=english&format=json&date=latest`
    );
    const d = j?.data?.[0];
    out.push(kv("Water Temp", d ? `${toFixed(parseFloat(d.v))} °F` : "No data"));
    if (d?.t) stamps.push(new Date(d.t));
  } catch {
    out.push(kv("Water Temp", "No data"));
  }

  // Air temperature (NWS)
  try {
    const a = await getJSON(`https://api.weather.gov/stations/${nwsStation}/observations/latest`);
    const c = a?.properties?.temperature?.value;
    const airF = c != null ? (c * 9) / 5 + 32 : null;
    out.push(kv("Air Temp", airF != null ? `${toFixed(airF)} °F` : "No data"));
    const ts = a?.properties?.timestamp;
    if (ts) stamps.push(new Date(ts));
  } catch {
    out.push(kv("Air Temp", "No data"));
  }

  // Wind (NOAA CO-OPS)
  try {
    const j = await getJSON(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=wind&station=${stationId}&time_zone=lst_ldt&units=english&format=json&date=latest`
    );
    const d = j?.data?.[0];
    if (d) {
      const mph = ktsToMph(parseFloat(d.s));
      const dir = degToCardinal(parseFloat(d.d));
      out.push(kv("Wind", `${mph != null ? toFixed(mph) + " mph" : "N/A"} (${dir})`));
      if (d?.t) stamps.push(new Date(d.t));
    } else {
      out.push(kv("Wind", "No data"));
    }
  } catch {
    out.push(kv("Wind", "No data"));
  }

  // Updated stamp
  out.push(stampHTML(stamps));

  box.innerHTML = out.join("");
}

// ---------- Tides block (last 2 & next 2) ----------
export async function renderTides(stationId, containerId = "tidesCard") {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.innerHTML = '<h2 class="section-title">Tides — Last 2 & Next 2</h2>';

  try {
    const now = new Date();
    const begin = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const y = begin.getFullYear();
    const m = String(begin.getMonth() + 1).padStart(2, "0");
    const d = String(begin.getDate()).padStart(2, "0");

    const j = await getJSON(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&station=${stationId}&datum=MLLW&time_zone=lst_ldt&units=english&interval=hilo&format=json&begin_date=${y}${m}${d}&range=72`
    );
    const preds = j?.predictions || [];
    const nowMs = now.getTime();
    const last2 = preds.filter((p) => new Date(p.t).getTime() < nowMs).slice(-2);
    const next2 = preds.filter((p) => new Date(p.t).getTime() >= nowMs).slice(0, 2);

    const li = (p) =>
      `<li><span class="tide-type">${p.type === "H" ? "High" : "Low"} Tide</span>
         <span class="tide-val">${toFixed(parseFloat(p.v))} ft</span>
         <span class="tide-time">${new Date(p.t).toLocaleString()}</span></li>`;

    let html = "";
    html += '<div class="group-title" style="text-align:center;font-weight:900;">Last 2</div><ul class="tide-list">';
    html += last2.length ? last2.map(li).join("") : '<li><span class="tide-type">—</span><span class="tide-val">No data</span><span class="tide-time"></span></li>';
    html += '</ul><div class="group-title" style="text-align:center;font-weight:900;">Next 2</div><ul class="tide-list">';
    html += next2.length ? next2.map(li).join("") : '<li><span class="tide-type">—</span><span class="tide-val">No data</span><span class="tide-time"></span></li>';
    html += "</ul>";

    box.innerHTML += html;
  } catch (e) {
    box.innerHTML += '<div class="empty">No tide data available</div>';
  }
}

// ---------- Convenience loader ----------
export function loadStationPage(stationId, nwsStation) {
  Promise.allSettled([renderLive(stationId, nwsStation), renderTides(stationId)]);
}
</script>
