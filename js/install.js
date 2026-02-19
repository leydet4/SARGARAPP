let deferredPrompt = null;

function $(id) { return document.getElementById(id); }

async function registerRootSw() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  } catch {}
}

function showHelp(message) {
  const help = $("installHelp");
  if (!help) return;
  help.innerHTML = message;
}

function getInstallHelpHtml() {
  return `
    <strong>Install options:</strong><br>
    • <b>Android (Chrome):</b> tap the <b>⋮ menu</b> → <b>Install app</b> / <b>Add to Home screen</b><br>
    • <b>iPhone/iPad:</b> open in <b>Safari</b> → <b>Share</b> → <b>Add to Home Screen</b><br>
    • <b>Desktop Chrome:</b> look for the <b>Install icon</b> in the address bar or use <b>⋮</b> → <b>Install</b>
  `;
}

function wireInstallButton() {
  const installBtn = $("installBtn");
  if (!installBtn) return;

  // Always show the button (even if native prompt is suppressed)
  installBtn.style.display = "inline-block";

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // If we get the prompt, update help text slightly
    showHelp(`
      <strong>Install is available on this device.</strong><br>
      Tap <b>Install App</b> above. If it doesn’t work, use the Chrome <b>⋮</b> menu → <b>Install app</b>.
    `);
  });

  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      // Native prompt path (mostly Android)
      installBtn.disabled = true;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.disabled = false;
      return;
    }

    // No prompt available (common on desktop)
    showHelp(`
      <strong>No install popup available here (normal on desktop).</strong><br>
      Try one of these:<br>
      • <b>Desktop Chrome:</b> address bar install icon OR <b>⋮</b> → <b>Install</b><br>
      • <b>Android Chrome:</b> <b>⋮</b> → <b>Install app</b> / <b>Add to Home screen</b><br>
      • <b>iPhone/iPad:</b> Safari → Share → Add to Home Screen
    `);
  });

  window.addEventListener("appinstalled", () => {
    showHelp(`<strong>Installed!</strong> You can launch it from your home screen.`);
    installBtn.style.display = "none";
  });
}

async function resetPwa() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch {}

  try {
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {}

  location.reload();
}

function wireResetButton() {
  const btn = $("resetPwaBtn");
  if (!btn) return;
  btn.addEventListener("click", () => resetPwa());
}

window.addEventListener("load", async () => {
  showHelp(getInstallHelpHtml());
  await registerRootSw();
  wireInstallButton();
  wireResetButton();
});
