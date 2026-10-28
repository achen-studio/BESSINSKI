import { releases } from "./bess-content";

const releaseHref = (image: string) => releases.find(release => release.image === image)!.href;

export const heroSlides = [
  { title: "Le ciel pleure de l’or", lines: ["Le ciel", "pleure de l’or"], image: "le-ciel-pleure-de-lor-cover-oct28", background: "le-ciel-background", href: releaseHref("le-ciel-pleure-de-lor-cover-oct28"), layout: "ciel", date: "2024-06-21", dateLabel: "21 JUIN 2024" },
  { title: "Rêver tue", lines: ["Rêver tue"], image: "rever-tue-cover-oct28", background: "rever-tue-cover-oct28", href: releaseHref("rever-tue-cover-oct28"), layout: "laisse", date: "2025-08-04", dateLabel: "04 AOÛT 2025" },
  { title: "Laisse Aller", lines: ["Laisse Aller"], image: "laisse-aller-cover-oct28", background: "laisse-aller-background", href: "/son", layout: "laisse", date: "2024-06-21", dateLabel: "21 JUIN 2024" },
  { title: "Sormoi2moi", lines: ["Sormoi2moi"], image: "sormoi2moi-cover-oct28", background: "sormoi-background", href: releaseHref("sormoi2moi-cover-oct28"), layout: "sormoi", date: "2024-06-21", dateLabel: "21 JUIN 2024" },
] as const;

export const initialHeroSlide = 2;
