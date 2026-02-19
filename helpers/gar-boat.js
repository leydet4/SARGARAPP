// gar-boat.js — Admin login + Edit/Delete with modal; latest+groups+filters preserved

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const boat = params.get('boat');
  const displayName = humanBoat(boat);

  const title = document.getElementById('boatName');
  const list = document.getElementById('garList');
  const latestBox = document.getElementById('latestGarBox');

  const newBtn = document.getElementById('newGarBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const printBtn = document.getElementById('printBtn');
  const shiftFilter = document.getElementById('filterShift');
  const dateFilter = document.getElementById('filterDate');
  const clearBtn = document.getElementById('clearFilters');

  // Inject Admin button into the existing toolbar
  const toolbar = document.querySelector('.gar-buttons');
  const adminBtn = document.createElement('button');
  adminBtn.className = 'btn grey';
  adminBtn.id = 'adminBtn';
  adminBtn.type = 'button';
  adminBtn.textContent = 'Admin Login';
  toolbar?.appendChild(adminBtn);

  // Modal root
  injectModalShell();

  if (!boat) {
    title.textContent = 'No boat selected';
    list.innerHTML = '<p>No boat was specified.</p>';
    return;
  }

  title.textContent = displayName;
  newBtn.addEventListener('click', () => window.location.href = `./new-gar.html?boat=${boat}`);
  refreshBtn.addEventListener('click', () => loadGARs(boat));
  printBtn.addEventListener('click', () => window.print());

  // Admin key memory (same style as maintenance)
  const ADMIN_LS_KEY = 'adminKey';
  const getAdminKey = () => localStorage.getItem(ADMIN_LS_KEY) || '';
  const hasAdmin = () => !!getAdminKey();

  adminBtn.addEventListener('click', () => {
    if (hasAdmin()) {
      // toggle logout
      if (confirm('Log out admin?')) {
        localStorage.removeItem(ADMIN_LS_KEY);
        adminBtn.textContent = 'Admin Login';
        renderCurrent(); // re-render to hide controls
      }
    } else {
      const key = prompt('Enter Admin Key');
      if (!key) return;
      localStorage.setItem(ADMIN_LS_KEY, key);
      adminBtn.textContent = 'Admin (On)';
      renderCurrent(); // re-render to show controls
    }
  });

  let allGARs = [];
  let lastFilteredFlag = false; // whether we’re currently showing filtered view

  async function loadGARs(boatId) {
    list.innerHTML = '<p>Loading GARs...</p>';
    latestBox.classList.add('hidden');
    try {
      const res = await fetch(`/.netlify/functions/gar?boat=${boatId}`);
      const data = await res.json();
      if (!data.ok || !data.items.length) {
        list.innerHTML = '<p>No previous GARs found.</p>';
        allGARs = [];
        return;
      }
      // newest -> oldest
      allGARs = data.items.sort(
        (a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time)
      );
      adminBtn.textContent = hasAdmin() ? 'Admin (On)' : 'Admin Login';
      showLatestGAR(allGARs[0]);                 // collapsed by default
      renderGARs(allGARs.slice(1), false);       // grouped view, collapsed months by default
      lastFilteredFlag = false;
    } catch (err) {
      console.error(err);
      list.innerHTML = `<p>Error loading GARs: ${err.message}</p>`;
    }
  }

  // --- Latest GAR (collapsed initially) ---
  function showLatestGAR(latest) {
    if (!latest) return;
    const color = colorFromDecision(latest.commandDecision || '');
    const formattedDate = formatUSDate(latest.date);
    latestBox.classList.remove('hidden');
    const adminControls = hasAdmin() ? adminButtons(latest) : '';

    latestBox.innerHTML = `
      <h2>Latest GAR</h2>
      <div class="gar-card latest" data-id="${latest.id || ''}" data-submitted="${latest.submittedAt || ''}">
        <div class="gar-summary-title">${formattedDate} ${latest.time || ''} — Shift ${latest.shift || ''}</div>
        <div><strong>Location:</strong> ${latest.location || 'N/A'}</div>
        <div><strong>Crew:</strong> ${latest.crew?.join(', ') || 'N/A'}</div>
        <div><strong>Risk / Gain:</strong>
          <span class="${color}">${latest.overallRisk || '—'}</span> /
          <span>${latest.overallGain || '—'}</span>
        </div>
        ${adminControls}
        <button type="button" class="expand-btn" data-target="#latestDetails" aria-expanded="false">View Details ▾</button>
        <div class="gar-details hidden" id="latestDetails">
          <hr>
          <ul>
            <li><b>Planning:</b> ${latest.riskElements?.planning || '—'}</li>
            <li><b>Event Complexity:</b> ${latest.riskElements?.event || '—'}</li>
            <li><b>Asset – Crew:</b> ${latest.riskElements?.assetCrew || '—'}</li>
            <li><b>Asset – Boat:</b> ${latest.riskElements?.assetBoat || '—'}</li>
            <li><b>Communications:</b> ${latest.riskElements?.communications || '—'}</li>
            <li><b>Environment:</b> ${latest.riskElements?.environment || '—'}</li>
          </ul>
          <p><b>Command Decision:</b> ${latest.commandDecision || '—'}</p>
          <p><em>Submitted:</em> ${ latest.submittedAt ? new Date(latest.submittedAt).toLocaleString() : '—' }</p>
        </div>
      </div>
    `;
  }

  // --- Group by month/year ---
  function groupByMonth(items) {
    const groups = {};
    items.forEach(i => {
      const d = new Date(i.date);
      if (isNaN(d)) return;
      const monthYear = `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(i);
    });
    // newest-first inside each group
    Object.keys(groups).forEach(k => groups[k].sort((a,b)=> new Date(b.date+' '+b.time)-new Date(a.date+' '+a.time)));
    return groups;
  }

  function renderGARs(items, isFiltered) {
    const shiftVal = (shiftFilter.value || '').trim().toUpperCase();
    const dateVal = (dateFilter.value || '').trim();
    let filtered = items;

    if (shiftVal) filtered = filtered.filter(i => (i.shift || '').toUpperCase() === shiftVal);
    if (dateVal) filtered = filtered.filter(i => i.date === dateVal);

    lastFilteredFlag = !!(shiftVal || dateVal);

    // Filtered view: no latest, no month groups
    if (isFiltered || lastFilteredFlag) {
      latestBox.classList.add('hidden');
      if (!filtered.length) { list.innerHTML = `<p>No entries match your filters.</p>`; return; }
      list.innerHTML = filtered.map(item => cardHtml(item, hasAdmin())).join('');
      return;
    }

    // Grouped (initial) view — months collapsed by default
    const groups = groupByMonth(filtered);
    if (!filtered.length) { list.innerHTML = `<p>No previous GARs found.</p>`; return; }

    list.innerHTML = Object.entries(groups).map(([month, arr], idx) => {
      const cards = arr.map(i => cardHtml(i, hasAdmin())).join('');
      return `
        <div class="month-group">
          <button type="button" class="month-toggle" data-month="${idx}" aria-expanded="false">
            ${month} <span class="arrow">▾</span>
          </button>
          <div class="month-content hidden">${cards}</div>
        </div>
      `;
    }).join('');
  }

  function cardHtml(item, showAdmin) {
    const color = colorFromDecision(item.commandDecision || '');
    const formattedDate = formatUSDate(item.date);
    const adminControls = showAdmin ? adminButtons(item) : '';
    return `
      <div class="gar-card" data-id="${item.id || ''}" data-submitted="${item.submittedAt || ''}">
        <div class="gar-summary-title">${formattedDate} ${item.time || ''} — Shift ${item.shift || ''}</div>
        <div><strong>Location:</strong> ${item.location || 'N/A'}</div>
        <div><strong>Crew:</strong> ${item.crew?.join(', ') || 'N/A'}</div>
        <div><strong>Risk / Gain:</strong>
          <span class="${color}">${item.overallRisk || '—'}</span> /
          <span>${item.overallGain || '—'}</span>
        </div>
        ${adminControls}
        <button type="button" class="expand-btn" aria-expanded="false">View Details ▾</button>
        <div class="gar-details hidden">
          <hr>
          <ul>
            <li><b>Planning:</b> ${item.riskElements?.planning || '—'}</li>
            <li><b>Event Complexity:</b> ${item.riskElements?.event || '—'}</li>
            <li><b>Asset – Crew:</b> ${item.riskElements?.assetCrew || '—'}</li>
            <li><b>Asset – Boat:</b> ${item.riskElements?.assetBoat || '—'}</li>
            <li><b>Communications:</b> ${item.riskElements?.communications || '—'}</li>
            <li><b>Environment:</b> ${item.riskElements?.environment || '—'}</li>
          </ul>
          <p><b>Command Decision:</b> ${item.commandDecision || '—'}</p>
          <p><em>Submitted:</em> ${ item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '—' }</p>
        </div>
      </div>
    `;
  }

  function adminButtons(item) {
    return `
      <div class="admin-controls">
        <button type="button" class="btn admin-edit" data-id="${item.id || ''}" data-submitted="${item.submittedAt || ''}">📝 Edit</button>
        <button type="button" class="btn admin-delete" data-id="${item.id || ''}" data-submitted="${item.submittedAt || ''}">🗑 Delete</button>
      </div>
    `;
  }

  // Delegated interactions (mobile-safe)
  document.addEventListener('click', async (e) => {
    // Expand details
    const exp = e.target.closest('.expand-btn');
    if (exp) {
      const details = exp.parentElement.querySelector('.gar-details') || document.querySelector(exp.getAttribute('data-target'));
      if (!details) return;
      const open = !details.classList.contains('hidden');
      details.classList.toggle('hidden', open);
      exp.textContent = open ? 'View Details ▾' : 'Hide Details ▴';
      return;
    }

    // Month expand/collapse
    const monthBtn = e.target.closest('.month-toggle');
    if (monthBtn) {
      const content = monthBtn.nextElementSibling;
      const open = !content.classList.contains('hidden');
      content.classList.toggle('hidden', open);
      monthBtn.querySelector('.arrow').textContent = open ? '▾' : '▴';
      monthBtn.setAttribute('aria-expanded', String(!open));
      return;
    }

    // Admin edit
    const editBtn = e.target.closest('.admin-edit');
    if (editBtn) {
      if (!hasAdmin()) return alert('Admin not logged in.');
      const id = editBtn.getAttribute('data-id');
      const submittedAt = editBtn.getAttribute('data-submitted');
      const item = findByIdOrSubmitted(id, submittedAt);
      if (!item) return alert('Item not found.');
      openEditModal(item);
      return;
    }

    // Admin delete
    const delBtn = e.target.closest('.admin-delete');
    if (delBtn) {
      if (!hasAdmin()) return alert('Admin not logged in.');
      if (!confirm('Delete this GAR entry? This cannot be undone.')) return;
      const id = delBtn.getAttribute('data-id');
      const submittedAt = delBtn.getAttribute('data-submitted');
      await adminDelete({ id, submittedAt });
      await reloadAfterChange();
      return;
    }

    // Modal save / close
    if (e.target.id === 'modalClose') closeModal();
    if (e.target.id === 'modalSave') {
      await adminSave();
      await reloadAfterChange();
    }
  });

  // Filters
  shiftFilter.addEventListener('change', () => renderGARs(allGARs, true));
  dateFilter.addEventListener('change', () => renderGARs(allGARs, true));
  clearBtn.addEventListener('click', () => {
    shiftFilter.value = '';
    dateFilter.value = '';
    showLatestGAR(allGARs[0]);
    renderGARs(allGARs.slice(1), false);
  });

  // Helpers for admin
  function findByIdOrSubmitted(id, submittedAt) {
    return allGARs.find(x => (id && x.id === id) || (submittedAt && x.submittedAt === submittedAt));
  }

  async function adminDelete(ref) {
    const adminKey = getAdminKey();
    if (!adminKey) return alert('Admin key missing.');

    const res = await fetch('/.netlify/functions/gar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify({ action: 'delete', boat, ...ref })
    });
    const data = await res.json();
    if (!data.ok) alert('Delete failed: ' + (data.error || 'unknown error'));
  }

  async function adminSave() {
    const adminKey = getAdminKey();
    if (!adminKey) return alert('Admin key missing.');

    const form = document.getElementById('editForm');
    const id = form.dataset.id || '';
    const submittedAt = form.dataset.submitted || '';

    // Parse crew (comma-separated)
    const crewText = form.crew.value.trim();
    const crew = crewText ? crewText.split(',').map(s => s.trim()).filter(Boolean) : [];

    const overallRisk = form.overallRisk.value;
    const overallGain = form.overallGain.value;
    const decision = decisionFromMatrix(overallRisk, overallGain);

    // riskElements (read-only here unless you want to expose editing)
    let riskElements = null;
    try { riskElements = JSON.parse(form.riskElements.value || 'null'); } catch { riskElements = null; }

    const payload = {
      action: 'update',
      boat,
      id,
      submittedAt,
      location: form.location.value.trim(),
      crew,
      overallRisk,
      overallGain,
      commandDecision: decision.text,
      ...(riskElements ? { riskElements } : {})
    };

    const res = await fetch('/.netlify/functions/gar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) alert('Save failed: ' + (data.error || 'unknown error'));
    closeModal();
  }

  async function reloadAfterChange() {
    await loadGARs(boat);
    // if we were filtered, keep filtered view after reload
    if (lastFilteredFlag) renderGARs(allGARs, true);
  }

  function decisionFromMatrix(risk, gain){
    const map = {
      Low: { High: {c:'green', text:'Accept Mission'}, Medium: {c:'green', text:'Accept Mission'}, Low: {c:'green', text:'Accept Mission'} },
      Medium:{ High: {c:'yellow', text:'Accept – Monitor'}, Medium:{c:'yellow', text:'Accept – Monitor'}, Low:{c:'yellow', text:'Accept w/ Cmd Endorsement'} },
      High: { High: {c:'red', text:'Cmd Endorsement Only'}, Medium:{c:'red', text:'Cmd Endorsement Only'}, Low:{c:'red', text:'Do Not Accept'} }
    };
    return map[risk]?.[gain] || { color:'', text:'—' };
  }

  // Modal / UI helpers
  function injectModalShell() {
    if (document.getElementById('modalRoot')) return;
    const div = document.createElement('div');
    div.id = 'modalRoot';
    div.innerHTML = `
      <div class="modal hidden" id="editModal" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>Edit GAR</h3>
            <button type="button" id="modalClose" class="btn small">✕</button>
          </div>
          <div class="modal-body">
            <form id="editForm" data-id="" data-submitted="">
              <div class="form-row">
                <label>Location</label>
                <input name="location" placeholder="Mission Location" />
              </div>
              <div class="form-row">
                <label>Crew (comma separated)</label>
                <input name="crew" placeholder="A.Smith, B.Jones, ..." />
              </div>
              <div class="form-row two">
                <div>
                  <label>Overall Risk</label>
                  <select name="overallRisk">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label>Overall Gain</label>
                  <select name="overallGain">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <label>Risk Elements (JSON, optional)</label>
                <textarea name="riskElements" rows="4" placeholder='{"planning":"Low","event":"Medium",...}'></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" id="modalSave" class="btn yellow">Save Changes</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  function openEditModal(item) {
    const modal = document.getElementById('editModal');
    const form = document.getElementById('editForm');
    form.dataset.id = item.id || '';
    form.dataset.submitted = item.submittedAt || '';
    form.location.value = item.location || '';
    form.crew.value = (item.crew || []).join(', ');
    form.overallRisk.value = item.overallRisk || 'Low';
    form.overallGain.value = item.overallGain || 'Low';
    form.riskElements.value = item.riskElements ? JSON.stringify(item.riskElements) : '';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    const modal = document.getElementById('editModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  // Render-refresh helper for admin toggle
  function renderCurrent() {
    if (!allGARs.length) return;
    // restore layout depending on filter state
    if (lastFilteredFlag) {
      renderGARs(allGARs, true);
    } else {
      showLatestGAR(allGARs[0]);
      renderGARs(allGARs.slice(1), false);
    }
  }

  // Initial load
  loadGARs(boat);

  // Basic helpers
  function humanBoat(id) {
    const m = { Boat2: 'Boat 2', Boat5: 'Boat 5', Boat7: 'Boat 7', Boat8: 'Boat 8', Fireboat4: 'Fireboat 4' };
    return m[id] || id;
  }
  function colorFromDecision(text) {
    const t = text.toLowerCase();
    if (t.includes('do not')) return 'red';
    if (t.includes('endorsement')) return 'yellow';
    if (t.includes('monitor')) return 'yellow';
    if (t.includes('accept')) return 'green';
    return '';
  }
  function formatUSDate(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${m}/${d}/${y}`;
  }
});
