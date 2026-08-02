"use client";

import { useEffect } from "react";

// Registration only -- the actual caching behavior (deliberately minimal)
// lives in public/sw.js.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
