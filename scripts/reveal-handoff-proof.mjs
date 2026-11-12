import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "https://bessinski.com";
const out = process.argv[3] ?? "/tmp/reveal-handoff";
await mkdir(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable",
  headless: false,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--force-device-scale-factor=1",
    "--disable-features=OverlayScrollbar",
    "--window-size=1710,1107",
  ],
  env: { ...process.env, DISPLAY: process.env.DISPLAY || ":1" },
});

function installHook() {
  const log = [];
  window.__revealLog = log;
  const Orig = window.IntersectionObserver;
  window.IntersectionObserver = class extends Orig {
    constructor(cb, opts) {
      super((entries, obs) => {
        log.push({ t: Math.round(performance.now()), type: "callback", href: location.pathname, n: entries.length });
        cb(entries, obs);
      }, opts);
      log.push({
        t: Math.round(performance.now()),
        type: "construct",
        href: location.pathname,
        motion: opts?.rootMargin === "0px 0px -24px 0px",
      });
    }
    observe(target) {
      log.push({
        t: Math.round(performance.now()),
        type: "observe",
        href: location.pathname,
        id: target.id,
        cls: String(target.className).slice(0, 80),
        reveal: target.hasAttribute?.("data-reveal") === true,
      });
      return super.observe(target);
    }
    disconnect() {
      log.push({ t: Math.round(performance.now()), type: "disconnect", href: location.pathname });
      return super.disconnect();
    }
  };
}

async function readState(page) {
  return page.evaluate(() => {
    const menu = document.querySelector("header .bess-menu-trigger");
    const menuBox = menu?.getBoundingClientRect();
    const figure = document.querySelector("figure.bess-video");
    const iframe = figure?.querySelector("iframe");
    const box = iframe?.getBoundingClientRect();
    let hit = null;
    if (box && box.width > 0 && box.height > 0) {
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const inside = x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight;
      const node = inside ? document.elementFromPoint(x, y) : null;
      hit = {
        inside,
        x: Math.round(x),
        y: Math.round(y),
        tag: node?.tagName ?? null,
        id: node?.id ?? null,
        cls: node ? String(node.className).slice(0, 120) : null,
      };
    }
    const reveals = [...document.querySelectorAll("[data-reveal]")].map(el => ({
      cls: String(el.className).slice(0, 80),
      id: el.id,
      revealed: el.classList.contains("is-revealed"),
      opacity: getComputedStyle(el).opacity,
    }));
    return {
      path: location.pathname,
      scrollbar: window.innerWidth - document.documentElement.clientWidth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      menuX: menuBox ? Math.round(menuBox.x * 10) / 10 : null,
      menuRight: menuBox ? Math.round(menuBox.right * 10) / 10 : null,
      stamp: document.querySelector(".bess-page-motion")?.getAttribute("data-premise-stamp") ?? null,
      motion: document.querySelector(".bess-page-motion")?.getAttribute("data-motion") ?? null,
      video: figure ? {
        opacity: getComputedStyle(figure).opacity,
        revealed: figure.classList.contains("is-revealed"),
        top: Math.round(figure.getBoundingClientRect().top),
      } : null,
      hit,
      hidden: reveals.filter(item => item.opacity === "0").length,
      unrevealedHidden: reveals.filter(item => item.opacity === "0").map(item => item.cls || item.id || "(no class)"),
    };
  });
}

