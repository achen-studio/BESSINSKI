"use client";

import { useImperativeHandle, useRef, type Ref, type RefObject } from "react";
import { gsap } from "gsap";
import { Photo } from "./BessShared";
import { heroSlides, initialHeroSlide } from "./hero-slides";
import { HERO_TRANSITION_DURATION, type HeroPresentation } from "./hero-motion";

export type HeroBackdropHandle = { select: HeroPresentation };

export function BessHeroBackdrop({ ref, cover, hero }: { ref: Ref<HeroBackdropHandle>; cover: RefObject<HTMLAnchorElement | null>; hero: RefObject<HTMLElement | null> }) {
  const root = useRef<HTMLDivElement>(null);
  const order = useRef(1);
  useImperativeHandle(ref, () => ({ select(animation, active, reduced) {
    if (!root.current || !cover.current || !hero.current) return;
    root.current.dataset.background = heroSlides[active].background;
    const layers = Array.from(root.current.children) as HTMLElement[];
    const layer = layers[active];
    const photo = layer.querySelector("img");
    const finish = () => {
      layers.forEach((element, index) => gsap.set(element, { opacity: index === active ? 1 : 0, zIndex: index === active ? 1 : 0 }));
      gsap.set(layer, { clipPath: "inset(0% 0% 0% 0% round 0px)" });
      gsap.set(photo, { scale: 1 });
      order.current = 1;
    };
    if (reduced || !animation) { finish(); return; }
    // Preserve partially visible layers when a hover reverses the transition.
    if (Number(gsap.getProperty(layer, "opacity")) < 0.001) {
      const bounds = hero.current.getBoundingClientRect();
      const card = cover.current.getBoundingClientRect();
      const inset = `${(card.top - bounds.top) / bounds.height * 100}% ${(bounds.right - card.right) / bounds.width * 100}% ${(bounds.bottom - card.bottom) / bounds.height * 100}% ${(card.left - bounds.left) / bounds.width * 100}%`;
      gsap.set(layer, { clipPath: `inset(${inset} round 5px)`, zIndex: ++order.current });
      gsap.set(photo, { scale: 1.08 });
    }
    animation.to(layer, { opacity: 1, clipPath: "inset(0% 0% 0% 0% round 0px)", duration: HERO_TRANSITION_DURATION, ease: "power3.inOut" }, 0);
    animation.to(photo, { scale: 1, duration: HERO_TRANSITION_DURATION, ease: "power3.inOut" }, 0);
    layers.forEach((element, index) => {
      if (index !== active) animation.to(element, { opacity: 0, duration: HERO_TRANSITION_DURATION, ease: "power3.inOut" }, 0);
    });
    animation.call(finish, [], HERO_TRANSITION_DURATION);
  } }), [cover, hero]);

  return <div ref={root} className="bess-hero-backgrounds" aria-hidden="true" data-background={heroSlides[initialHeroSlide].background}>
    {heroSlides.map((slide, index) => <div key={slide.image} className="bess-hero-backdrop" style={{ opacity: index === initialHeroSlide ? 1 : 0 }}><Photo name={slide.background} eager /></div>)}
  </div>;
}
