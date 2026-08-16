"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (process.env.NODE_ENV === "development") {
          console.log("[SW] registered, scope:", reg.scope);
        }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
              if (process.env.NODE_ENV === "development") {
                console.log("[SW] new version activated");
              }
            }
          });
        });
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[SW] registration failed:", err);
        }
      });
  }, []);

  return null;
}
