let deferredPrompt = null;

function $(id) { return document.getElementById(id); }

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

async function checkManifest() {
  try {
    const res = await fetch("/manifest.json", { cache: "no-store" });
    const ok = res.ok;
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    return { ok, contentType: ct, bytes: text.length };
  } catch (e) {
    return { ok: false, contentType: "", bytes: 0, error: String(e) };
  }
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

async function forceSwControlOnce() {
  // If not controlled yet, ask SW to claim and reload once.
  if (!("serviceWorker" in navigator)) return;

  const alreadyTried = sessionStorage.getItem("forceSwControlTried") === "1";
  const controlled = !!navigator.serviceWorker.controller;

  if (controlled || alreadyTried) return;

  sessionStorage.setItem("forceSwControlTried", "1");

  // Message active SW to claim clients
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (reg && reg.active) {
      reg.active.postMessage({ type: "CLAIM_CLIENTS" });
      reg.active.postMessage({ type: "SKIP_WAITING" });
    }
  } catch {}

  // Reload after a brief tick
  setTimeout(() => location.reload(), 500);
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

  const mf = await checkManifest();
  lines.push("Manifest (/manifest.json):");
  lines.push(`- Fetch OK: ${mf.ok}`);
  lines.push(`- Content-Type: ${mf.contentType || "(none)"}`);
  lines.push(`- Size (bytes): ${mf.bytes}`);
  if (mf.error) lines.push(`- Error: ${mf.error}`);
  lines.push("");

  const swBefore = await getSwInfo();
  lines.push("Service Worker:");
  lines.push(`- Supported: ${swBefore.supported}`);
  lines.push(`- Controller (page is controlled): ${swBefore.controller}`);
  lines.push(`- Existing Reg Scope: ${swBefore.scope}`);
  lines.push(`- Active: ${swBefore.active}`);
  if (swBefore.error) lines.push(`- Error: ${swBefore.error}`);
  lines.push("");

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
  lines.push("- This typically requires Controller=true (page controlled by SW) on Android.");
  lines.push("- If prompt is suppressed, Chrome menu (⋮) may still show Install.");
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
  // Clear caches + unregister SW
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

  sessionStorage.removeItem("forceSwControlTried");
  location.reload();
}

function wireResetButton() {
  const btn = $("resetPwaBtn");
  if (!btn) return;
  btn.addEventListener("click", () => resetPwa());
}

window.addEventListener("load", async () => {
  wireInstallButton();
  wireResetButton();

  // Force SW to take control (once) if needed
  await forceSwControlOnce();

  // Then run diagnostics
  await runDiagnostics();
});
