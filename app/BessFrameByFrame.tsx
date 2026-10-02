"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function BessFrameByFrame({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const section = root.current;
    const media = video.current;
    if (!section || !media) return;
    let alive = true;
    const fitTitle = () => {
      if (!alive) return;
      const heading = section.querySelector<HTMLElement>('#about-heading');
      if (!heading) return;
      const widths = Array.from(heading.querySelectorAll<HTMLElement>(':scope > .bess-letter-word')).map(line => line.offsetWidth);
      const widest = Math.max(...widths);
      if (widest > 0) heading.style.fontSize = `${parseFloat(getComputedStyle(heading).fontSize) * heading.clientWidth / widest}px`;
    };
    document.fonts.ready.then(fitTitle);
    window.addEventListener('resize', fitTitle);
    gsap.registerPlugin(ScrollTrigger);
    const motion = gsap.matchMedia();
    let target = 0;
    const seek = () => {
      if (!media.seeking && Number.isFinite(media.duration) && media.duration > 0) {
        const time = target * Math.max(0, media.duration - 1 / 30);
        if (Math.abs(media.currentTime - time) > 1 / 60) media.currentTime = time;
      }
    };
    media.addEventListener("loadedmetadata", seek);
    media.addEventListener("seeked", seek);
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      const progress = { value: 0 };
      const timeline = gsap.timeline({ scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: .3, invalidateOnRefresh: true } });
      timeline.to(progress, { value: 1, duration: 1, ease: "none", onUpdate: () => { target = progress.value; seek(); } }, 0);
      section.querySelectorAll<HTMLElement>("[data-frame-reveal]").forEach((group, index) => {
        timeline.fromTo(group, { autoAlpha: 0, filter: "blur(24px)", y: () => Math.min(window.innerHeight * .35, 300), scaleY: 1.65, transformOrigin: "center bottom" }, { autoAlpha: 1, filter: "blur(0px)", y: 0, scaleY: 1, duration: .2, ease: "power3.out" }, .05 + index * .115);
      });
      return () => { timeline.scrollTrigger?.kill(); timeline.kill(); };
    }, section);
    return () => { alive = false; window.removeEventListener('resize', fitTitle); motion.revert(); media.removeEventListener("loadedmetadata", seek); media.removeEventListener("seeked", seek); };
  }, []);
  return <section ref={root} className="bess-frame-section" id="about" aria-labelledby="about-heading">
    <noscript><style>{'.bess-frame-scene [data-frame-reveal]{opacity:1!important;visibility:visible!important}'}</style></noscript>
    <div className="bess-about bess-frame-scene">
      <video ref={video} className="bess-frame-video" src="/bess/framebyframe.mp4" poster="/bess/portrait.webp" muted playsInline preload="auto" aria-hidden="true" />
      {children}
    </div>
  </section>;
}
