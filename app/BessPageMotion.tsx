"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function BessPageMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = scope.querySelectorAll<HTMLElement>("[data-reveal], [data-hero-reveal]");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (entry.target instanceof HTMLElement && entry.target.hasAttribute("data-hero-reveal")) {
            entry.target.style.setProperty("--hero-delay", `${Math.max(0, 900 - performance.now())}ms`);
          }
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -24px 0px" });
    const update = () => { scope.dataset.motion = reduced.matches ? "reduced" : "ready"; };
    update();
    elements.forEach(element => observer.observe(element));
    reduced.addEventListener("change", update);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", update);
      delete scope.dataset.motion;
    };
  }, []);
  return <div ref={root} className="bess-page-motion">{children}</div>;
}
