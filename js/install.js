// install.js — shows install button when available + prints diagnostics + reset button

let deferredPrompt = null;

function $(id) { return document.getElementById(id); }

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

async function getSwInfo() {
  const info = {
    supported: "serviceWorker" in navigator,
    controller: !!navigator.serviceWorker?.controller,
    scope: null,
    active: null,
    error: null
  };

  if (!info.supported) return info;

  try {
    // Try to find existing registration at root scope
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (reg) {
      info.scope = reg.scope;
      info.active = !!reg.active;
    } else {
      info.scope = "(none)";
      info.active = false;
    }
  } catch (e) {
    info.error = String(e);
  }

  return info;
}

async function checkManifest() {
  try {
    const res = await fetch("/manifest.json", { cache: "no-store" });
    const ok = res.ok;
    const ct = res.headers.get("content-type") || "";
    let text = "";
    try { text = await res.text(); } catch {}
    return {
      ok,
      contentType: ct,
      bytes: text.length
    };
  } catch (e) {
    return { ok: false, contentType: "", bytes: 0, error: String(e) };
  }
}

async function registerRootSw() {
  if (!("serviceWorker" in navigator)) return { ok: false, error: "no serviceWorker support" };

  try {
    const reg = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
    return { ok: true, scope: reg.scope };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function printDebug(lines) {
  const out = $("debugOut");
  if (out) out.textContent = lines.join("\n");
}

async function runDiagnostics() {
  const lines = [];
  const ua = navigator.userAgent || "";

  lines.push("POV SAR GAR App – PWA Diagnostics");
  lines.push("---------------------------------");
  lines.push(`URL: ${location.href}`);
  lines.push(`Origin: ${location.origin}`);
  lines.push(`Secure Context (HTTPS): ${window.isSecureContext}`);
  lines.push(`Standalone Mode: ${isStandalone()}`);
  lines.push(`User Agent: ${ua}`);
  lines.push("");

  // Manifest
  const mf = await checkManifest();
  lines.push("Manifest (/manifest.json):");
  lines.push(`- Fetch OK: ${mf.ok}`);
  lines.push(`- Content-Type: ${mf.contentType || "(none)"}`);
  lines.push(`- Size (bytes): ${mf.bytes}`);
  if (mf.error) lines.push(`- Error: ${mf.error}`);
  lines.push("");

  // Service worker
  const swBefore = await getSwInfo();
  lines.push("Service Worker:");
  lines.push(`- Supported: ${swBefore.supported}`);
  lines.push(`- Controller (page is controlled): ${swBefore.controller}`);
  lines.push(`- Existing Reg Scope: ${swBefore.scope}`);
  lines.push(`- Active: ${swBefore.active}`);
  if (swBefore.error) lines.push(`- Error: ${swBefore.error}`);
  lines.push("");

  // Try registering root SW (this often fixes installability)
  const regAttempt = await registerRootSw();
  lines.push("Register /service-worker.js:");
  lines.push(`- OK: ${regAttempt.ok}`);
  if (regAttempt.ok) lines.push(`- Scope: ${regAttempt.scope}`);
  else lines.push(`- Error: ${regAttempt.error}`);
  lines.push("");

  const swAfter = await getSwInfo();
  lines.push("Service Worker (after register attempt):");
  lines.push(`- Controller (page is controlled): ${swAfter.controller}`);
  lines.push(`- Reg Scope: ${swAfter.scope}`);
  lines.push(`- Active: ${swAfter.active}`);
  lines.push("");

  lines.push("Install Prompt:");
  lines.push("- If 'Install App' button never appears, Chrome did NOT fire beforeinstallprompt.");
  lines.push("- Common causes: page not controlled by SW, manifest invalid/unreachable, or Chrome suppressed prompt.");
  lines.push("- Try Chrome menu (⋮) → Install app / Add to Home screen.");
  lines.push("");

  printDebug(lines);
}

function wireInstallButton() {
  const installBtn = $("installBtn");
  if (!installBtn) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = "inline-block";
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    installBtn.disabled = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = "none";
  });

  window.addEventListener("appinstalled", () => {
    installBtn.style.display = "none";
  });
}

async function resetPwa() {
  // Unregister all service workers + clear caches
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

  // Hard reload
  location.reload(true);
}

function wireResetButton() {
  const btn = $("resetPwaBtn");
  if (!btn) return;
  btn.addEventListener("click", () => resetPwa());
}

window.addEventListener("load", async () => {
  wireInstallButton();
  wireResetButton();
  await runDiagnostics();
});
