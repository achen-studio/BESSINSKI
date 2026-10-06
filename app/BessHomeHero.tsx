"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Circle } from "lucide-react";
import { BessHeader, Photo } from "./BessShared";
import { BessLetters } from "./BessLetters";
import { BessHeroBackdrop, type HeroBackdropHandle } from "./BessHeroBackdrop";
import { heroSlides, initialHeroSlide } from "./hero-slides";
import type { createHeroScene } from "./hero-scene";

export function BessHomeHero() {
  const [active, setActive] = useState<number>(initialHeroSlide);
  const [ready, setReady] = useState(false);
  const backdrop = useRef<HeroBackdropHandle>(null);
  const activeRef = useRef<number>(initialHeroSlide);
  const hero = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cover = useRef<HTMLAnchorElement>(null);
  const scene = useRef<ReturnType<typeof createHeroScene> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const selected = heroSlides[active];

  const prepareNavigation = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (href.startsWith('/son') && hero.current) hero.current.dataset.navigating = 'true';
  };

  useEffect(() => {
    const reset = () => { if (hero.current) delete hero.current.dataset.navigating; };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  useEffect(() => {
    const element = hero.current;
    if (!element) return;
    const measure = () => {
      element.querySelectorAll<HTMLElement>('.bess-featured-caption').forEach(caption => {
        const lines = Array.from(caption.querySelectorAll<HTMLElement>('.bess-title-line>span'));
        const widths = lines.map(line => parseFloat(getComputedStyle(line).width));
        const width = Math.min(caption.getBoundingClientRect().width, Math.max(...widths));
        lines.forEach((line, index) => line.style.setProperty('--line-scale', `${width / Math.max(1, widths[index])}`));
        caption.style.setProperty('--title-width', `${width}px`);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    let alive = true;
    document.fonts.ready.then(() => { if (alive) measure(); });
    measure();
    return () => { alive = false; observer.disconnect(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    import("./hero-scene").then(({ createHeroScene }) => {
      if (cancelled || !canvas.current || !hero.current || !cover.current) return;
      scene.current = createHeroScene(canvas.current, hero.current, cover.current, heroSlides.map(slide => `/bess/${slide.image}.webp`), activeRef.current, setReady, (timeline, index, reduced) => backdrop.current?.select(timeline, index, reduced));
    }).catch(() => { /* The accessible image slider remains usable without WebGL. */ });
    return () => { cancelled = true; scene.current?.destroy(); scene.current = null; };
  }, []);

  const select = (index: number, direction?: number) => {
    if (activeRef.current === index) return;
    activeRef.current = index;
    setActive(index);
    if (scene.current) scene.current.select(index, direction);
    else backdrop.current?.select(null, index, true);
  };
  const move = (direction: number) => select((activeRef.current + direction + heroSlides.length) % heroSlides.length, direction);

  return (
    <section ref={hero} className="bess-home-hero" data-renderer={ready ? "webgl" : "image"} aria-label="Sélection musicale" aria-roledescription="carrousel">
      <BessHeroBackdrop ref={backdrop} cover={cover} hero={hero} />
      <div className="bess-hero-shade" />
      <BessHeader />
      <canvas ref={canvas} className="bess-hero-canvas" aria-hidden="true" />
      <div className="bess-featured"
        onTouchStart={event => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; swiped.current = false; }}
        onTouchEnd={event => {
          if (touchStart.current) {
            const dx = touchStart.current.x - event.changedTouches[0].clientX;
            const dy = touchStart.current.y - event.changedTouches[0].clientY;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { swiped.current = true; move(dx > 0 ? 1 : -1); }
          }
          touchStart.current = null;
        }}
        onTouchCancel={() => { touchStart.current = null; }}
        onClickCapture={event => { if (swiped.current) { event.preventDefault(); swiped.current = false; } }}>
        <a ref={cover} href={selected.href} onClick={event => prepareNavigation(event, selected.href)} style={{ viewTransitionName: selected.href.startsWith('/son') ? 'bess-song-cover' : 'none' }} className="bess-featured-image" aria-label={`Découvrir ${selected.title}`}><Photo name={selected.image} eager /></a>
        <div className="bess-caption-stack">
          {heroSlides.map((slide, index) => <div key={slide.image} className={`bess-featured-caption bess-caption-${slide.layout}`} data-active={active === index} aria-hidden={active !== index} inert={active !== index}>
            <h1 aria-label={slide.title}><a href={slide.href} onClick={event => prepareNavigation(event, slide.href)}>{slide.lines.map((line, lineIndex) => <span className="bess-title-line" key={line}><span className={lineIndex > 0 ? "bess-title-secondary" : ""}><BessLetters text={line} /></span></span>)}</a></h1>
            <div className="bess-featured-meta"><span><BessLetters text="Réal. Kevin Besse" /></span><time dateTime="2024-06-21"><BessLetters text="21 JUIN 2024" /></time></div>
          </div>)}
        </div>
      </div>
      <p className="bess-sr-only" role="status" aria-live="polite">{selected.title}</p>
      <button className="bess-carousel-arrow bess-carousel-prev" onClick={() => move(-1)} aria-label="Sélection précédente" title="Sélection précédente"><Circle aria-hidden="true" /></button>
      <button className="bess-carousel-arrow bess-carousel-next" onClick={() => move(1)} aria-label="Sélection suivante" title="Sélection suivante"><Circle aria-hidden="true" /></button>
      <div className="bess-thumbnails" role="group" aria-label="Choisir un titre">
        {heroSlides.map((slide, index) => <button key={slide.image} onPointerEnter={event => { if (event.pointerType !== "touch") select(index); }} onFocus={() => select(index)} onClick={() => {
          select(index);
          if (slide.href.startsWith('/son') && hero.current) hero.current.dataset.navigating = 'true';
          window.location.assign(slide.href);
        }} onKeyDown={event => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            const direction = event.key === "ArrowRight" ? 1 : -1;
            const next = (activeRef.current + direction + heroSlides.length) % heroSlides.length;
            select(next, direction);
            event.currentTarget.parentElement?.querySelectorAll("button")[next].focus();
          }
        }} aria-label={`Afficher ${slide.title}`} aria-pressed={active === index} title={slide.title}>
          <span className="bess-thumbnail-image"><Photo name={slide.image} /><span className="bess-thumbnail-marker">play</span>{index === 1 && <span className="bess-thumbnail-new">new</span>}</span>
          <span className="bess-thumbnail-line" />
        </button>)}
      </div>
    </section>
  );
}
