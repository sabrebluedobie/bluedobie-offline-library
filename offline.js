"use strict";
const OFFLINE_BUILD = "2026-11-09.3";
const diagnostic = window.offlineDiagnostic = {
  build: OFFLINE_BUILD,
  page: window.location ? window.location.origin + window.location.pathname : "unknown",
  mode: navigator.standalone || window.matchMedia?.("(display-mode: standalone)").matches ? "Home Screen app" : "browser tab",
  networkReportedOnline: navigator.onLine,
  controllerAtStart: navigator.serviceWorker?.controller?.scriptURL || "none",
  registration: "not checked"
};
try { diagnostic.previousVerification = JSON.parse(window.localStorage.getItem("offline-last-verification") || "null"); } catch (_) { diagnostic.previousVerification = "unavailable"; }
// Resolve with a result (never an unhandled rejection); loading data is not proof of caching.
window.offlineReady = (async () => {
  let timer;
  try {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) {
      throw new Error("Use HTTPS or localhost in a browser supporting offline apps.");
    }
    const setup = async () => {
      // Reuse the installed controller first. Safari may fetch sw.js during register(),
      // which can fail and raise a network prompt on an otherwise cached offline launch.
      if (!navigator.serviceWorker.controller) {
        // Match the actual launch URL, including Home Screen launches without a trailing slash.
        const existing = await navigator.serviceWorker.getRegistration();
        diagnostic.registration = existing ? {scope: existing.scope, active: existing.active?.state || null, waiting: existing.waiting?.state || null, installing: existing.installing?.state || null} : "none for this page";
        if (!existing?.active && !existing?.waiting && !existing?.installing) {
          if (navigator.onLine === false) {
            throw new Error("No installed offline worker is available. Open this app online once to finish setup.");
          }
          await navigator.serviceWorker.register("./sw.js");
        }
        await navigator.serviceWorker.ready;
        await new Promise(resolve => {
          const changed = () => {
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.removeEventListener("controllerchange", changed);
              resolve();
            }
          };
          navigator.serviceWorker.addEventListener("controllerchange", changed);
          changed();
        });
      }
      const result = await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => {
          channel.port1.close();
          event.data && event.data.ok ? resolve(event.data) : reject(new Error("Some offline files are missing. Reopen online to repair the cache."));
        };
        // Ask the worker actually controlling this page, not an unrelated waiting update.
        navigator.serviceWorker.controller.postMessage({type: "CHECK_OFFLINE", allowRepair: navigator.onLine !== false}, [channel.port2]);
      });
      diagnostic.controllerAfterSetup = navigator.serviceWorker.controller?.scriptURL || "none";
      diagnostic.cache = result.cache || "verified";
      diagnostic.verifiedAt = new Date().toISOString();
      try { window.localStorage.setItem("offline-last-verification", JSON.stringify({build: OFFLINE_BUILD, at: diagnostic.verifiedAt, mode: diagnostic.mode, page: diagnostic.page, cache: diagnostic.cache})); } catch (_) {}
      return result;
    };
    return await Promise.race([
      setup(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Offline setup did not finish. Stay online and reload before relying on this app.")), 20000); })
    ]);
  } catch (error) {
    diagnostic.error = error.message;
    return {ok: false, error: error.message};
  } finally {
    clearTimeout(timer);
  }
})();
