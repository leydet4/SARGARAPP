// new-gar.js — Final GAR 2.0 logic (requires all risks selected + 24-hour fix)

// --- State and helpers ---
const state = {
  planning: '',
  event: '',
  assetCrew: '',
  assetBoat: '',
  communications: '',
  environment: '',
  overallRisk: '',
  overallGain: ''
};

const qs = sel => document.querySelector(sel);
const qsa = sel => document.querySelectorAll(sel);

const nameInput = qs('#name');        // ✅ added
const boatInput = qs('#boat');
const dateInput = qs('#date');
const timeInput = qs('#time');
const shiftSelect = qs('#shift');
const locationInput = qs('#location');
const crewCountInput = qs('#crewCount');
const crewContainer = qs('#crewContainer');
const decisionBox = qs('#commandDecision');
const submitBtn = qs('#submit');

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const boat = params.get('boat');
  if (boat) {
    // store the raw ID (Fireboat4) for backend compatibility
    boatInput.value = boat;
    localStorage.setItem('selectedBoat', boat);
  } else {
    const saved = localStorage.getItem('selectedBoat');
    if (saved) boatInput.value = saved;
  }

  updateCrewFields();

  crewCountInput.addEventListener('change', updateCrewFields);
  qs('#nowDate')?.addEventListener('click', () => {
    const d = new Date();
    dateInput.value = d.toISOString().split('T')[0];
  });

  // ✅ Fixed 24-hour Now button
  qs('#nowTime')?.addEventListener('click', () => {
    const d = new Date();
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    timeInput.value = `${h}:${m}`;
  });

  // Auto-format typed 24-hour input
  timeInput?.addEventListener('input', e => {
    let v = e.target.value.replace(/[^0-9]/g, '');
    if (v.length >= 3) v = `${v.slice(0, 2)}:${v.slice(2, 4)}`;
    e.target.value = v.slice(0, 5);
  });
});

// --- Crew fields generator ---
function updateCrewFields() {
  const n = parseInt(crewCountInput.value) || 0;
  crewContainer.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const div = document.createElement('div');
    div.className = 'crew-card';
    div.innerHTML = `
      <h4>Crew ${i + 1}</h4>
      <div class="crew-row">
        <div class="crew-field">
          <label>First Initial</label>
          <input data-crew-initial maxlength="1" placeholder="A" required>
        </div>
        <div class="crew-field">
          <label>Last Name</label>
          <input data-crew-last placeholder="Smith" required>
        </div>
      </div>
    `;
    crewContainer.appendChild(div);
  }
}

// --- Button logic ---
function setRisk(key, val, el) {
  state[key] = val;
  const group = el.closest('.risk-group');
  if (group) group.querySelectorAll('.choice').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  group.style.outline = 'none';
}

function setOverall(key, val, el) {
  state[key] = val;
  const group = el.closest('.overall-group');
  if (group) group.querySelectorAll('.choice').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  group.style.outline = 'none';
  updateDecision();
}

// --- Command decision logic ---
function updateDecision() {
  const r = decisionFromMatrix(state.overallRisk, state.overallGain);
  decisionBox.className = `decision ${r.c}`;
  decisionBox.textContent = r.t;
}

function decisionFromMatrix(risk, gain) {
  const map = {
    Low: {
      High: { c: 'green', t: 'Accept Mission' },
      Medium: { c: 'green', t: 'Accept Mission' },
      Low: { c: 'green', t: 'Accept Mission' }
    },
    Medium: {
      High: { c: 'yellow', t: 'Accept – Monitor' },
      Medium: { c: 'yellow', t: 'Accept – Monitor' },
      Low: { c: 'yellow', t: 'Accept w/ Cmd Endorsement' }
    },
    High: {
      High: { c: 'red', t: 'Cmd Endorsement Only' },
      Medium: { c: 'red', t: 'Cmd Endorsement Only' },
      Low: { c: 'red', t: 'Do Not Accept' }
    }
  };
  return map[risk]?.[gain] || { c: '', t: '—' };
}

// --- Time validation helper ---
function isValidTime(str) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
}

// --- Submit logic ---
async function submit() {
  const initials = Array.from(qsa('[data-crew-initial]')).map(i => (i.value || '').trim().toUpperCase());
  const lasts = Array.from(qsa('[data-crew-last]')).map(i => (i.value || '').trim());
  const crew = initials.map((fi, idx) => fi && lasts[idx] ? `${fi}.${capitalize(lasts[idx])}` : '').filter(Boolean);

  const payload = {
    name: (nameInput.value || '').trim(),           // ✅ added
    boat: (boatInput.value || '').trim(),           // ensure raw boat name
    date: (dateInput.value || '').trim(),
    time: (timeInput.value || '').trim(),
    shift: (shiftSelect.value || '').trim(),
    location: (locationInput.value || '').trim(),
    crew,
    riskElements: {
      planning: state.planning,
      event: state.event,
      assetCrew: state.assetCrew,
      assetBoat: state.assetBoat,
      communications: state.communications,
      environment: state.environment
    },
    overallRisk: state.overallRisk,
    overallGain: state.overallGain,
    ...(() => {
      const r = decisionFromMatrix(state.overallRisk, state.overallGain);
      return { commandDecision: r.t, color: r.c };
    })()
  };

  // --- Required field highlighting ---
  const required = [
    { el: nameInput, valid: !!payload.name },        // ✅ added
    { el: dateInput, valid: !!payload.date },
    { el: timeInput, valid: isValidTime(payload.time) },
    { el: shiftSelect, valid: !!payload.shift },
    { el: locationInput, valid: !!payload.location },
    { el: crewCountInput, valid: crew.length > 0 },
  ];
  let hasError = false;
  required.forEach(f => {
    f.el.style.border = f.valid ? '1px solid #444' : '2px solid red';
    if (!f.valid) hasError = true;
  });

  // --- Require all risk elements + overall selections ---
  const missingRisks = Object.entries({
    planning: 'Planning',
    event: 'Event Complexity',
    assetCrew: 'Crew',
    assetBoat: 'Boat',
    communications: 'Communications',
    environment: 'Environment',
    overallRisk: 'Overall Risk',
    overallGain: 'Overall Gain'
  }).filter(([k]) => !state[k]);

  if (missingRisks.length > 0) {
    missingRisks.forEach(([k]) => {
      const grp = document.querySelector(`[data-risk="${k}"], [data-overall="${k}"]`)?.closest('.risk-group, .overall-group');
      if (grp) {
        grp.style.outline = '2px solid red';
        setTimeout(() => (grp.style.outline = 'none'), 1500);
      }
    });
    alert('Please complete all risk and gain assessments before submitting.');
    return;
  }

  if (hasError) return alert('Please complete all required fields (time must be 24-hour format).');

  submitBtn.disabled = true;
  try {
    const res = await fetch('/.netlify/functions/gar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    alert('GAR submitted successfully.');
    location.href = './gar-home.html';
  } catch (err) {
    console.error(err);
    alert('Save failed: ' + (err?.message || 'unknown error'));
  } finally {
    submitBtn.disabled = false;
  }
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function humanBoat(id) {
  const m = { Boat2: 'Boat 2', Boat5: 'Boat 5', Boat7: 'Boat 7', Boat8: 'Boat 8', Fireboat4: 'Fireboat 4' };
  return m[id] || id;
}

qs('#submit')?.addEventListener('click', submit);
