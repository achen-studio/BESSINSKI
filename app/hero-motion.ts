import { gsap } from "gsap";

export type HeroSheet = { fold: number; side: number; opacity: number };
export const HERO_TRANSITION_DURATION = 1.15;
export type HeroPresentation = (animation: gsap.core.Timeline | null, index: number, reduced: boolean) => void;

export function createHeroMotion(count: number, initial: number, render: () => void, present: HeroPresentation = () => {}) {
  const sheets: HeroSheet[] = Array.from({ length: count }, (_, index) => ({
    fold: index === initial ? 0 : 1,
    side: -1,
    opacity: index === initial ? 1 : 0,
  }));
  let selected = initial;
  let animation = gsap.timeline();

  return {
    sheets,
    select(index: number, reduced = false, direction?: number) {
      if (index === selected && !reduced) return animation;
      const side = direction ?? (index > selected ? 1 : -1);
      selected = index;
      animation.kill();
      animation = gsap.timeline({ onUpdate: render });
      sheets.forEach((sheet, sheetIndex) => {
        if (sheetIndex === index && sheet.opacity < 0.001) {
          sheet.fold = 1;
          sheet.side = -side;
        } else if (sheetIndex !== index && sheet.fold < 0.001) {
          sheet.side = side;
        }
        if (reduced) {
          sheet.fold = sheetIndex === index ? 0 : 1;
          sheet.opacity = sheetIndex === index ? 1 : 0;
          return;
        }
        animation.to(sheet, {
          fold: sheetIndex === index ? 0 : 1,
          opacity: sheetIndex === index ? 1 : 0,
          duration: HERO_TRANSITION_DURATION,
          ease: "power3.inOut",
        }, 0);
      });
      present(reduced ? null : animation, index, reduced);
      if (reduced) render();
      return animation;
    },
    pause() { animation.pause(); },
    resume() { animation.resume(); },
    destroy() { animation.kill(); },
  };
}
