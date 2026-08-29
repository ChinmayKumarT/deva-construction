"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function DownloadPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6 py-12">
      <div className="w-full max-w-md text-center">
        <Image
          src="/icon.png" alt="" width={80} height={80}
          className="mx-auto rounded-2xl" style={{ objectFit: "contain" }}
        />
        <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-ink">
          Deva Construction
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Install the app on your phone or desktop — no app store needed, always up to date.
        </p>

        {installed ? (
          <div className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            App installed
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstall}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12M12 16.5V3" /></svg>
            Install App
          </button>
        ) : (
          <a
            href="https://deva-demo.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition"
          >
            Open Deva Construction
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
          </a>
        )}

        {!installed && !deferredPrompt && (
          <p className="mt-2 text-xs text-slate-400">
            {isIOS
              ? "Tap the button above, then use Share → Add to Home Screen in Safari."
              : "Open the link above in Chrome, then tap the install banner or use the menu → Install app."}
          </p>
        )}

        {!installed && (
          <>
            <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 text-left">
              <h2 className="text-sm font-semibold text-ink">Android (Chrome)</h2>
              <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>Open <span className="font-medium text-brand-700">deva-demo.vercel.app</span> in Chrome.</li>
                <li>Tap the <span className="font-medium">Install app</span> banner, or tap <span className="font-medium">⋮ menu → Install app</span>.</li>
                <li>Tap <span className="font-medium">Install</span> — the app icon appears on your home screen.</li>
              </ol>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-6 text-left">
              <h2 className="text-sm font-semibold text-ink">iPhone (Safari)</h2>
              <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>Open <span className="font-medium text-brand-700">deva-demo.vercel.app</span> in Safari.</li>
                <li>Tap the <span className="font-medium">Share</span> button (square with arrow).</li>
                <li>Tap <span className="font-medium">Add to Home Screen → Add</span>.</li>
              </ol>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-6 text-left">
              <h2 className="text-sm font-semibold text-ink">Desktop (Chrome / Edge)</h2>
              <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>Open <span className="font-medium text-brand-700">deva-demo.vercel.app</span> in Chrome or Edge.</li>
                <li>Click the <span className="font-medium">install icon</span> in the address bar.</li>
                <li>Click <span className="font-medium">Install</span> — the app opens in its own window.</li>
              </ol>
            </div>
          </>
        )}

        <p className="mt-6 text-xs text-slate-400">
          The app runs directly from the web — it&apos;s always the latest version, no updates needed.
        </p>
      </div>
    </main>
  );
}
