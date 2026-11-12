let parked: HTMLCanvasElement | null = null;

/** Keep the pixels of the cover that is already on screen. A new <img> with the same URL revalidates (max-age=0) and paints empty first. */
export function parkCover(image: HTMLImageElement) {
  if (!image.complete || image.naturalWidth === 0) return;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.drawImage(image, 0, 0);
  canvas.className = "bess-song-hero-image";
  canvas.setAttribute("aria-hidden", "true");
  parked = canvas;
}

export function parkedCover() {
  return parked;
}

export function clearParkedCover() {
  parked?.remove();
  parked = null;
}
