// /push-admin.js
(function(){
  const toggleBtn = document.getElementById('pushToggle');
  const testBtn   = document.getElementById('pushTest'); // optional button

  if (!toggleBtn) return;

  const CONFIG_URL = '/.netlify/functions/push-config';             // returns { ok:true, publicKey }
  const SUB_URL    = '/.netlify/functions/push?action=subscribe';   // your existing push function
  const UNSUB_URL  = '/.netlify/functions/push?action=unsubscribe'; // your existing push function
  const TEST_URL   = '/.netlify/functions/push?action=test';        // your existing push function

  let publicKey = null;
  let currentSub = null;

  const urlB64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  };

  function setState(isOn){
    toggleBtn.disabled = false;
    toggleBtn.textContent = isOn ? '🔕 Disable Admin Alerts' : '🔔 Enable Admin Alerts';
  }

  async function getPublicKey(){
    const r = await fetch(CONFIG_URL, { cache:'no-store' });
    // tolerate text error shapes
    let j; try { j = await r.json(); } catch {
      const t = await r.text();
      throw new Error(t || 'Server has no VAPID public key');
    }
    if (!r.ok || j.ok === false || !j.publicKey) {
      throw new Error(j.error || 'Server has no VAPID public key');
    }
    return j.publicKey;
  }

  async function getSubscription(swReg){
    try { return await swReg.pushManager.getSubscription(); } catch { return null; }
  }

  async function subscribe(swReg){
    const appServerKey = urlB64ToUint8Array(publicKey);
    const sub = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });
    // Save subscription server-side
    await fetch(SUB_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ subscription: sub })
    }).catch(()=>{});
    return sub;
  }

  async function unsubscribe(swReg, sub){
    try { await sub.unsubscribe(); } catch {}
    try {
      await fetch(UNSUB_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
    } catch {}
  }

  async function sendTest(){
    // IMPORTANT: send empty JSON body + header so server-side req.json() succeeds
    const r = await fetch(TEST_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: '{}'   // <- this prevents "Unexpected token e ..." parse errors
    });

    // Try JSON first; fall back to text gracefully
    let j = null, t = null;
    try { j = await r.json(); } catch { t = await r.text(); }

    if (!r.ok || (j && j.ok === false)) {
      const msg = (j && j.error) || t || `HTTP ${r.status}`;
      throw new Error(msg);
    }
    return j || { ok:true, message: t || 'sent' };
  }

  async function init(){
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      toggleBtn.textContent = 'Push not supported on this device';
      toggleBtn.disabled = true;
      return;
    }

    toggleBtn.disabled = true;
    try {
      publicKey = await getPublicKey();
    } catch (err) {
      toggleBtn.textContent = err.message || 'Server has no VAPID public key';
      toggleBtn.disabled = true;
      return;
    }

    const swReg = await navigator.serviceWorker.ready;
    currentSub = await getSubscription(swReg);
    setState(!!currentSub);

    toggleBtn.addEventListener('click', async ()=>{
      toggleBtn.disabled = true;
      try{
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          alert('Notifications are blocked. Please enable them in your browser settings.');
          return;
        }
        if (currentSub) {
          await unsubscribe(swReg, currentSub);
          currentSub = null;
          setState(false);
        } else {
          currentSub = await subscribe(swReg);
          setState(true);
        }
      } catch (e) {
        alert('Push error: ' + (e.message || e));
      } finally {
        toggleBtn.disabled = false;
      }
    });

    if (testBtn) {
      testBtn.addEventListener('click', async ()=>{
        try{
          const res = await sendTest();
          alert('Test notification sent.');
          console.log('push test:', res);
        }catch(e){
          alert('Test failed: ' + (e.message || e));
        }
      });
    }
  }

  window.addEventListener('load', init, { once:true });
})();
