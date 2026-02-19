// push-admin.js
// Registers SW, toggles push subscribe/unsubscribe for Admin,
// and can send a test push via the Netlify function.

(function(){
  const btn = document.getElementById('pushToggle');
  const testBtn = document.getElementById('pushTest');
  if (!btn) return;

  const ADMIN_KEY = window.__ADMIN_KEY__ || '';
  const PUB_KEY = (window.PUSH_PUBLIC_KEY || '').trim();

  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  async function hasPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const p = await Notification.requestPermission();
      return p === 'granted';
    }
    return false;
  }

  async function currentSub(reg) {
    try { return await reg.pushManager.getSubscription(); } catch { return null; }
  }

  async function subscribe() {
    if (!PUB_KEY) { alert('Missing PUSH_PUBLIC_KEY. Set it in push-config.js'); return; }
    if (!await hasPermission()) { alert('Notifications are blocked'); return; }
    const reg = await navigator.serviceWorker.register('/service-worker.js');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(PUB_KEY)
    });
    await fetch('/.netlify/functions/push', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'X-Admin-Key': ADMIN_KEY },
      body: JSON.stringify({ action:'subscribe', subscription: sub })
    });
    return sub;
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await currentSub(reg);
    if (!sub) return;
    await fetch('/.netlify/functions/push', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'X-Admin-Key': ADMIN_KEY },
      body: JSON.stringify({ action:'unsubscribe', endpoint: sub.endpoint })
    });
    await sub.unsubscribe();
  }

  async function refreshUI() {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await currentSub(reg) : null;
      btn.textContent = sub ? '🔕 Disable Admin Alerts' : '🔔 Enable Admin Alerts';
    } catch {
      btn.textContent = '🔔 Enable Admin Alerts';
    }
  }

  btn.addEventListener('click', async ()=>{
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await currentSub(reg) : null;
      if (sub) { await unsubscribe(); }
      else { await subscribe(); }
      await refreshUI();
    } catch (e) {
      alert('Push toggle failed: ' + (e.message || e));
    }
  });

  if (testBtn) {
    testBtn.addEventListener('click', async ()=>{
      try {
        await fetch('/.netlify/functions/push', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'X-Admin-Key': ADMIN_KEY },
          body: JSON.stringify({ action:'test' })
        });
        alert('Test sent (check notification).');
      } catch (e) {
        alert('Test failed: ' + (e.message || e));
      }
    });
  }

  window.addEventListener('load', refreshUI, { once:true });
})();
