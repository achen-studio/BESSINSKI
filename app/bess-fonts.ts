const faces = [
  ["Bess Anton", "/fonts/anton.woff2", "400"],
  ["Bess Roboto", "/fonts/roboto-condensed.woff2", "400"],
  ["Bess Roboto", "/fonts/roboto-condensed-light.woff2", "300"],
] as const;

let pending: Promise<void> | null = null;

// These faces stay out of the first stylesheet so they cannot preempt the hero images.
export function loadSecondaryFonts() {
  if (!pending) {
    pending = Promise.all(faces.map(async ([family, url, weight]) => {
      const face = new FontFace(family, `url(${url})`, { weight, display: "swap" });
      document.fonts.add(await face.load());
    })).then(() => undefined).catch(() => undefined);
  }
  return pending;
}
