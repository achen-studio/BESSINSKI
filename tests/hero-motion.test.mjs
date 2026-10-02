import assert from "node:assert/strict";
import test from "node:test";

const module = await import("../app/hero-motion.ts");

test("rapid selection retargets the visible sheets without jumping or queuing", () => {
  assert.equal(typeof module.createHeroMotion, "function", "hero motion controller is available");
  const motion = module.createHeroMotion(4, 2, () => {});
  const first = motion.select(1);
  first.progress(0.4);
  const before = motion.sheets.map(sheet => ({ ...sheet }));
  const latest = motion.select(3);
  assert.equal(motion.sheets[1].fold, before[1].fold);
  assert.equal(motion.sheets[2].fold, before[2].fold);
  assert.equal(first.parent, null, "previous timeline is detached");
  latest.progress(1);
  assert.equal(motion.sheets[3].fold, 0);
  assert.equal(motion.sheets[3].opacity, 1);
  assert.ok(motion.sheets.filter((_, i) => i !== 3).every(sheet => sheet.opacity === 0));
  motion.destroy();
});

test("reselecting a thumbnail does not restart an active transition", () => {
  assert.equal(typeof module.createHeroMotion, "function");
  const motion = module.createHeroMotion(4, 2, () => {});
  const animation = motion.select(1);
  animation.progress(0.3);
  assert.equal(motion.select(1), animation);
  assert.equal(animation.progress(), 0.3);
  motion.destroy();
});

test("reduced motion settles immediately and reverse selection remains continuous", () => {
  assert.equal(typeof module.createHeroMotion, "function");
  const motion = module.createHeroMotion(4, 2, () => {});
  motion.select(1).progress(0.5);
  const before = motion.sheets[2].fold;
  motion.select(2);
  assert.equal(motion.sheets[2].fold, before);
  motion.select(0, true);
  assert.equal(motion.sheets[0].fold, 0);
  assert.equal(motion.sheets[0].opacity, 1);
  assert.ok(motion.sheets.slice(1).every(sheet => sheet.opacity === 0));
  motion.destroy();
});

test("background and cover share a timeline and finish together", () => {
  const background = { progress: 0 };
  const motion = module.createHeroMotion(4, 2, () => {}, animation => {
    animation.to(background, { progress: 1, duration: module.HERO_TRANSITION_DURATION }, 0);
  });
  const animation = motion.select(1);
  animation.progress(0.5);
  assert.ok(background.progress > 0 && background.progress < 1);
  assert.ok(motion.sheets[1].fold > 0);
  animation.progress(1);
  assert.equal(background.progress, 1);
  assert.equal(motion.sheets[1].fold, 0);
  assert.equal(animation.duration(), 1.15);
  motion.destroy();
});

test("interrupted presentations are cancelled and reduced motion settles immediately", () => {
  const arrivals = [];
  const motion = module.createHeroMotion(4, 2, () => {}, (animation, index, reduced) => {
    if (reduced) arrivals.push(index);
    else animation.call(() => arrivals.push(index), [], module.HERO_TRANSITION_DURATION);
  });
  motion.select(1).progress(0.6);
  motion.select(0).progress(0.7);
  motion.select(3).progress(1);
  assert.deepEqual(arrivals, [3]);
  motion.select(2, true);
  assert.deepEqual(arrivals, [3, 2]);
  motion.destroy();
});
