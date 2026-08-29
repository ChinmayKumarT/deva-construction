import Image from "next/image";

export const metadata = {
  title: "Install App — Deva Construction",
  description: "Install the Deva Construction app on your phone or desktop.",
};

export default function DownloadPage() {
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

        <a
          href="https://deva-demo.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition"
        >
          Open Deva Construction
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
        </a>
        <p className="mt-2 text-xs text-slate-400">Open the link above, then follow the steps below to install it as an app.</p>

        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 text-left">
          <h2 className="text-sm font-semibold text-ink">Android (Chrome)</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
            <li>Open <span className="font-medium text-brand-700">deva-demo.vercel.app</span> in Chrome.</li>
            <li>Tap the <span className="font-medium">Install app</span> banner at the top, or tap the <span className="font-medium">three-dot menu → Install app</span>.</li>
            <li>Tap <span className="font-medium">Install</span> — the app icon appears on your home screen.</li>
          </ol>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-6 text-left">
          <h2 className="text-sm font-semibold text-ink">iPhone (Safari)</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
            <li>Open <span className="font-medium text-brand-700">deva-demo.vercel.app</span> in Safari.</li>
            <li>Tap the <span className="font-medium">Share</span> button (square with arrow).</li>
            <li>Scroll down and tap <span className="font-medium">Add to Home Screen</span>.</li>
            <li>Tap <span className="font-medium">Add</span> — the app icon appears on your home screen.</li>
          </ol>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-6 text-left">
          <h2 className="text-sm font-semibold text-ink">Desktop (Chrome / Edge)</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
            <li>Open <span className="font-medium text-brand-700">deva-demo.vercel.app</span> in Chrome or Edge.</li>
            <li>Click the <span className="font-medium">install icon</span> in the address bar (or three-dot menu → Install).</li>
            <li>Click <span className="font-medium">Install</span> — the app opens in its own window.</li>
          </ol>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          The app runs directly from the web — it&apos;s always the latest version, no updates needed.
        </p>
      </div>
    </main>
  );
}
