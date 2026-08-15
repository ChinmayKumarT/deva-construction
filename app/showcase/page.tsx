"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-page 3D sliding showcase for Deva Construction.
 *
 * A vertical stack of full-screen panels. As you scroll (or use the dots /
 * arrow keys / wheel), the outgoing panel tilts back and recedes in 3D while
 * the incoming one rotates forward into place -- a "flipping slab" motion that
 * fits a construction brand. Pure CSS 3D transforms driven by scroll position,
 * no libraries. Palette + Fraunces serif match the rest of the app.
 */

type Panel = {
  eyebrow: string;
  title: string;
  body: string;
  stat?: { value: string; label: string }[];
  tone: "dark" | "brand" | "cream";
};

const PANELS: Panel[] = [
  {
    eyebrow: "Deva Construction",
    title: "We build with precision.",
    body:
      "Residential, commercial and civic work delivered on schedule — planned, tracked and handed over from a single platform.",
    tone: "dark",
  },
  {
    eyebrow: "What we do",
    title: "Ground to handover, in-house.",
    body:
      "Structure, fit-out, and site management under one roof. Every trade coordinated, every material accounted for, every day logged.",
    stat: [
      { value: "40+", label: "Projects delivered" },
      { value: "12", label: "Site teams" },
    ],
    tone: "brand",
  },
  {
    eyebrow: "Recent work",
    title: "Meridian Row & Foundry Street.",
    body:
      "Fourteen terraced homes in cross-laminated timber, and the adaptive reuse of a 1920s iron works into six floors of workspace.",
    stat: [
      { value: "14", label: "Homes" },
      { value: "48k", label: "Sq ft reused" },
    ],
    tone: "cream",
  },
  {
    eyebrow: "How we run it",
    title: "One screen for every site.",
    body:
      "Projects, materials, labour and payments live in one place — for admin, manager, client and supplier alike. No spreadsheets, no guesswork.",
    stat: [
      { value: "100%", label: "Digital records" },
      { value: "24/7", label: "Client access" },
    ],
    tone: "dark",
  },
  {
    eyebrow: "Start here",
    title: "Let's build your project.",
    body:
      "Bring your plans — we'll handle the rest. Sign in to your dashboard or download the app to follow every site in real time.",
    tone: "brand",
  },
];

const TONES: Record<
  Panel["tone"],
  { bg: string; fg: string; sub: string; accent: string; line: string }
> = {
  dark: {
    bg: "#242424",
    fg: "#ffffff",
    sub: "rgba(255,255,255,0.72)",
    accent: "#93b6de",
    line: "rgba(255,255,255,0.14)",
  },
  brand: {
    bg: "#395580",
    fg: "#ffffff",
    sub: "rgba(255,255,255,0.82)",
    accent: "#dce7f3",
    line: "rgba(255,255,255,0.18)",
  },
  cream: {
    bg: "#e8e1da",
    fg: "#232323",
    sub: "#5b5751",
    accent: "#5c89c4",
    line: "rgba(35,35,35,0.12)",
  },
};

