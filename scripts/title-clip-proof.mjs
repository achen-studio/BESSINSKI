#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const beforeBase = arg("--before", "https://bessinski.com");
const afterBase = arg("--after", "");
const out = arg("--out", "/tmp/title-clip-proof");

let playwright;
try {
  playwright = require("playwright");
} catch {
  console.error("Missing playwright. Install it, then its WebKit build.");
  console.error("npm install playwright && npx playwright install --with-deps webkit");
  process.exit(1);
}

const { chromium, webkit } = playwright;

const PAGES = [
  { id: "rever", path: "/son/rever-tue" },
  { id: "son", path: "/son" },
  { id: "sormoi", path: "/son/sormoi2moi" },
  { id: "ciel", path: "/son/le-ciel-pleure-de-lor" },
  { id: "home", path: "/" },
  { id: "home-rever", path: "/", slide: "Rêver tue" },
];

const VIEWPORTS = [
  { id: "desktop", width: 1710, height: 1107 },
  { id: "mobile", width: 390, height: 844, mobile: true },
];

const ENGINES = [
  { id: "webkit", type: webkit },
  { id: "chromium", type: chromium },
];

const SIM = ".bess-song-heading .bess-letter-word>span,.bess-home-hero .bess-featured h1 .bess-letter-word>span{overflow:hidden!important}";

function py(code, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-c", code, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => (code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr || stdout || `python ${code}`))));
  });
}

function round(value) {
  return value == null || Number.isNaN(value) ? null : Math.round(value * 10) / 10;
}

async function prepare(page, slide) {
  await page.waitForSelector(".bess-letter-word", { timeout: 20000 });
  await page.evaluate(async () => {
    await document.fonts.load('400 160px "Bess Condenso"');
    await document.fonts.ready;
    const hero = document.querySelector(".bess-home-hero");
    if (!hero) return;
    const start = performance.now();
    while (hero.dataset.title !== "ready" && performance.now() - start < 8000) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
  if (slide) {
    await page.locator(`[aria-label="Afficher ${slide}"]`).hover();
    await page.waitForFunction(
      (title) => document.querySelector('.bess-featured-caption[data-active="true"] h1')?.getAttribute("aria-label") === title,
      slide,
      { timeout: 8000 },
    );
  }
  await page.evaluate(() => {
    for (const el of document.querySelectorAll(".bess-letter-word > span")) {
      for (const anim of el.getAnimations()) anim.finish();
    }
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function measure(page) {
  return page.evaluate(() => {
    const heroEl = document.querySelector(".bess-song-hero, .bess-home-hero");
    const hero = heroEl.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const roots = [...document.querySelectorAll("#song-title, .bess-home-hero .bess-featured-caption h1")];
    const titles = roots.map((root) => {
      const letters = [...root.querySelectorAll(".bess-letter-word > span")].map((el) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const raw = (el.textContent || "").replace(/\u00a0/g, " ");
        const text = cs.textTransform === "uppercase" ? raw.toLocaleUpperCase("fr") : raw;
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const metrics = text.trim() ? ctx.measureText(text) : null;
        const marker = document.createElement("span");
        marker.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline;padding:0;margin:0;border:0";
        el.appendChild(marker);
        const baseline = marker.getBoundingClientRect().top;
        marker.remove();
        const ascent = metrics?.actualBoundingBoxAscent ?? null;
        const descent = metrics?.actualBoundingBoxDescent ?? null;
        const inkTop = ascent == null ? null : baseline - ascent;
        return {
          ch: text,
          fontSize: parseFloat(cs.fontSize),
          lineHeight: cs.lineHeight,
          overflowTop: inkTop == null ? null : rect.top - inkTop,
          overflowBottom: descent == null ? null : baseline + descent - rect.bottom,
          inkTop: inkTop == null ? null : inkTop - hero.top,
          baseline: baseline - hero.top,
          left: rect.left - hero.left,
          abs: { top: rect.top, left: rect.left, width: rect.width, height: rect.height, inkTop },
        };
      });
      const box = root.getBoundingClientRect();
      return {
        label: root.getAttribute("aria-label") || root.textContent.replace(/\s+/g, " ").trim(),
        active: root.id === "song-title" || root.closest("[data-active]")?.getAttribute("data-active") === "true",
        top: box.top - hero.top,
        height: box.height,
        letters,
      };
    });
    return { hero: { top: hero.top, left: hero.left, width: hero.width, height: hero.height }, titles };
  });
}

function activeTitle(measured) {
  return measured.titles.find((title) => title.active) || measured.titles[0];
}

function worstLetter(measured) {
  const letters = measured.titles.flatMap((title) => title.letters.filter((letter) => letter.ch.trim() && letter.overflowTop != null));
  return letters.reduce((best, letter) => (letter.overflowTop > (best?.overflowTop ?? -Infinity) ? letter : best), null);
}

function accent(measured) {
  const letters = measured.titles.flatMap((title) => title.letters);
  return letters.find((letter) => letter.ch === "Ê") || null;
}

function focusLetter(measured) {
  const title = activeTitle(measured);
  const letters = title.letters.filter((letter) => letter.ch.trim() && letter.overflowTop != null);
  return letters.find((letter) => letter.ch === "Ê") || letters.reduce((best, letter) => (letter.overflowTop > (best?.overflowTop ?? -Infinity) ? letter : best), null);
}

async function clipOf(page, measured) {
  const title = activeTitle(measured);
  const letters = title.letters.filter((letter) => letter.abs);
  const left = Math.min(...letters.map((letter) => letter.abs.left));
  const right = Math.max(...letters.map((letter) => letter.abs.left + letter.abs.width));
  const top = Math.min(...letters.map((letter) => letter.abs.top));
  const bottom = Math.max(...letters.map((letter) => letter.abs.top + letter.abs.height));
  const vp = page.viewportSize();
  const clip = {
    x: Math.max(0, Math.floor(left - 16)),
    y: Math.max(0, Math.floor(top - 180)),
    width: Math.ceil(right - left + 32),
    height: Math.ceil(bottom - (Math.max(0, Math.floor(top - 180))) + 200),
  };
  clip.width = Math.min(clip.width, vp.width - clip.x);
  clip.height = Math.min(clip.height, vp.height - clip.y);
  return clip;
}

async function shot(page, file, clip) {
  await page.screenshot({ path: file, clip });
}

async function greenInk(page, clip, stem, letter) {
  const file = `${stem}.png`;
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("#song-title, .bess-home-hero .bess-featured h1")) el.style.color = "#00ff00";
  });
  await shot(page, file, clip);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("#song-title, .bess-home-hero .bess-featured h1")) el.style.color = "";
  });
  if (!letter?.abs || letter.abs.inkTop == null) return { file, paintedVsInk: null, paintedVsBox: null, count: 0 };
  const raw = await py(`
import json, sys
from PIL import Image
left, width, clip_x, clip_y, ink_top = map(float, sys.argv[2:7])
image = Image.open(sys.argv[1]).convert("RGB")
px = image.load()
x0 = max(0, int(left - clip_x))
x1 = min(image.size[0], int(left + width - clip_x))
start = max(0, int(ink_top - 8 - clip_y))
found = None
count = 0
for y in range(start, image.size[1]):
    hits = 0
    for x in range(x0, x1):
        r, g, b = px[x, y]
        if g > 170 and g > r * 1.8 and g > b * 1.8:
            hits += 1
    if hits >= 2:
        count += hits
        if found is None:
            found = y
print(json.dumps({"top": found, "count": count}))
`, [file, String(letter.abs.left), String(letter.abs.width), String(clip.x), String(clip.y), String(letter.abs.inkTop)]);
  const parsed = JSON.parse(raw);
  if (parsed.top == null) return { file, paintedVsInk: null, paintedVsBox: null, count: 0 };
  const painted = clip.y + parsed.top;
  return {
    file,
    paintedVsInk: round(painted - letter.abs.inkTop),
    paintedVsBox: round(letter.abs.top - painted),
    count: parsed.count,
  };
}

