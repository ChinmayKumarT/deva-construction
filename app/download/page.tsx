import Image from "next/image";

export const metadata = {
  title: "Download — Deva Construction",
  description: "Download the Deva Construction Android app.",
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
          Download the Android app to manage projects, materials, labour, and payments on the go.
        </p>

        <a
          href="/downloads/deva-construction.apk"
          download
          className="mt-8 inline-block w-full rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition"
        >
          Download for Android
        </a>

        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 text-left">
          <h2 className="text-sm font-semibold text-ink">How to install</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
            <li>Tap the download button above and let the file finish downloading.</li>
            <li>
              Open it. Android will likely show a warning like{" "}
              <span className="italic">
                &ldquo;For your security, your phone isn&apos;t allowed to install unknown
                apps from this source.&rdquo;
              </span>{" "}
              Tap <span className="font-medium">Settings</span>, then turn on{" "}
              <span className="font-medium">Allow from this source</span>.
            </li>
            <li>Go back and tap <span className="font-medium">Install</span>.</li>
          </ol>
          <p className="mt-4 text-xs text-slate-500">
            iPhone can&apos;t install this file — visit this site in Safari instead and use{" "}
            <span className="italic">Share → Add to Home Screen</span> for an app-like experience.
          </p>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          This is a debug build for testing, not yet a signed Play Store release.
        </p>
      </div>
    </main>
  );
}
