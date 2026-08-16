"use client";

import { useEffect, useState } from "react";

function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

const DISMISS_KEY = "deva-ios-install-dismissed";

export function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOSSafari() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-sm rounded-xl border border-[var(--line)] bg-white p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <img src="/icon.png" alt="" className="h-10 w-10 rounded-lg shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm text-slate-900">Install Deva Construction</div>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
              Tap{" "}
              <svg className="inline-block h-4 w-4 align-text-bottom" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>{" "}
              then <strong>&ldquo;Add to Home Screen&rdquo;</strong> for full-screen access.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
