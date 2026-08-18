import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Page not found — Deva Construction",
  description: "The page you're looking for doesn't exist. Head back to sign in.",
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6 py-16">
      <div className="w-full max-w-md text-center">
        <Image
          src="/icon.png"
          alt=""
          width={72}
          height={72}
          className="mx-auto rounded-2xl"
          style={{ objectFit: "contain" }}
        />
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Error 404
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink">
          This page took an unscheduled break.
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          We couldn't find what you were looking for. It may have moved, been renamed, or never
          existed in the first place.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="w-full rounded-lg px-4 py-2.5 font-medium text-white transition hover:opacity-90 active:opacity-80"
            style={{ backgroundColor: "#6257F6" }}
          >
            Back to sign in
          </Link>
          <Link
            href="/download"
            className="w-full rounded-lg bg-white px-4 py-2.5 font-medium transition hover:bg-slate-50"
            style={{ border: "1px solid #D9DFEA", color: "#3F4654" }}
          >
            Download the Android app
          </Link>
        </div>
      </div>
    </main>
  );
}
