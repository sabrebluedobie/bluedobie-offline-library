"use strict";
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
        const existing = await navigator.serviceWorker.getRegistration("./");
        if (!existing?.active) {
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
      return result;
    };
    return await Promise.race([
      setup(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Offline setup did not finish. Stay online and reload before relying on this app.")), 20000); })
    ]);
  } catch (error) {
    return {ok: false, error: error.message};
  } finally {
    clearTimeout(timer);
  }
})();