async function scrollPage(page) {
  await page.evaluate(async () => {
    const step = Math.max(180, Math.round(window.innerHeight * 0.65));
    const height = document.documentElement.scrollHeight;
    for (let y = 0; y <= height; y += step) {
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    window.scrollTo(0, height);
  });
  await new Promise(resolve => setTimeout(resolve, 1200));
}

async function directSon(page, label) {
  await page.goto(`${base}/son`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("figure.bess-video", { timeout: 20000 });
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.evaluate(() => document.querySelector("figure.bess-video")?.scrollIntoView({ block: "center" }));
  await new Promise(resolve => setTimeout(resolve, 1200));
  const video = await readState(page);
  await page.screenshot({ path: `${out}/${label}-direct-video.png` });
  await scrollPage(page);
  const after = await readState(page);
  return { video, afterHidden: after.hidden, afterUnrevealed: after.unrevealedHidden, scrollbar: after.scrollbar, menuX: after.menuX };
}

async function viaHome(page, label) {
  await page.goto(`${base}/`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("a.bess-featured-image", { timeout: 20000 });
  await new Promise(resolve => setTimeout(resolve, 400));
  await page.evaluate(() => document.querySelector(".bess-page-motion")?.setAttribute("data-premise-stamp", "home-motion"));
  const home = await readState(page);
  await page.screenshot({ path: `${out}/${label}-home.png` });
  await page.evaluate(() => {
    window.__menuSamples = [];
    const take = () => {
      const menu = document.querySelector("header .bess-menu-trigger");
      const box = menu?.getBoundingClientRect();
      window.__menuSamples.push({
        t: Math.round(performance.now()),
        path: location.pathname,
        menuX: box ? Math.round(box.x * 10) / 10 : null,
        scrollbar: window.innerWidth - document.documentElement.clientWidth,
        navigating: document.querySelector(".bess-home-hero")?.getAttribute("data-navigating") ?? null,
      });
    };
    window.__takeMenu = take;
    let live = true;
    const loop = () => { if (!live) return; take(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__stopMenu = () => { live = false; };
  });
  await page.click("a.bess-featured-image");
  await page.waitForFunction(() => location.pathname === "/son", { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 3000));
  const arrived = await readState(page);
  await page.screenshot({ path: `${out}/${label}-arrived.png` });
  await page.evaluate(() => document.querySelector("figure.bess-video")?.scrollIntoView({ block: "center" }));
  await new Promise(resolve => setTimeout(resolve, 1200));
  const video = await readState(page);
  await page.screenshot({ path: `${out}/${label}-video.png` });
  await scrollPage(page);
  const after = await readState(page);
  const samples = await page.evaluate(() => { window.__stopMenu?.(); return window.__menuSamples ?? []; });
  const log = await page.evaluate(() => window.__revealLog ?? []);
  const click = samples.find(sample => sample.navigating === "true") ?? null;
  const end = [...samples].reverse().find(sample => sample.path === "/" && sample.navigating === "true") ?? null;
  const son = samples.find(sample => sample.path === "/son") ?? null;
  return {
    home: { menuX: home.menuX, scrollbar: home.scrollbar, path: home.path },
    click: click ? { menuX: click.menuX, scrollbar: click.scrollbar } : null,
    end: end ? { menuX: end.menuX, scrollbar: end.scrollbar } : null,
    son: { menuX: arrived.menuX, scrollbar: arrived.scrollbar, sample: son },
    stamp: arrived.stamp,
    motion: arrived.motion,
    arrivedVideo: arrived.video,
    video: video.video,
    hit: video.hit,
    afterHidden: after.hidden,
    afterUnrevealed: after.unrevealedHidden,
    constructs: log.filter(item => item.type === "construct").map(item => ({ href: item.href, motion: item.motion })),
    motionObserves: log.filter(item => item.type === "observe" && item.reveal).length,
    videoObserved: log.some(item => item.type === "observe" && String(item.cls).includes("bess-video")),
    disconnects: log.filter(item => item.type === "disconnect").map(item => item.href),
  };
}

const report = { base, viewports: {} };
for (const viewport of [
  { name: "desktop", width: 1710, height: 1107, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
]) {
  const page = await browser.newPage();
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1, isMobile: viewport.isMobile, hasTouch: viewport.isMobile });
  await page.evaluateOnNewDocument(installHook);
  const direct = await directSon(page, viewport.name);
  const home = await viaHome(page, viewport.name);
  report.viewports[viewport.name] = { direct, home };
  await page.close();
}

await writeFile(`${out}/proof.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
