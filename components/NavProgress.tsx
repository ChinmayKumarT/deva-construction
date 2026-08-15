"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPath = useRef(pathname);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    setProgress(100);
    timers.current.push(setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300));
  }, [clearTimers]);

  useEffect(() => {
    if (pathname !== prevPath.current) {
      finish();
      prevPath.current = pathname;
    }
  }, [pathname, finish]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http")) return;
      if (href === pathname) return;

      clearTimers();
      setVisible(true);
      setProgress(20);
      timers.current.push(setTimeout(() => setProgress(40), 80));
      timers.current.push(setTimeout(() => setProgress(60), 200));
      timers.current.push(setTimeout(() => setProgress(75), 500));
      timers.current.push(setTimeout(() => setProgress(85), 1500));
      timers.current.push(setTimeout(() => finish(), 8000));
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname, clearTimers, finish]);

  if (!visible && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none">
      <div
        className="h-full bg-brand transition-all ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
          transitionDuration: progress >= 100 ? "300ms" : "200ms",
        }}
      />
    </div>
  );
}
