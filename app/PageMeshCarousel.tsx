"use client";

import { useEffect, useRef, useState } from "react";

const images = ["/gallery-01.jpg", "/gallery-02.jpg", "/gallery-03.jpg"];
const columns = 42;
const rows = 10;

type Point = { x: number; y: number };
type Vertex = Point & { z: number; angle: number };
type Triangle = {
  destination: [Vertex, Vertex, Vertex];
  source: [Point, Point, Point];
  depth: number;
  shade: number;
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

function heldPosition(position: number) {
  const cycle = Math.floor(position);
  const local = position - cycle;
  const hold = 0.18;

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
  const clipPoints = expandedTriangle(destination, 0.8);

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
  context.fillStyle = `rgba(10, 10, 9, ${shade.toFixed(3)})`;
  context.fill();
  context.restore();
}

export function PageMeshCarousel({
  deformation = "travel",
}: {
  deformation?: "travel" | "edge-turn";
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImagesRef = useRef<HTMLImageElement[]>([]);
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
    loadedImagesRef.current = loadedImages;

    const render = (rawPosition: number) => {
      const isEdgeTurn = deformation === "edge-turn";
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

      const position = heldPosition(rawPosition);
      const nearestCard = Math.round(position);
      const centerIndex = modulo(nearestCard, images.length);
      const distance = clamp(position - nearestCard, -0.5, 0.5);
      const travelPhase = distance * 2;
      const absolutePhase = Math.abs(travelPhase);
      const timeline = travelPhase >= 0 ? absolutePhase : 1 - absolutePhase;
      canvas.dataset.phase = travelPhase.toFixed(4);
      canvas.dataset.card = String(centerIndex);
      const cardWidth = Math.min(
        width * (width <= 720 ? 0.76 : 0.58),
        width <= 720 ? 520 : 760,
      );
      const cardHeight = cardWidth * 0.625;
      const movementProgress = isEdgeTurn
        ? smoothstep((absolutePhase - 0.42) / 0.58)
        : smoothstep((absolutePhase - 0.24) / 0.76);
      const travelX =
        Math.sign(travelPhase) *
        Math.sin(movementProgress * Math.PI * 0.5) *
        width *
        (isEdgeTurn ? 0.68 : 0.72);
      const cardScale = 1 - absolutePhase * (isEdgeTurn ? 0.18 : 0.28);
      const perspective =
        Math.max(width, 900) * (isEdgeTurn ? 0.92 : 1.15);
      const depthOffset = -absolutePhase * (isEdgeTurn ? 70 : 110);
      const sourceImage = loadedImages[centerIndex];

      setActiveIndex((current) =>
        current === centerIndex ? current : centerIndex,
      );

      if (!sourceImage?.complete || !sourceImage.naturalWidth) return;

      const columnAngles = Array.from({ length: columns + 1 }, (_, index) => {
        const u = index / columns;
        const stagger = isEdgeTurn ? 0.62 : 0.5;
        const delay = (1 - u) * stagger;
        const progress = smoothstep((timeline - delay) / (1 - stagger));
        return travelPhase >= 0
          ? progress * Math.PI
          : -(1 - progress) * Math.PI;
      });
      const columnX = new Array<number>(columns + 1).fill(0);
      const columnZ = new Array<number>(columns + 1).fill(0);
      const segmentWidth = cardWidth / columns;

      columnX[0] = -cardWidth * 0.5;
      for (let index = 1; index <= columns; index += 1) {
        const angle = (columnAngles[index - 1] + columnAngles[index]) * 0.5;
        columnX[index] = columnX[index - 1] + Math.cos(angle) * segmentWidth;
        columnZ[index] = columnZ[index - 1] + Math.sin(angle) * segmentWidth;
      }

      const minX = Math.min(...columnX);
      const maxX = Math.max(...columnX);
      const meshCenterX = (minX + maxX) * 0.5;
      const meshOriginX = isEdgeTurn ? 0 : meshCenterX;
      const triangles: Triangle[] = [];
      const projected = Array.from({ length: rows + 1 }, (_, row) => {
        const v = row / rows;
        return Array.from({ length: columns + 1 }, (_, column) => {
          const y = (v - 0.5) * cardHeight;
          const edgeSoftness = Math.sin(v * Math.PI);
          const curlLift = isEdgeTurn
            ? 0
            : Math.sin(columnAngles[column]) *
              edgeSoftness *
              cardHeight *
              0.035;
          const x3 = (columnX[column] - meshOriginX) * cardScale;
          const y3 = (y - curlLift) * cardScale;
          const z3 = columnZ[column] * cardScale + depthOffset;
          const projection = perspective / (perspective - z3);

          return {
            x: width * 0.5 + travelX + x3 * projection,
            y: height * 0.5 + y3 * projection,
            z: z3,
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
          const averageAngle =
            (Math.abs(v00.angle) + Math.abs(v10.angle)) * 0.5;
          const backShade = Math.cos(averageAngle) < 0 ? 0.2 : 0;
          const foldShade = Math.abs(Math.sin(averageAngle)) * 0.2;
          const shade = clamp(backShade + foldShade, 0, 0.34);

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
      const shadowMinX = Math.min(...visiblePoints.map((point) => point.x));
      const shadowMaxX = Math.max(...visiblePoints.map((point) => point.x));
      const shadowMaxY = Math.max(...visiblePoints.map((point) => point.y));

      context.save();
      context.filter = "blur(18px)";
      context.fillStyle = `rgba(20, 20, 18, ${(0.12 + (1 - absolutePhase) * 0.12).toFixed(3)})`;
      context.beginPath();
      context.ellipse(
        (shadowMinX + shadowMaxX) * 0.5,
        shadowMaxY + cardHeight * 0.075,
        Math.max((shadowMaxX - shadowMinX) * 0.38, 18),
        cardHeight * 0.055,
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

      if (isEdgeTurn && absolutePhase > 0.02 && absolutePhase < 0.98) {
        const rightEdge = projected.map((row) => row[columns]);
        context.save();
        context.beginPath();
        context.moveTo(rightEdge[0].x, rightEdge[0].y);
        rightEdge.slice(1).forEach((point) => {
          context.lineTo(point.x, point.y);
        });
        context.strokeStyle = "rgba(255, 255, 255, 0.5)";
        context.lineWidth = 1.2;
        context.shadowColor = "rgba(12, 12, 10, 0.3)";
        context.shadowBlur = 5;
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
      const smoothing = prefersReducedMotion ? 1 : 1 - Math.exp(-elapsed / 820);
      const proposedStep = distance * smoothing;
      const maxStep = prefersReducedMotion
        ? Number.POSITIVE_INFINITY
        : 0.28 * (elapsed / 1000);

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
      }, 480);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = clamp(event.deltaY + event.deltaX, -1600, 1600);
      targetRef.current += delta * 0.00042;
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
        dragRef.current.target +
        ((event.clientX - dragRef.current.x) / Math.max(stage.clientWidth, 1)) *
          0.88;
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
  }, [deformation]);

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
          aria-label="Galerie d'album avec retournement de feuille 3D"
          className="page-mesh-canvas"
          data-deformation={deformation}
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
