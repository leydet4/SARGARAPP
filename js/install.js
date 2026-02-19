// PWA install helper + QR link display
let deferredPrompt = null;

function setStatus(msg) {
  const el = document.getElementById("installStatus");
  if (el) el.textContent = msg;
}

function getSiteUrl() {
  // If config.siteUrl is set, use it; otherwise fallback to current origin
  const cfgUrl = (typeof config !== "undefined" && config.siteUrl) ? config.siteUrl.trim() : "";
  return cfgUrl || window.location.origin;
}

function setSiteUrlText() {
  const siteUrlText = document.getElementById("siteUrlText");
  if (siteUrlText) siteUrlText.textContent = getSiteUrl();
}

// Listen for install prompt availability (mostly Android/Chrome/Edge)
window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  deferredPrompt = e;

  const btn = document.getElementById("installBtn");
  if (!btn) return;

  btn.style.display = "inline-block";
  setStatus("Install is available on this device.");

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;

    if (choice && choice.outcome === "accepted") {
      btn.style.display = "none";
      setStatus("Installed! Launch it from your home screen.");
    } else {
      setStatus("Install dismissed. You can install later from the browser menu.");
    }
  }, { once: true });
});

// When the app is installed
window.addEventListener("appinstalled", () => {
  const btn = document.getElementById("installBtn");
  if (btn) btn.style.display = "none";
  setStatus("App installed successfully.");
});

// Register service worker for offline/PWA behavior
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      // If no install prompt shows, it may be iOS or already installed
      setStatus("Ready. If you don’t see an install button, use the steps below.");
    } catch (err) {
      console.warn("SW registration failed:", err);
      setStatus("Install helper ready, but offline support may not be available.");
    }
  });
} else {
  setStatus("This browser doesn't support installation.");
}

setSiteUrlText();
