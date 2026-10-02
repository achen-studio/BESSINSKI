"use client";

import { useRef } from "react";

export function BessLyrics({ lyrics }: { lyrics: string }) {
  const root = useRef<HTMLDivElement>(null);
  const verses = lyrics.split("\n\n");
  return <div className="bess-lyrics">
    <h2>Lyrics :</h2>
    <div ref={root} className="bess-lyrics-lens" onPointerMove={event => {
      if (event.pointerType === "touch" || !root.current) return;
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
