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

        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 text-left">
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
