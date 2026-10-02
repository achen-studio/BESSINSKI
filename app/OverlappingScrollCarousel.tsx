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
type SheetMesh = {
  cardHeight: number;
  foldEdge: Vertex[] | null;
  image: HTMLImageElement;
  maxX: number;
  maxY: number;
  minX: number;
  movement: number;
  triangles: Triangle[];
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

function heldPosition(position: number, hold = 0.08) {
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

function buildSheetMesh(
  width: number,
  height: number,
  image: HTMLImageElement,
  turnProgress: number,
  direction: -1 | 1,
): SheetMesh {
  const cardWidth = Math.min(
    width * (width <= 720 ? 0.78 : 0.58),
    width <= 720 ? 520 : 760,
  );
  const cardHeight = cardWidth * 0.625;
  const segmentWidth = cardWidth / columns;
  const stagger = 0.42;
  const columnAngles = Array.from({ length: columns + 1 }, (_, column) => {
    const u = column / columns;
    const delay = (1 - u) * stagger;
    const duration = 1 - delay;
    return Math.PI * smoothstep((turnProgress - delay) / duration);
  });
  const movement = clamp(turnProgress, 0, 1);
  const offscreenDistance = width * 0.5 + cardWidth * 0.54;
  const travelX = direction * movement * offscreenDistance;
  const perspective = Math.max(width, 920) * 1.62;
  const depthOffset = -movement * 26;
  const triangles: Triangle[] = [];
  const projected = Array.from({ length: rows + 1 }, (_, row) => {
    const v = row / rows;
    return Array.from({ length: columns + 1 }, (_, column) => {
      const baseY = (v - 0.5) * cardHeight;
      const angle = columnAngles[column];
      const y = baseY * Math.cos(angle);
      const z = baseY * Math.sin(angle) + depthOffset;
      const projection = perspective / (perspective - z);

      return {
        x:
          width * 0.5 +
          travelX +
          (-cardWidth * 0.5 + column * segmentWidth) * projection,
        y: height * 0.5 + y * projection,
        z,
        angle,
      };
    });
  });

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const v00 = projected[row][column];
      const v10 = projected[row][column + 1];
      const v01 = projected[row + 1][column];
      const v11 = projected[row + 1][column + 1];
      const sx0 = (column / columns) * image.naturalWidth;
      const sx1 = ((column + 1) / columns) * image.naturalWidth;
      const sy0 = (row / rows) * image.naturalHeight;
      const sy1 = ((row + 1) / rows) * image.naturalHeight;
      const angle = (Math.abs(v00.angle) + Math.abs(v10.angle)) * 0.5;
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
  const foldColumn = clamp(
    Math.round((1 - turnProgress / stagger) * columns),
    0,
    columns,
  );

  return {
    cardHeight,
    foldEdge:
      turnProgress > 0.015 && turnProgress < 0.985
        ? projected.map((row) => row[foldColumn])
        : null,
    image,
    maxX: Math.max(...visiblePoints.map((point) => point.x)),
    maxY: Math.max(...visiblePoints.map((point) => point.y)),
    minX: Math.min(...visiblePoints.map((point) => point.x)),
    movement,
    triangles,
  };
}

function drawShadow(context: CanvasRenderingContext2D, mesh: SheetMesh) {
  const visibleWidth = Math.max(mesh.maxX - mesh.minX, 1);

  context.save();
  context.filter = "blur(18px)";
  context.fillStyle = `rgba(20, 20, 18, ${(0.17 * (1 - mesh.movement * 0.65)).toFixed(3)})`;
  context.beginPath();
  context.ellipse(
    (mesh.minX + mesh.maxX) * 0.5,
    mesh.maxY + mesh.cardHeight * 0.08,
    Math.max(visibleWidth * 0.36, 14),
    mesh.cardHeight * 0.05,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function drawSheet(context: CanvasRenderingContext2D, mesh: SheetMesh) {
  mesh.triangles
    .sort((first, second) => first.depth - second.depth)
    .forEach((triangle) => {
      drawTexturedTriangle(
        context,
        mesh.image,
        triangle.source,
        triangle.destination,
        triangle.shade,
      );
    });

  if (!mesh.foldEdge) return;

  context.save();
  context.beginPath();
  context.moveTo(mesh.foldEdge[0].x, mesh.foldEdge[0].y);
  mesh.foldEdge.slice(1).forEach((point) => {
    context.lineTo(point.x, point.y);
  });
  context.strokeStyle = "rgba(255, 255, 255, 0.42)";
  context.lineWidth = 1;
  context.shadowColor = "rgba(15, 15, 13, 0.28)";
  context.shadowBlur = 5;
  context.stroke();
  context.restore();
}

export function OverlappingScrollCarousel({
  motion = "smooth",
  showShadow = true,
  interactiveProgress = false,
}: {
  motion?: "smooth" | "light" | "fast" | "faster";
  showShadow?: boolean;
  interactiveProgress?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(0);
  const displayRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({ active: false, x: 0, target: 0 });
  const wheelGestureRef = useRef({ active: false, anchor: 0, direction: 0 });
  const goToCardRef = useRef<(index: number) => void>(() => undefined);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!stage || !canvas || !context) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isFaster = motion === "faster";
    const isFast = motion === "fast" || isFaster;
    const isLight = motion === "light" || isFast;
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

      const position = isFast
        ? rawPosition
        : heldPosition(rawPosition, isLight ? 0.045 : 0.08);
      const baseCard = Math.floor(position);
      const progress = position - baseCard;
      const outgoingIndex = modulo(baseCard, images.length);
      const incomingIndex = modulo(baseCard + 1, images.length);
      const outgoingImage = loadedImages[outgoingIndex];
      const incomingImage = loadedImages[incomingIndex];
      const nearestIndex = progress < 0.5 ? outgoingIndex : incomingIndex;

      canvas.dataset.phase = progress.toFixed(4);
      canvas.dataset.outgoing = progress.toFixed(4);
      canvas.dataset.incoming = (1 - progress).toFixed(4);
      canvas.dataset.card = String(nearestIndex);
      setActiveIndex((current) =>
        current === nearestIndex ? current : nearestIndex,
      );

      if (
        !outgoingImage?.complete ||
        !outgoingImage.naturalWidth ||
        !incomingImage?.complete ||
        !incomingImage.naturalWidth
      ) {
        return;
      }

      const outgoing = buildSheetMesh(
        width,
        height,
        outgoingImage,
        progress,
        1,
      );
      const incoming = buildSheetMesh(
        width,
        height,
        incomingImage,
        1 - progress,
        -1,
      );

      if (showShadow) {
        drawShadow(context, outgoing);
        drawShadow(context, incoming);
      }

      if (progress < 0.5) {
        drawSheet(context, incoming);
        drawSheet(context, outgoing);
      } else {
        drawSheet(context, outgoing);
        drawSheet(context, incoming);
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
              (isFaster ? 330 : motion === "fast" ? 420 : isLight ? 590 : 820),
          );
      const proposedStep = distance * smoothing;
      const maxStep = prefersReducedMotion
        ? Number.POSITIVE_INFINITY
        : (isFaster ? 0.72 : motion === "fast" ? 0.58 : isLight ? 0.39 : 0.28) *
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

    goToCardRef.current = (index: number) => {
      const currentPosition = displayRef.current;
      const cycle = Math.round((currentPosition - index) / images.length);
      const candidates = [cycle - 1, cycle, cycle + 1].map(
        (candidateCycle) => index + candidateCycle * images.length,
      );
      const destination = candidates.reduce((nearest, candidate) =>
        Math.abs(candidate - currentPosition) <
        Math.abs(nearest - currentPosition)
          ? candidate
          : nearest,
      );

      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      wheelGestureRef.current.active = false;
      targetRef.current = destination;
      requestRender();
    };

    loadedImages.forEach((image) => {
      image.onload = () => render(displayRef.current);
    });

    const queueSnap = () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(() => {
        targetRef.current = Math.round(targetRef.current);
        wheelGestureRef.current.active = false;
        requestRender();
      }, isFaster ? 320 : motion === "fast" ? 390 : isLight ? 510 : 680);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = clamp(event.deltaY + event.deltaX, -1600, 1600);
      const sensitivity = isFaster
        ? 0.00048
        : motion === "fast"
          ? 0.00043
          : isLight
            ? 0.00034
            : 0.00027;

      if (isFast && delta !== 0) {
        const direction = Math.sign(delta);
        const gesture = wheelGestureRef.current;

        if (!gesture.active || gesture.direction !== direction) {
          gesture.active = true;
          gesture.anchor = Math.round(targetRef.current);
          gesture.direction = direction;
        }

        const minimum = direction > 0 ? gesture.anchor : gesture.anchor - 1;
        const maximum = direction > 0 ? gesture.anchor + 1 : gesture.anchor;
        targetRef.current = clamp(
          targetRef.current + delta * sensitivity,
          minimum,
          maximum,
        );
      } else {
        targetRef.current += delta * sensitivity;
      }
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
      wheelGestureRef.current.active = false;
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current.active) return;
      targetRef.current =
        dragRef.current.target -
        ((event.clientX - dragRef.current.x) / Math.max(stage.clientWidth, 1)) *
          (isFaster ? 1.25 : motion === "fast" ? 1.12 : isLight ? 0.94 : 0.78);
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
      goToCardRef.current = () => undefined;
    };
  }, [motion, showShadow]);

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
          aria-label="Galerie avec deux cartes en transition simultanee"
          className="page-mesh-canvas"
          data-deformation="overlapping-scroll-roll"
          ref={canvasRef}
        />
      </div>

      <footer
        className={`gallery-footer ${interactiveProgress ? "has-controls" : ""}`}
      >
        <span>{String(activeIndex + 1).padStart(2, "0")}</span>
        <div
          className={`gallery-progress ${interactiveProgress ? "is-clickable" : ""}`}
          {...(!interactiveProgress ? { "aria-hidden": true } : {})}
        >
          {images.map((image, index) =>
            interactiveProgress ? (
              <button
                aria-current={index === activeIndex ? "true" : undefined}
                aria-label={`Afficher la carte ${index + 1}`}
                className={index === activeIndex ? "is-active" : ""}
                key={image}
                onClick={() => goToCardRef.current(index)}
                type="button"
              />
            ) : (
              <span
                className={index === activeIndex ? "is-active" : ""}
                key={image}
              />
            ),
          )}
        </div>
        <span>{String(images.length).padStart(2, "0")}</span>
      </footer>
    </main>
  );
}
