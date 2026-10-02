import { releases } from "./bess-content";

const releaseHref = (image: string) => releases.find(release => release.image === image)!.href;

export const heroSlides = [
  { title: "Le ciel pleure de l’or", lines: ["Le ciel", "pleure de l’or"], image: "le-ciel", background: "le-ciel-background", href: releaseHref("le-ciel"), layout: "ciel" },
  { title: "La nuit est proche", lines: ["La nuit", "est proche"], image: "la-nuit", background: "la-nuit-background", href: releaseHref("la-nuit"), layout: "nuit" },
  { title: "Laisse Aller", lines: ["Laisse Aller"], image: "laisse-aller", background: "laisse-aller-background", href: "/son", layout: "laisse" },
  { title: "Sormoi2moi", lines: ["Sormoi2moi"], image: "sormoi", background: "sormoi-background", href: releaseHref("sormoi"), layout: "sormoi" },
] as const;

export const initialHeroSlide = 2;
