"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

function MenuLabel({ children }: { children: string }) {
  return <span className="bess-rolling-label"><span>{children}</span><span aria-hidden="true">{children}</span></span>;
}

export function BessMenu({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [pastHero, setPastHero] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const closing = useRef(false);
  const motion = useRef<Animation | null>(null);
  const id = useId();
  useEffect(() => {
    const hero = trigger.current?.closest('.bess-home-hero, .bess-song-hero');
    if (!hero) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setPastHero(hero.getBoundingClientRect().bottom <= 1);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(hero);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
  const show = (button: HTMLButtonElement) => {
    opener.current = button;
    dialog.current?.showModal();
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => () => { motion.current?.cancel(); }, []);
  const close = useCallback(() => {
    if (closing.current || !dialog.current?.open) return;
    const finish = () => { dialog.current?.close(); setOpen(false); closing.current = false; opener.current?.focus({ preventScroll: true }); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    closing.current = true;
    motion.current = dialog.current.animate([{ opacity: 1, filter: 'blur(0px)', transform: 'translateY(0) scale(1)' }, { opacity: 0, filter: 'blur(9px)', transform: 'translateY(-24px) scale(.97)' }], { duration: 300, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
    motion.current.finished.then(() => { motion.current?.cancel(); finish(); }).catch(() => {});
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    let outsideDown = false;
    const outside = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    const onDown = (event: PointerEvent) => { outsideDown = event.target === element && outside(event); };
    const onClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('a') || (outsideDown && event.target === element && outside(event))) close();
      outsideDown = false;
    };
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('click', onClick);
    return () => { element.removeEventListener('pointerdown', onDown); element.removeEventListener('click', onClick); };
  }, [close]);
  return <>
    <button ref={trigger} className="bess-menu-trigger" aria-label="MENU" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={event => show(event.currentTarget)}><MenuLabel>MENU</MenuLabel></button>
    {pastHero !== null && createPortal(<button className="bess-site bess-menu-trigger bess-sticky-menu" data-visible={pastHero} aria-hidden={!pastHero} tabIndex={pastHero ? 0 : -1} aria-label="Ouvrir le menu" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={event => show(event.currentTarget)}><MenuLabel>MENU</MenuLabel></button>, document.body)}
    <dialog ref={dialog} id={id} className="bess-site bess-menu-panel" aria-label="Menu principal" onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <div className="bess-menu-bar"><button className="bess-menu-trigger" onClick={close} aria-label="Fermer le menu" title="Fermer le menu"><MenuLabel>CLOSE</MenuLabel></button></div>
      <div>{children}</div>
    </dialog>
  </>;
}
