"use client";

/* eslint-disable react-hooks/immutability, react-hooks/refs -- DOM refs form an imperative animation registry. */

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

const images = ["/gallery-01.jpg", "/gallery-02.jpg", "/gallery-03.jpg"];
const stripCount = 28;

type CardRefs = {
  root: HTMLDivElement | null;
  sheet: HTMLDivElement | null;
  shadow: HTMLDivElement | null;
  strips: Array<HTMLDivElement | null>;
};

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function signedDistance(index: number, position: number) {
  return modulo(position - index + 1.5, images.length) - 1.5;
}

function heldPosition(position: number) {
  const cycle = Math.floor(position);
  const local = position - cycle;
  const hold = 0.2;

  if (local <= hold) return cycle;
  if (local >= 1 - hold) return cycle + 1;

  return cycle + smoothstep((local - hold) / (1 - hold * 2));
}

function AlbumCard({
  image,
  index,
  refs,
}: {
  image: string;
  index: number;
  refs: CardRefs;
}) {
  const strips = useMemo(() => Array.from({ length: stripCount }), []);

  return (
    <div
      className="album-card"
      ref={(element) => {
        refs.root = element;
      }}
      data-index={index}
      style={{ "--card-image": `url(${image})` } as CSSProperties}
    >
      <div
        className="album-shadow"
        ref={(element) => {
          refs.shadow = element;
        }}
      />
      <div
        className="album-sheet"
        ref={(element) => {
          refs.sheet = element;
        }}
      >
        {strips.map((_, stripIndex) => {
          const width = 100 / stripCount;
          return (
            <div
              className="album-strip"
              key={stripIndex}
              ref={(element) => {
                refs.strips[stripIndex] = element;
              }}
              style={{
                left: `calc(${(stripIndex * width).toFixed(5)}% - 1px)`,
                width: `calc(${width.toFixed(5)}% + 2px)`,
              }}
            >
              <div className="album-face album-front">
                <div
                  className="album-art"
                  style={{
                    width: `${stripCount * 100}%`,
                    left: `${-stripIndex * 100}%`,
                  }}
                />
                <div className="album-shade" />
                <div className="album-glow" />
              </div>
              <div className="album-face album-back">
                <div
                  className="album-art"
                  style={{
                    width: `${stripCount * 100}%`,
                    left: `${-stripIndex * 100}%`,
                  }}
                />
                <div className="album-shade" />
                <div className="album-glow" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ThreeCardGallery() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<CardRefs[]>(
    images.map(() => ({ root: null, sheet: null, shadow: null, strips: [] })),
  );
  const targetRef = useRef(0);
  const displayRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({ active: false, x: 0, target: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const render = (rawPosition: number) => {
      const position = heldPosition(rawPosition);
      const stageWidth = stage.clientWidth || window.innerWidth;
      const sideTravel = Math.min(stageWidth * 0.43, 470);
      const centerIndex = modulo(Math.round(position), images.length);

      setActiveIndex((current) =>
        current === centerIndex ? current : centerIndex,
      );

      cardRefs.current.forEach((card, index) => {
        if (!card.root || !card.sheet || !card.shadow) return;

        const distance = signedDistance(index, position);
        const absoluteDistance = Math.abs(distance);
        const side = Math.sign(distance);
        const visibleDistance = clamp(distance, -1, 1);
        const x = Math.sin(visibleDistance * Math.PI * 0.5) * sideTravel;
        const scale = 1 - clamp(absoluteDistance, 0, 1) * 0.44;
        const z = -absoluteDistance * 130;
        const yaw = -visibleDistance * 25;
        const verticalTurn = 360 + distance * 180;
        const curve = Math.sin(
          clamp(absoluteDistance, 0, 1) * Math.PI * 0.5,
        );
        const opacity = 1 - clamp(absoluteDistance, 0, 1.5) * 0.2;

        card.root.style.transform =
          `translate3d(calc(-50% + ${x.toFixed(2)}px), -50%, ${z.toFixed(2)}px) ` +
          `scale(${scale.toFixed(4)})`;
        card.root.style.opacity = clamp(opacity, 0.34, 1).toFixed(3);
        card.root.style.zIndex = String(
          100 - Math.round(absoluteDistance * 20),
        );
        card.sheet.style.transform =
          `rotateY(${yaw.toFixed(2)}deg) ` +
          `rotateX(${verticalTurn.toFixed(2)}deg)`;
        card.shadow.style.opacity = (
          0.18 +
          (1 - clamp(absoluteDistance, 0, 1)) * 0.42
        ).toFixed(3);
        card.shadow.style.transform = `scaleX(${(
          0.58 +
          (1 - clamp(absoluteDistance, 0, 1)) * 0.48
        ).toFixed(3)})`;

        card.strips.forEach((strip, stripIndex) => {
          if (!strip) return;
          const stripPosition = ((stripIndex + 0.5) / stripCount) * 2 - 1;
          const innerEdgeBias = -side;
          const taper = 1 + stripPosition * innerEdgeBias * curve * 0.075;
          const bulge = (1 - stripPosition * stripPosition) * curve * 12;
          const localYaw = stripPosition * curve * 3.5;
          const shade = clamp(
            (0.05 + Math.abs(stripPosition) * 0.16) * curve,
            0,
            0.24,
          );
          const glow = clamp(
            (1 - Math.abs(stripPosition)) * curve * 0.13,
            0,
            0.15,
          );

          strip.style.transform =
            `translate3d(0, 0, ${bulge.toFixed(2)}px) ` +
            `rotateY(${localYaw.toFixed(2)}deg) ` +
            `scaleY(${taper.toFixed(4)})`;
          strip.style.setProperty("--shade-opacity", shade.toFixed(3));
          strip.style.setProperty("--glow-opacity", glow.toFixed(3));
        });
      });
    };

    const animate = (now: number) => {
      frameRef.current = null;
      if (!lastFrameRef.current) lastFrameRef.current = now;
      const elapsed = Math.min(now - lastFrameRef.current, 64);
      lastFrameRef.current = now;
      const distance = targetRef.current - displayRef.current;
      const smoothing = prefersReducedMotion
        ? 1
        : 1 - Math.exp(-elapsed / 118);

      displayRef.current += distance * smoothing;
      if (Math.abs(distance) < 0.00005) {
        displayRef.current = targetRef.current;
      }
      render(displayRef.current);

      if (displayRef.current !== targetRef.current) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        lastFrameRef.current = 0;
      }
    };

    const requestRender = () => {
      if (prefersReducedMotion) {
        displayRef.current = targetRef.current;
        render(displayRef.current);
        return;
      }
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    const queueSnap = () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(() => {
        targetRef.current = Math.round(targetRef.current);
        requestRender();
      }, 220);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      targetRef.current += (event.deltaY + event.deltaX) * 0.00048;
      requestRender();
      queueSnap();
    };

    const onPointerDown = (event: PointerEvent) => {
      dragRef.current = {
        active: true,
        x: event.clientX,
        target: targetRef.current,
      };
      stage.setPointerCapture(event.pointerId);
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current.active) return;
      const width = Math.max(stage.clientWidth, 1);
      targetRef.current =
        dragRef.current.target +
        ((event.clientX - dragRef.current.x) / width) * 1.2;
      requestRender();
    };

    const onPointerEnd = (event: PointerEvent) => {
      dragRef.current.active = false;
      if (stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }
      queueSnap();
    };

    const onResize = () => render(displayRef.current);

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerEnd);
    stage.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("resize", onResize);
    render(displayRef.current);

    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerEnd);
      stage.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("resize", onResize);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };
  }, []);

  return (
    <main className="gallery-shell">
      <header className="gallery-header">
        <span>ALBUM ARCHIVE</span>
        <span>VOL. 01</span>
      </header>

      <div className="gallery-stage" ref={stageRef}>
        <div className="axis-line axis-left" />
        <div className="axis-line axis-right" />
        {images.map((image, index) => (
          <AlbumCard
            image={image}
            index={index}
            key={image}
            refs={cardRefs.current[index]}
          />
        ))}
      </div>

      <footer className="gallery-footer">
        <span>{String(activeIndex + 1).padStart(2, "0")}</span>
        <div className="gallery-progress" aria-hidden="true">
          {images.map((image, index) => (
            <span
              className={index === activeIndex ? "is-active" : ""}
              key={image}
            />
          ))}
        </div>
        <span>{String(images.length).padStart(2, "0")}</span>
      </footer>
    </main>
  );
}