export default function ShowcasePage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  // Drive the 3D transforms from scroll position.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ticking = false;

    const apply = () => {
      ticking = false;
      const h = scroller.clientHeight || 1;
      let nearest = 0;
      let nearestDist = Infinity;

      panelRefs.current.forEach((el, i) => {
        if (!el) return;
        const inner = el.firstElementChild as HTMLElement | null;
        // p = how far this panel's top is from the top of the viewport,
        // in units of one viewport height. 0 = perfectly in place.
        const p = (el.offsetTop - scroller.scrollTop) / h;

        if (Math.abs(p) < nearestDist) {
          nearestDist = Math.abs(p);
          nearest = i;
        }

        if (inner) {
          if (reduce) {
            inner.style.transform = "none";
            inner.style.opacity = Math.abs(p) > 0.9 ? "0.2" : "1";
          } else {
            const clamped = Math.max(-1, Math.min(1, p));
            const rot = clamped * -34; // tilt back as it leaves upward
            const tz = -Math.abs(clamped) * 340; // recede in Z
            const ty = clamped * 8; // slight vertical drift (%)
            const opacity = 1 - Math.min(Math.abs(clamped), 1) * 0.55;
            inner.style.transform = `translateY(${ty}%) translateZ(${tz}px) rotateX(${rot}deg)`;
            inner.style.opacity = String(opacity);
          }
        }
      });

      setActive(nearest);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    };

    apply();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", apply);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", apply);
    };
  }, []);

  const goto = (i: number) => {
    const scroller = scrollRef.current;
    const el = panelRefs.current[i];
    if (!scroller || !el) return;
    scroller.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  };

  // Arrow-key navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goto(Math.min(active + 1, PANELS.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goto(Math.max(active - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <main className="fixed inset-0 bg-[#242424] text-white">
      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 sm:px-10">
        <a
          href="/"
          className="pointer-events-auto flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="inline-block h-2.5 w-7 -skew-x-12 bg-brand" />
          <span className="mix-blend-difference">Deva Construction</span>
        </a>
        <a
          href="/"
          className="pointer-events-auto rounded-lg border border-white/25 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
        >
          Sign in
        </a>
      </header>

      {/* Scroll deck */}
      <div
        ref={scrollRef}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll"
        style={{ perspective: "1400px", perspectiveOrigin: "50% 45%" }}
      >
        {PANELS.map((panel, i) => {
          const t = TONES[panel.tone];
          return (
            <section
              key={i}
              ref={(el) => {
                panelRefs.current[i] = el;
              }}
              className="relative h-full w-full snap-start"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div
                className="absolute inset-0 flex flex-col justify-center px-6 sm:px-16 lg:px-28"
                style={{
                  background: t.bg,
                  color: t.fg,
                  transformStyle: "preserve-3d",
                  transformOrigin: "50% 0%",
                  transition:
                    "transform 0.15s linear, opacity 0.15s linear",
                  willChange: "transform, opacity",
                  backgroundImage:
                    "linear-gradient(" +
                    t.line +
                    " 1px, transparent 1px), linear-gradient(90deg, " +
                    t.line +
                    " 1px, transparent 1px)",
                  backgroundSize: "clamp(40px, 6vw, 72px) clamp(40px, 6vw, 72px)",
                }}
              >
                <div className="mx-auto w-full max-w-3xl">
                  <p
                    className="mb-4 font-mono text-xs uppercase tracking-[0.2em]"
                    style={{ color: t.accent }}
                  >
                    {String(i + 1).padStart(2, "0")} — {panel.eyebrow}
                  </p>
                  <h1
                    className="font-serif text-4xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl"
                    style={{ textWrap: "balance" }}
                  >
                    {panel.title}
                  </h1>
                  <p
                    className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
                    style={{ color: t.sub }}
                  >
                    {panel.body}
                  </p>

                  {panel.stat && (
                    <div
                      className="mt-10 flex gap-10 border-t pt-6"
                      style={{ borderColor: t.line }}
                    >
                      {panel.stat.map((s) => (
                        <div key={s.label} className="flex flex-col">
                          <span
                            className="font-serif text-3xl font-semibold tabular-nums sm:text-4xl"
                            style={{ color: t.fg }}
                          >
                            {s.value}
                          </span>
                          <span
                            className="mt-1 text-xs uppercase tracking-[0.15em]"
                            style={{ color: t.sub }}
                          >
                            {s.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {i === PANELS.length - 1 && (
                    <div className="mt-10 flex flex-wrap gap-3">
                      <a
                        href="/?mode=signup"
                        className="rounded-lg bg-white px-5 py-2.5 font-medium text-[#395580] transition hover:bg-white/90"
                      >
                        Start a project
                      </a>
                      <a
                        href="/download"
                        className="rounded-lg border border-white/40 px-5 py-2.5 font-medium text-white transition hover:bg-white/10"
                      >
                        Download app
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Dot rail */}
      <nav
        aria-label="Sections"
        className="absolute right-5 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3 sm:right-8"
      >
        {PANELS.map((_, i) => (
          <button
            key={i}
            onClick={() => goto(i)}
            aria-label={`Go to section ${i + 1}`}
            aria-current={active === i}
            className="group flex items-center gap-2"
          >
            <span
              className={
                "block rounded-full transition-all duration-300 " +
                (active === i
                  ? "h-2.5 w-2.5 bg-brand"
                  : "h-2 w-2 bg-white/40 group-hover:bg-white/70")
              }
            />
          </button>
        ))}
      </nav>

      {/* Scroll hint */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
        <span
          className={
            "font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 transition-opacity duration-500 " +
            (active === 0 ? "opacity-100" : "opacity-0")
          }
        >
          Scroll ↓
        </span>
      </div>
    </main>
  );
}