async function captureTarget(page, engine, viewport, item, label, base) {
  const url = new URL(item.path, base.endsWith("/") ? base : `${base}/`).toString();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await prepare(page, item.slide);
  const measured = await measure(page);
  const focus = focusLetter(measured);
  const clip = await clipOf(page, measured);
  const stem = `${out}/${label}-${engine}-${viewport}-${item.id}`;
  await shot(page, `${stem}-final.png`, clip);
  const natural = { file: `${stem}-final.png` };
  let sim = null;
  let mid = null;
  if (engine === "webkit") {
    await page.addStyleTag({ content: SIM });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const simMeasured = await measure(page);
    const simFocus = focusLetter(simMeasured);
    await shot(page, `${stem}-sim.png`, clip);
    sim = await greenInk(page, clip, `${stem}-green`, simFocus);
    await page.evaluate(() => {
      for (const style of document.querySelectorAll("style")) {
        if (style.textContent.includes("overflow:hidden!important") && style.textContent.includes("bess-letter-word")) style.remove();
      }
    });
    if (!item.path.endsWith("/") && item.path !== "/") {
      await page.evaluate(() => {
        for (const el of document.querySelectorAll("#song-title .bess-letter-word > span")) {
          for (const anim of el.getAnimations()) {
            if (anim.animationName !== "bess-song-title") continue;
            const timing = anim.effect.getComputedTiming();
            const duration = typeof timing.duration === "number" ? timing.duration : 700;
            anim.pause();
            anim.currentTime = (timing.delay || 0) + duration * 0.35;
          }
        }
      });
      const midFile = `${stem}-mid.png`;
      await shot(page, midFile, clip);
      mid = midFile;
    }
  }
  const title = activeTitle(measured);
  const anchor = title.letters.find((letter) => letter.ch.trim());
  const row = {
    engine,
    viewport,
    id: item.id,
    label: title.label,
    fontSize: round(focus?.fontSize),
    lineHeight: focus?.lineHeight,
    worst: round(worstLetter(measured)?.overflowTop),
    worstChar: worstLetter(measured)?.ch,
    accentOverflow: round(accent(measured)?.overflowTop),
    inkTop: round(anchor?.inkTop),
    inkLeft: round(anchor?.left),
    headingTop: round(title.top),
    heroHeight: round(measured.hero.height),
    natural,
    sim,
    mid,
  };
  console.log(`${label} ${engine} ${viewport} ${item.id} worst=${row.worst} accent=${row.accentOverflow} inkTop=${row.inkTop} simInk=${sim?.paintedVsInk ?? "-"}`);
  return row;
}

