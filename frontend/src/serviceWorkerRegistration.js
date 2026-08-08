// Registers the service worker in production builds only, so local dev
// (yarn start) never serves stale cached bundles.
export function register() {
  if (process.env.NODE_ENV !== "production") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL}/service-worker.js`)
      .catch(() => {
        // Installability/offline caching is a nice-to-have — a failed
        // registration should never block the app from working.
      });
  });
}
