"use client";

import { useEffect, useRef } from "react";

export function BessLyrics({ lyrics, songSlug }: { lyrics: string; songSlug?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (songSlug !== "laisse-aller" && songSlug !== "rever-tue" && songSlug !== "sormoi2moi" && songSlug !== "le-ciel-pleure-de-lor") return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const animation = songSlug !== "laisse-aller"
      ? import("./scattered-lyrics-test").then(module => (element: HTMLDivElement) => module.mountScatteredLyrics(element, songSlug === "le-ciel-pleure-de-lor" ? "gravity" : songSlug === "sormoi2moi" ? "rotate" : "scatter"))
      : import("./portrait-lyrics-test").then(module => module.mountPortraitTest);
    animation.then(async (mount) => {
      if (cancelled || !root.current) return;
      const cleanup = await mount(root.current);
      if (cancelled) cleanup();
      else dispose = cleanup;
    }).catch(() => { /* Keep the original text if the optional prototype fails. */ });
    return () => { cancelled = true; dispose?.(); };
  }, [songSlug, lyrics]);
  const verses = lyrics.split("\n\n");
  return <div className="bess-lyrics">
    <h2>Paroles :</h2>
    <div ref={root} className="bess-lyrics-lens" onPointerMove={event => {
      if (event.pointerType === "touch" || !root.current || root.current.dataset.portrait === "ready") return;
      const rect = root.current.getBoundingClientRect();
      root.current.style.setProperty("--lens-x", `${event.clientX - rect.left}px`);
      root.current.style.setProperty("--lens-y", `${event.clientY - rect.top}px`);
      root.current.dataset.active = "true";
    }} onPointerLeave={() => { if (root.current) delete root.current.dataset.active; }}>
      <div className="bess-lyrics-base">{verses.map((verse, index) => <p key={index}>{verse}</p>)}</div>
      <div className="bess-lyrics-clear" aria-hidden="true">{verses.map((verse, index) => <p key={index}>{verse}</p>)}</div>
    </div>
  </div>;
}
