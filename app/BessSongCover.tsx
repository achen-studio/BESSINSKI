"use client";

import { useLayoutEffect, useRef } from "react";
import { Photo } from "./BessShared";
import { clearParkedCover, parkedCover } from "./cover-handoff";

export function BessSongCover({ name, alt }: { name: string; alt: string }) {
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const canvas = parkedCover();
    const root = slot.current;
    if (!canvas || !root) return;
    root.prepend(canvas);
    const image = root.querySelector("img");
    const drop = () => requestAnimationFrame(() => requestAnimationFrame(() => clearParkedCover()));
    if (image && image.complete && image.naturalWidth > 0) drop();
    else image?.addEventListener("load", drop, { once: true });
    return () => image?.removeEventListener("load", drop);
  }, []);
  return <div ref={slot} className="bess-song-cover-slot">
    <Photo name={name} alt={alt} className="bess-song-hero-image" eager decoding="sync" />
  </div>;
}
