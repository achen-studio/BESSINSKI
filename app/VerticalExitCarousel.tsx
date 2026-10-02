"use client";

import { useEffect, useRef, useState } from "react";

const images = ["/gallery-01.jpg", "/gallery-02.jpg", "/gallery-03.jpg"];
const columns = 56;
const rows = 8;

type Point = { x: number; y: number };
type Vertex = Point & { z: number; angle: number };
type Triangle = {
  destination: [Vertex, Vertex, Vertex];
  source: [Point, Point, Point];
  depth: number;
  shade: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function heldPosition(position: number, hold = 0.2) {
  const cycle = Math.floor(position);
  const local = position - cycle;

  if (local <= hold) return cycle;
  if (local >= 1 - hold) return cycle + 1;

  return cycle + smoothstep((local - hold) / (1 - hold * 2));
}

function expandedTriangle(points: [Vertex, Vertex, Vertex], amount: number) {
  const centerX = (points[0].x + points[1].x + points[2].x) / 3;
  const centerY = (points[0].y + points[1].y + points[2].y) / 3;

  return points.map((point) => {
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (dx / length) * amount,
      y: point.y + (dy / length) * amount,
    };
  }) as [Point, Point, Point];
}

function drawTexturedTriangle(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: [Point, Point, Point],
  destination: [Vertex, Vertex, Vertex],
  shade: number,
) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const determinant =
    s0.x * (s1.y - s2.y) +
    s1.x * (s2.y - s0.y) +
    s2.x * (s0.y - s1.y);

  if (Math.abs(determinant) < 0.00001) return;

  const a =
    (d0.x * (s1.y - s2.y) +
      d1.x * (s2.y - s0.y) +
      d2.x * (s0.y - s1.y)) /
    determinant;
  const b =
    (d0.y * (s1.y - s2.y) +
      d1.y * (s2.y - s0.y) +
      d2.y * (s0.y - s1.y)) /
    determinant;
  const c =
    (d0.x * (s2.x - s1.x) +
      d1.x * (s0.x - s2.x) +
      d2.x * (s1.x - s0.x)) /
    determinant;
  const d =
    (d0.y * (s2.x - s1.x) +
      d1.y * (s0.x - s2.x) +
      d2.y * (s1.x - s0.x)) /
    determinant;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    determinant;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    determinant;
  const clipPoints = expandedTriangle(destination, 0.75);

  context.save();
  context.beginPath();
  context.moveTo(clipPoints[0].x, clipPoints[0].y);
  context.lineTo(clipPoints[1].x, clipPoints[1].y);
  context.lineTo(clipPoints[2].x, clipPoints[2].y);
  context.closePath();
  context.clip();
  context.transform(a, b, c, d, e, f);
  context.drawImage(image, 0, 0);
  context.restore();

  if (shade <= 0.002) return;

  context.save();
  context.beginPath();
  context.moveTo(clipPoints[0].x, clipPoints[0].y);
  context.lineTo(clipPoints[1].x, clipPoints[1].y);
  context.lineTo(clipPoints[2].x, clipPoints[2].y);
  context.closePath();
  context.fillStyle = `rgba(13, 13, 12, ${shade.toFixed(3)})`;
  context.fill();
  context.restore();
}

