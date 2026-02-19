let deferredPrompt = null;

function $(id) { return document.getElementById(id); }

function isAndroid() {
  const ua = navigator.userAgent || "";
  return /Android/i.test(ua);
}

function isIOS() {
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function showHelp(html) {
  const el = $("installHelp");
  if (el) el.innerHTML = html;
}

function showToast(messageHtml) {
  const toast = $("toast");
  const msg = $("toastMsg");
  const close = $("toastClose");
  if (!toast || !msg || !close) return;

  msg.innerHTML = messageHtml;
  toast.style.display = "block";

  const hide = () => { toast.style.display = "none"; };
  close.onclick = hide;

  // Auto-hide after 8s
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(hide, 8000);
}

async function registerRootSw() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  } catch (e) {
    // Not fatal for showing instructions
    console.warn("SW registration failed:", e);
  }
}

function defaultHelpHtml() {
  return `
    <strong>Install options:</strong><br>
    • <b>Android (Chrome):</b> tap the <b>⋮ menu</b> → <b>Install app</b> / <b>Add to Home screen</b><br>
    • <b>iPhone/iPad:</b> open in <b>Safari</b> → <b>Share</b> → <b>Add to Home Screen</b><br>
    • <b>Desktop Chrome:</b> address bar <b>Install icon</b> or <b>⋮</b> → <b>Install</b>
  `;
}

function wireBeforeInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    // This is the ONLY time the button can trigger a true install popup.
    e.preventDefault();
    deferredPrompt = e;

    showHelp(`
      <strong>Install is available on this device.</strong><br>
      Tap <b>Install App</b> above to install. If it doesn’t pop up, use Chrome <b>⋮</b> → <b>Install app</b>.
    `);
  });

  window.addEventListener("appinstalled", () => {
    showHelp(`<strong>Installed!</strong> Launch it from your home screen.`);
    const btn = $("installBtn");
    if (btn) btn.style.display = "none";
  });
}

function wireInstallButton() {
  const installBtn = $("installBtn");
  if (!installBtn) return;

  installBtn.style.display = "inline-block";

  installBtn.addEventListener("click", async () => {
    // If we have the native prompt (mostly Android/Chrome when not suppressed)
    if (deferredPrompt) {
      installBtn.disabled = true;
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch (e) {
        console.warn("Install prompt error:", e);
      }
      deferredPrompt = null;
      installBtn.disabled = false;
      return;
    }

    // Prompt not available (suppressed or unsupported)
    if (isAndroid()) {
      showToast(`
        <b>No install popup shown.</b><br>
        In Android Chrome: tap the <b>⋮</b> menu (top-right) → <b>Install app</b> or <b>Add to Home screen</b>.
      `);
    } else if (isIOS()) {
      showToast(`
        <b>iPhone/iPad:</b><br>
        Open in <b>Safari</b> → tap <b>Share</b> → <b>Add to Home Screen</b>.
      `);
    } else {
      showToast(`
        <b>Desktop Chrome:</b><br>
        Look for the <b>Install icon</b> in the address bar, or use <b>⋮</b> → <b>Install</b>.
      `);
    }
  });
}

window.addEventListener("load", async () => {
  showHelp(defaultHelpHtml());
  await registerRootSw();
  wireBeforeInstallPrompt();
  wireInstallButton();
});