function compare(beforeRows, afterRows) {
  const failures = [];
  const rows = [];
  for (const after of afterRows) {
    const before = beforeRows.find((row) => row.engine === after.engine && row.viewport === after.viewport && row.id === after.id);
    const shiftTop = before ? round(after.inkTop - before.inkTop) : null;
    const shiftLeft = before ? round(after.inkLeft - before.inkLeft) : null;
    const shiftInHeading = before ? round((after.inkTop - after.headingTop) - (before.inkTop - before.headingTop)) : null;
    const contained = after.worst != null && after.worst <= 1 && (after.accentOverflow == null || after.accentOverflow <= 1);
    if (!contained) failures.push(`${after.engine} ${after.viewport} ${after.id} still overflows by ${after.worst}px`);
    if (shiftInHeading != null && Math.abs(shiftInHeading) > 2) failures.push(`${after.engine} ${after.viewport} ${after.id} glyphs moved ${shiftInHeading}px inside the heading`);
    if (shiftLeft != null && Math.abs(shiftLeft) > 2) failures.push(`${after.engine} ${after.viewport} ${after.id} ink moved ${shiftLeft}px horizontally`);
    if (after.engine === "webkit" && after.sim && before?.sim) {
      if (before.sim.paintedVsBox == null || before.sim.paintedVsBox > 4) {
        failures.push(`${after.viewport} ${after.id} overflow hidden did not clip the before side (paint starts ${before.sim.paintedVsBox}px above the box)`);
      }
      if (after.sim.paintedVsInk == null || after.sim.paintedVsInk > 8) {
        failures.push(`${after.viewport} ${after.id} glyph still cut under overflow hidden (${after.sim.paintedVsInk}px missing)`);
      }
    }
    rows.push({
      id: after.id,
      engine: after.engine,
      viewport: after.viewport,
      label: after.label,
      beforeWorst: before?.worst ?? null,
      afterWorst: after.worst,
      beforeAccent: before?.accentOverflow ?? null,
      afterAccent: after.accentOverflow,
      shiftTop,
      shiftLeft,
      shiftInHeading,
      beforeSimInk: before?.sim?.paintedVsInk ?? null,
      afterSimInk: after.sim?.paintedVsInk ?? null,
      beforeSimBox: before?.sim?.paintedVsBox ?? null,
      afterSimBox: after.sim?.paintedVsBox ?? null,
    });
  }
  return { rows, failures };
}

await mkdir(out, { recursive: true });
const sides = [{ name: "before", base: beforeBase }];
if (afterBase) sides.push({ name: "after", base: afterBase });

const captured = {};
for (const side of sides) {
  captured[side.name] = [];
  for (const engine of ENGINES) {
    const browser = await engine.type.launch({ headless: true });
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        isMobile: viewport.mobile === true,
        hasTouch: viewport.mobile === true,
        userAgent: viewport.mobile
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
          : undefined,
      });
      const page = await context.newPage();
      for (const item of PAGES) {
        let row = null;
        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            row = await captureTarget(page, engine.id, viewport.id, item, side.name, side.base);
            break;
          } catch (error) {
            lastError = error;
            console.error(`retry ${side.name} ${engine.id} ${viewport.id} ${item.id}: ${error.message}`);
          }
        }
        if (!row) throw lastError;
        captured[side.name].push(row);
      }
      await context.close();
    }
    await browser.close();
  }
}

let failures = [];
let compared = null;
if (afterBase) {
  compared = compare(captured.before, captured.after);
  failures = compared.failures;
} else {
  for (const row of captured.before) {
    if (row.worst > 1) failures.push(`${row.engine} ${row.viewport} ${row.id} overflows by ${row.worst}px`);
  }
}

const report = { before: beforeBase, after: afterBase || null, captured, compared, failures };
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(failures.length ? failures.join("\n") : "pass");
console.log(out);
process.exit(failures.length ? 1 : 0);