export function VerticalExitCarousel({
  turnStyle = "side-fold",
}: {
  turnStyle?:
    | "side-fold"
    | "right-edge-roll"
    | "move-then-roll"
    | "scroll-synced-roll";
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(0);
  const displayRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({ active: false, x: 0, target: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!stage || !canvas || !context) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const loadedImages = images.map((source) => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
      return image;
    });

    const render = (rawPosition: number) => {
      const width = stage.clientWidth || window.innerWidth;
      const height = stage.clientHeight || window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(width * pixelRatio);
      const targetHeight = Math.round(height * pixelRatio);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const isScrollSynced = turnStyle === "scroll-synced-roll";
      const position = heldPosition(rawPosition, isScrollSynced ? 0.08 : 0.2);
      const baseCard = Math.floor(position);
      const local = position - baseCard;
      const isExiting = local < 0.5;
      const cardNumber = isExiting ? baseCard : baseCard + 1;
      const imageIndex = modulo(cardNumber, images.length);
      const turnProgress = isExiting
        ? smoothstep(local / 0.48)
        : smoothstep((1 - local) / 0.48);
      const direction = isExiting ? 1 : -1;
      const sourceImage = loadedImages[imageIndex];

      canvas.dataset.phase = local.toFixed(4);
      canvas.dataset.turn = turnProgress.toFixed(4);
      canvas.dataset.motion = isExiting ? "exit-right" : "enter-left";
      canvas.dataset.card = String(imageIndex);
      setActiveIndex((current) =>
        current === imageIndex ? current : imageIndex,
      );

      if (!sourceImage?.complete || !sourceImage.naturalWidth) return;

      const cardWidth = Math.min(
        width * (width <= 720 ? 0.78 : 0.58),
        width <= 720 ? 520 : 760,
      );
      const cardHeight = cardWidth * 0.625;
      const segmentWidth = cardWidth / columns;
      const isMoveThenRoll = turnStyle === "move-then-roll";
      const isRightEdgeRoll =
        turnStyle === "right-edge-roll" || isMoveThenRoll || isScrollSynced;
      const foldProgress = isScrollSynced
        ? turnProgress
        : isMoveThenRoll
          ? smoothstep((turnProgress - 0.22) / 0.78)
          : turnProgress;
      canvas.dataset.fold = foldProgress.toFixed(4);
      const foldLine = cardWidth * 0.5 - turnProgress * cardWidth;
      const bendWidth = Math.max(
        segmentWidth * 2.4,
        cardWidth * (0.07 + Math.sin(turnProgress * Math.PI) * 0.13),
      );
      const maximumAngle = Math.PI * smoothstep(turnProgress);
      const columnAngles = new Array<number>(columns + 1).fill(0);

      for (let column = 0; column <= columns; column += 1) {
        const x = -cardWidth * 0.5 + column * segmentWidth;
        if (isRightEdgeRoll) {
          const u = column / columns;
          const stagger = isScrollSynced ? 0.42 : isMoveThenRoll ? 0.5 : 0.58;
          const delay = (1 - u) * stagger;
          const duration = isScrollSynced ? 1 - delay : 1 - stagger;
          columnAngles[column] =
            Math.PI * smoothstep((foldProgress - delay) / duration);
        } else {
          const foldInfluence = smoothstep(
            (x - (foldLine - bendWidth * 0.5)) / bendWidth,
          );
          columnAngles[column] =
            turnProgress >= 0.998 ? Math.PI : maximumAngle * foldInfluence;
        }
      }

      const columnX = new Array<number>(columns + 1).fill(0);
      const columnZ = new Array<number>(columns + 1).fill(0);
      columnX[0] = -cardWidth * 0.5;

      for (let column = 1; column <= columns; column += 1) {
        const angle =
          (columnAngles[column - 1] + columnAngles[column]) * 0.5;
        if (isRightEdgeRoll) {
          columnX[column] = -cardWidth * 0.5 + column * segmentWidth;
          columnZ[column] = 0;
        } else {
          columnX[column] =
            columnX[column - 1] + Math.cos(angle) * segmentWidth;
          columnZ[column] =
            columnZ[column - 1] + Math.sin(angle) * segmentWidth;
        }
      }

      const movement = isScrollSynced
        ? smoothstep(turnProgress)
        : isMoveThenRoll
          ? smoothstep(turnProgress / 0.22) * 0.16 +
            smoothstep((turnProgress - 0.22) / 0.5) * 0.14 +
            smoothstep((turnProgress - 0.68) / 0.32) * 0.7
          : smoothstep((turnProgress - 0.52) / 0.48);
      const offscreenDistance = isScrollSynced
        ? width * 0.5 + cardWidth * 0.54
        : isMoveThenRoll
          ? width * 0.56 + cardWidth * 0.62
          : width * 0.58 + cardWidth * 1.62;
      const travelX = direction * movement * offscreenDistance;
      const perspective =
        Math.max(width, 920) * (isScrollSynced ? 1.62 : isMoveThenRoll ? 1.5 : 1.28);
      const depthOffset =
        -movement * (isScrollSynced ? 26 : isMoveThenRoll ? 32 : 48);
      const triangles: Triangle[] = [];
      const projected = Array.from({ length: rows + 1 }, (_, row) => {
        const v = row / rows;
        return Array.from({ length: columns + 1 }, (_, column) => {
          const baseY = (v - 0.5) * cardHeight;
          const angle = columnAngles[column];
          const y = isRightEdgeRoll
            ? baseY * Math.cos(angle)
            : baseY;
          const z = isRightEdgeRoll
            ? baseY * Math.sin(angle) + depthOffset
            : columnZ[column] + depthOffset;
          const projection = perspective / (perspective - z);

          return {
            x: width * 0.5 + travelX + columnX[column] * projection,
            y: height * 0.5 + y * projection,
            z,
            angle: columnAngles[column],
          };
        });
      });

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const v00 = projected[row][column];
          const v10 = projected[row][column + 1];
          const v01 = projected[row + 1][column];
          const v11 = projected[row + 1][column + 1];
          const sx0 = (column / columns) * sourceImage.naturalWidth;
          const sx1 = ((column + 1) / columns) * sourceImage.naturalWidth;
          const sy0 = (row / rows) * sourceImage.naturalHeight;
          const sy1 = ((row + 1) / rows) * sourceImage.naturalHeight;
          const angle =
            (Math.abs(v00.angle) + Math.abs(v10.angle)) * 0.5;
          const backShade = Math.cos(angle) < 0 ? 0.18 : 0;
          const foldShade = Math.abs(Math.sin(angle)) * 0.24;
          const shade = clamp(backShade + foldShade, 0, 0.38);

          triangles.push({
            destination: [v00, v10, v11],
            source: [
              { x: sx0, y: sy0 },
              { x: sx1, y: sy0 },
              { x: sx1, y: sy1 },
            ],
            depth: (v00.z + v10.z + v11.z) / 3,
            shade,
          });
          triangles.push({
            destination: [v00, v11, v01],
            source: [
              { x: sx0, y: sy0 },
              { x: sx1, y: sy1 },
              { x: sx0, y: sy1 },
            ],
            depth: (v00.z + v11.z + v01.z) / 3,
            shade,
          });
        }
      }

      const visiblePoints = projected.flat();
      const minX = Math.min(...visiblePoints.map((point) => point.x));
      const maxX = Math.max(...visiblePoints.map((point) => point.x));
      const maxY = Math.max(...visiblePoints.map((point) => point.y));
      const visibleWidth = Math.max(maxX - minX, 1);

      context.save();
      context.filter = "blur(19px)";
      context.fillStyle = `rgba(20, 20, 18, ${(0.21 * (1 - movement * 0.65)).toFixed(3)})`;
      context.beginPath();
      context.ellipse(
        (minX + maxX) * 0.5,
        maxY + cardHeight * 0.08,
        Math.max(visibleWidth * 0.36, 16),
        cardHeight * 0.05,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.restore();

      triangles
        .sort((first, second) => first.depth - second.depth)
        .forEach((triangle) => {
          drawTexturedTriangle(
            context,
            sourceImage,
            triangle.source,
            triangle.destination,
            triangle.shade,
          );
        });

      if (turnProgress > 0.015 && turnProgress < 0.985) {
        const foldColumn = isRightEdgeRoll
          ? clamp(
              Math.round(
                (1 -
                  foldProgress /
                    (isScrollSynced ? 0.42 : isMoveThenRoll ? 0.5 : 0.58)) *
                  columns,
              ),
              0,
              columns,
            )
          : clamp(
              Math.round(
                ((foldLine + cardWidth * 0.5) / cardWidth) * columns,
              ),
              0,
              columns,
            );
        const foldEdge = projected.map((row) => row[foldColumn]);
        context.save();
        context.beginPath();
        context.moveTo(foldEdge[0].x, foldEdge[0].y);
        foldEdge.slice(1).forEach((point) => {
          context.lineTo(point.x, point.y);
        });
        context.strokeStyle = "rgba(255, 255, 255, 0.52)";
        context.lineWidth = 1.15;
        context.shadowColor = "rgba(15, 15, 13, 0.35)";
        context.shadowBlur = 6;
        context.stroke();
        context.restore();
      }
    };

    const animate = (now: number) => {
      frameRef.current = null;
      if (!lastFrameRef.current) lastFrameRef.current = now;
      const elapsed = Math.min(now - lastFrameRef.current, 64);
      lastFrameRef.current = now;
      const distance = targetRef.current - displayRef.current;
      const smoothing = prefersReducedMotion
        ? 1
        : 1 -
          Math.exp(
            -elapsed /
              (turnStyle === "scroll-synced-roll"
                ? 820
                : turnStyle === "move-then-roll"
                  ? 720
                  : 680),
          );
      const proposedStep = distance * smoothing;
      const maxStep = prefersReducedMotion
        ? Number.POSITIVE_INFINITY
        : (turnStyle === "scroll-synced-roll"
            ? 0.28
            : turnStyle === "move-then-roll"
              ? 0.36
              : 0.42) *
          (elapsed / 1000);

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

    loadedImages.forEach((image) => {
      image.onload = () => render(displayRef.current);
    });

    const queueSnap = () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(() => {
        targetRef.current = Math.round(targetRef.current);
        requestRender();
      }, turnStyle === "scroll-synced-roll" ? 680 : turnStyle === "move-then-roll" ? 560 : 520);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = clamp(event.deltaY + event.deltaX, -1600, 1600);
      targetRef.current +=
        delta *
        (turnStyle === "scroll-synced-roll"
          ? 0.00027
          : turnStyle === "move-then-roll"
            ? 0.00034
            : 0.00038);
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
      targetRef.current =
        dragRef.current.target -
        ((event.clientX - dragRef.current.x) / Math.max(stage.clientWidth, 1)) *
          (turnStyle === "scroll-synced-roll"
            ? 0.78
            : turnStyle === "move-then-roll"
              ? 0.92
              : 1.05);
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
      loadedImages.forEach((image) => {
        image.onload = null;
      });
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerEnd);
      stage.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("resize", onResize);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };
  }, [turnStyle]);

  return (
    <main className="gallery-shell">
      <header className="gallery-header">
        <span>ALBUM ARCHIVE</span>
        <span>VOL. 01</span>
      </header>

      <div className="gallery-stage page-mesh-stage" ref={stageRef}>
        <div className="axis-line axis-left" />
        <div className="axis-line axis-right" />
        <canvas
          aria-label="Galerie avec retournement vertical et sortie d'ecran"
          className="page-mesh-canvas"
          data-deformation={turnStyle}
          ref={canvasRef}
        />
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
