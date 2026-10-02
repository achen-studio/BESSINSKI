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

function heldPosition(position: number, hold: number) {
  const cycle = Math.floor(position);
  const local = position - cycle;

  if (local <= hold) return cycle;
  if (local >= 1 - hold) return cycle + 1;

  return cycle + smoothstep((local - hold) / (1 - hold * 2));
}

function AlbumCard({
  image,
  refs,
  turnStyle,
}: {
  image: string;
  refs: CardRefs;
  turnStyle: "edge" | "whole";
}) {
  const strips = useMemo(() => Array.from({ length: stripCount }), []);

  return (
    <div
      className={`album-card ${turnStyle === "edge" ? "album-card-edge" : ""}`}
      ref={(element) => {
        refs.root = element;
      }}
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

export function GalleryCarousel({
  motion = "smooth",
  turnStyle = "edge",
}: {
  motion?: "original" | "smooth" | "slow";
  turnStyle?: "edge" | "whole";
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<CardRefs>({
    root: null,
    sheet: null,
    shadow: null,
    strips: [],
  });
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
    const settings =
      motion === "slow"
        ? {
            dragDistance: 0.88,
            hold: 0.15,
            maxSpeed: 0.2,
            maxWheelDelta: 1600,
            snapDelay: 520,
            smoothing: 1100,
            wheelSpeed: 0.00042,
          }
        : motion === "smooth"
          ? {
              dragDistance: 0.88,
              hold: 0.18,
              maxSpeed: 0.28,
              maxWheelDelta: 1600,
              snapDelay: 480,
              smoothing: 820,
              wheelSpeed: 0.00042,
            }
        : {
            dragDistance: 1.2,
            hold: 0.2,
            maxSpeed: Number.POSITIVE_INFINITY,
            maxWheelDelta: Number.POSITIVE_INFINITY,
            snapDelay: 220,
            smoothing: 118,
            wheelSpeed: 0.00048,
          };

    const render = (rawPosition: number) => {
      const position = heldPosition(rawPosition, settings.hold);
      const stageWidth = stage.clientWidth || window.innerWidth;
      const nearestCard = Math.round(position);
      const centerIndex = modulo(nearestCard, images.length);
      const distance = clamp(position - nearestCard, -0.5, 0.5);
      const travelPhase = distance * 2;
      const absolutePhase = Math.abs(travelPhase);
      const sideTravel = stageWidth * 0.72;
      const x = Math.sin(travelPhase * Math.PI * 0.5) * sideTravel;
      const scale = 1 - absolutePhase * 0.38;
      const z = -absolutePhase * 180;
      const curve = Math.sin(absolutePhase * Math.PI);

      setActiveIndex((current) =>
        current === centerIndex ? current : centerIndex,
      );

      const card = cardRefs.current;
      if (!card.root || !card.sheet || !card.shadow) return;

      card.root.style.setProperty(
        "--card-image",
        `url(${images[centerIndex]})`,
      );
      card.root.style.transform =
        `translate3d(calc(-50% + ${x.toFixed(2)}px), -50%, ${z.toFixed(2)}px) ` +
        `scale(${scale.toFixed(4)})`;
      card.root.style.opacity = String(
        1 - smoothstep((absolutePhase - 0.82) / 0.18),
      );
      card.sheet.style.transform =
        turnStyle === "edge"
          ? "rotateY(0deg)"
          : `rotateX(${(travelPhase * 180).toFixed(2)}deg)`;
      card.shadow.style.opacity = (
        0.08 +
        (1 - absolutePhase) * 0.52
      ).toFixed(3);
      card.shadow.style.transform = `scaleX(${(
        0.42 +
        (1 - absolutePhase) * 0.64
      ).toFixed(3)})`;

      card.strips.forEach((strip, stripIndex) => {
        if (!strip) return;
        const stripPosition = ((stripIndex + 0.5) / stripCount) * 2 - 1;
        const direction = Math.sign(travelPhase) || 1;
        let shade: number;
        let glow: number;

        if (turnStyle === "edge") {
          const stagger = 0.48;
          const rightToLeft = (1 - stripPosition) * 0.5;
          const delay = rightToLeft * stagger;
          const timeline =
            travelPhase >= 0 ? absolutePhase : 1 - absolutePhase;
          const localProgress = smoothstep(
            (timeline - delay) / (1 - stagger),
          );
          const stripTurn =
            travelPhase >= 0
              ? localProgress * 180
              : -(1 - localProgress) * 180;
          const bend = Math.sin(localProgress * Math.PI);
          const bulge = bend * 18;
          const taper = 1 - bend * 0.025;

          shade = clamp(bend * 0.3, 0, 0.3);
          glow = clamp(bend * 0.16, 0, 0.16);
          strip.style.transform =
            `translate3d(0, 0, ${bulge.toFixed(2)}px) ` +
            `rotateY(${stripTurn.toFixed(2)}deg) ` +
            `scaleY(${taper.toFixed(4)})`;
        } else {
          const taper = 1 - stripPosition * direction * curve * 0.07;
          const bulge = (1 - stripPosition * stripPosition) * curve * 14;
          const localYaw = stripPosition * direction * curve * 4;

          shade = clamp(
            (0.05 + Math.abs(stripPosition) * 0.17) * curve,
            0,
            0.25,
          );
          glow = clamp(
            (1 - Math.abs(stripPosition)) * curve * 0.14,
            0,
            0.16,
          );
          strip.style.transform =
            `translate3d(0, 0, ${bulge.toFixed(2)}px) ` +
            `rotateY(${localYaw.toFixed(2)}deg) ` +
            `scaleY(${taper.toFixed(4)})`;
        }

        strip.style.setProperty("--shade-opacity", shade.toFixed(3));
        strip.style.setProperty("--glow-opacity", glow.toFixed(3));
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
        : 1 - Math.exp(-elapsed / settings.smoothing);
      const proposedStep = distance * smoothing;
      const maxStep = prefersReducedMotion
        ? Number.POSITIVE_INFINITY
        : settings.maxSpeed * (elapsed / 1000);

      displayRef.current += clamp(proposedStep, -maxStep, maxStep);
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
      }, settings.snapDelay);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = clamp(
        event.deltaY + event.deltaX,
        -settings.maxWheelDelta,
        settings.maxWheelDelta,
      );
      targetRef.current += delta * settings.wheelSpeed;
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
        ((event.clientX - dragRef.current.x) / width) * settings.dragDistance;
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
  }, [motion, turnStyle]);

  return (
    <main className="gallery-shell">
      <header className="gallery-header">
        <span>ALBUM ARCHIVE</span>
        <span>VOL. 01</span>
      </header>

      <div className="gallery-stage" ref={stageRef}>
        <div className="axis-line axis-left" />
        <div className="axis-line axis-right" />
        <AlbumCard
          image={images[0]}
          refs={cardRefs.current}
          turnStyle={turnStyle}
        />
      </div>

      <footer className="gallery-footer">
        <span>{String(activeIndex + 1).padStart(2, "0")}</span>
        <div className="gallery-progress" aria-hidden="true">
          {images.map((image, index) => (
            <span className={index === activeIndex ? "is-active" : ""} key={image} />
          ))}
        </div>
        <span>{String(images.length).padStart(2, "0")}</span>
      </footer>
    </main>
  );
}
