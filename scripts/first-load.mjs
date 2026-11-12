#!/usr/bin/env node
// Measures the home page first load the way a cold visit does.
// Empty profile, no setCacheDisabled, so the in-document memory cache still works.
// DevTools Fast 3G: 562.5 ms latency, 180_000 B/s down, 84_375 B/s up
// (1.6e6/8*0.9 and 750e3/8*0.9). downloadThroughput -1 is an unthrottled network.
//
// Claim this number can support or kill:
// the title paints in a fallback face and then shifts, the active cover paints
// before its backdrop, and bytes before LCP include inactive hero images and
// the below-fold video.
// A desktop Fast 3G CLS median under 0.05, a cover/backdrop gap under 100 ms,
// or fewer than 50 KB of video before LCP kills that part of the claim.
// Screenshot runs are visual only. They are not part of the median.

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const FAST_3G = {
  offline: false,
  latency: 150 * 3.75,
  downloadThroughput: (1.6 * 1000 * 1000) / 8 * 0.9,
  uploadThroughput: (750 * 1000) / 8 * 0.9,
};
const OPEN = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };

const PROFILES = {
  desktop: { width: 1710, height: 1107, mobile: false },
  mobile: { width: 390, height: 844, mobile: true },
};

const HOOK = `(() => {
  const probe = { shifts: [], lcp: null, fcp: null, errors: [] };
  window.__probe = probe;
  const box = (rect) => rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null;
  const who = (node) => {
    const el = node && node.nodeType === 1 ? node : node?.parentElement;
    if (!el) return null;
    return { tag: el.tagName, className: String(el.className || "").slice(0, 100), text: (el.innerText || el.textContent || "").trim().slice(0, 48) };
  };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        probe.shifts.push({
          t: entry.startTime,
          value: entry.value,
          sources: [...(entry.sources || [])].map((source) => ({
            node: who(source.node),
            prev: box(source.previousRect),
            cur: box(source.currentRect),
          })),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      const entry = list.getEntries().at(-1);
      const el = entry.element;
      probe.lcp = { t: entry.startTime, size: entry.size, url: entry.url || "", tag: el?.tagName || "", className: String(el?.className || "").slice(0, 80), text: (el?.innerText || "").trim().slice(0, 40) };
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (entry.name === "first-contentful-paint") probe.fcp = entry.startTime;
    }).observe({ type: "paint", buffered: true });
  } catch (error) {
    probe.errors.push(String(error));
  }
})();`;

const SAMPLE = `(() => {
  const seen = (img) => {
    if (!img) return null;
    const style = getComputedStyle(img);
    const rect = img.getBoundingClientRect();
    return {
      src: (img.currentSrc || img.src || "").split("/").pop(),
      complete: img.complete && img.naturalWidth > 0,
      opacity: Number(style.opacity),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      x: Math.round(rect.x),
      y: Math.round(rect.y),
    };
  };
  const hero = document.querySelector(".bess-home-hero");
  const line = document.querySelector('.bess-featured-caption[data-active="true"] .bess-title-line > span');
  const lineStyle = line ? getComputedStyle(line) : null;
  const lineRect = line?.getBoundingClientRect();
  const caption = line?.closest(".bess-featured-caption")?.getBoundingClientRect();
  const backs = [...document.querySelectorAll(".bess-hero-backdrop")];
  const activeBack = backs.find((el) => Number(getComputedStyle(el).opacity) > 0.5) || null;
  const canvas = document.querySelector(".bess-hero-canvas");
  const stack = document.querySelector(".bess-hero-backgrounds");
  const word = document.querySelector(".bess-wordmark");
  const menu = document.querySelector(".bess-header .bess-menu-trigger");
  const thumbs = [...document.querySelectorAll(".bess-thumbnails img")];
  return {
    t: performance.now(),
    origin: performance.timeOrigin,
    url: location.pathname,
    titleW: lineRect ? Math.round(lineRect.width) : null,
    titleRight: lineRect ? Math.round(lineRect.right) : null,
    captionW: caption ? Math.round(caption.width) : null,
    scale: lineStyle ? lineStyle.getPropertyValue("--line-scale").trim() : null,
    font: lineStyle ? lineStyle.fontFamily : null,
    condenso: document.fonts.check('400 270px "Bess Condenso"'),
    anton: document.fonts.check('400 48px "Bess Anton"'),
    fonts: document.fonts.status,
    wordW: word ? Math.round(word.getBoundingClientRect().width) : null,
    cover: seen(document.querySelector(".bess-featured-image img")),
    back: seen(activeBack?.querySelector("img")),
    backLayerOpacity: activeBack ? Number(getComputedStyle(activeBack).opacity) : null,
    backStackOpacity: stack ? Number(getComputedStyle(stack).opacity) : null,
    canvasOpacity: canvas ? Number(getComputedStyle(canvas).opacity) : null,
    renderer: hero?.dataset.renderer || null,
    navigating: hero?.dataset.navigating || null,
    thumbsReady: thumbs.filter((img) => img.complete && img.naturalWidth > 0).length,
    thumbs: thumbs.length,
    menuX: menu ? Math.round(menu.getBoundingClientRect().x * 10) / 10 : null,
    scrollbar: window.innerWidth - document.documentElement.clientWidth,
    cls: (window.__probe?.shifts || []).reduce((sum, shift) => sum + shift.value, 0),
  };
})()`;

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error(`websocket failed for ${url}`)));
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message || "cdp"} ${JSON.stringify(message.error)}`));
      else resolve(message.result || {});
    } else if (message.method) {
      for (const listener of listeners) listener(message);
    }
  });
  return {
    ready,
    send(method, params = {}) {
      const next = ++id;
      ws.send(JSON.stringify({ id: next, method, params }));
      return new Promise((resolve, reject) => pending.set(next, { resolve, reject }));
    },
    on(listener) { listeners.add(listener); },
    close() { ws.close(); },
  };
}

function takePort() {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function launch() {
  const port = await takePort();
  const dir = await mkdtemp(join(tmpdir(), "bess-chrome-"));
  const proc = spawn("google-chrome", [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-component-update",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--window-size=1710,1107",
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  proc.stdout.on("data", (chunk) => { log += chunk; });
  proc.stderr.on("data", (chunk) => { log += chunk; });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) break;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        const version = await response.json();
        return { proc, port, dir, version, log: () => log };
      }
    } catch { /* chrome is still binding the port */ }
    await delay(80);
  }
  proc.kill("SIGKILL");
  throw new Error(`chrome did not start\n${log.slice(-800)}`);
}

function appeared(image, layerOpacity = 1, stackOpacity = 1) {
  return Boolean(image && image.complete && image.opacity > 0.05 && layerOpacity > 0.05 && stackOpacity > 0.05 && image.w > 20);
}

function transition(samples, key) {
  let loading = false;
  for (const sample of samples) {
    if (sample[key] === false) loading = true;
    else if (loading && sample[key] === true) return Math.round(sample.t);
  }
  return null;
}

function summarize(samples, requests, probe, timings) {
  const lcp = probe.lcp;
  const lcpTime = lcp ? lcp.t : null;
  const resources = (timings?.resources || []).map((entry) => ({
    path: entry.path,
    initiator: entry.initiator,
    transfer: entry.transfer,
    encoded: entry.encoded,
    startMs: Math.round(entry.start),
    endMs: Math.round(entry.end),
  })).sort((a, b) => a.startMs - b.startMs);
  let bytesBeforeLcp = timings?.document && lcpTime !== null && timings.document.end <= lcpTime ? timings.document.transfer : 0;
  const inFlight = [];
  for (const entry of resources) {
    if (lcpTime === null) continue;
    if (entry.endMs > 0 && entry.endMs <= lcpTime) bytesBeforeLcp += entry.transfer;
    else if (entry.startMs <= lcpTime) inFlight.push(entry.path);
  }
  const byUrl = new Map();
  for (const request of requests.values()) {
    const list = byUrl.get(request.path) || [];
    list.push(request);
    byUrl.set(request.path, list);
  }
  const snap = probe.shifts.flatMap((shift) => shift.sources.map((source) => ({
    t: shift.t,
    value: shift.value,
    text: source.node?.text || "",
    delta: source.prev && source.cur ? source.prev.w - source.cur.w : 0,
  }))).sort((a, b) => b.delta - a.delta)[0];
  const firstCover = samples.find((sample) => appeared(sample.cover) || (sample.canvasOpacity > 0.5 && sample.renderer === "webgl" && sample.cover?.complete));
  const firstBack = samples.find((sample) => appeared(sample.back, sample.backLayerOpacity ?? 1, sample.backStackOpacity ?? 0));
  return {
    fcp: probe.fcp === null || probe.fcp === undefined ? null : Math.round(probe.fcp),
    lcp: lcp ? Math.round(lcp.t) : null,
    lcpElement: lcp ? { tag: lcp.tag, className: lcp.className, url: lcp.url, text: lcp.text, size: lcp.size } : null,
    cls: Number(probe.shifts.reduce((sum, shift) => sum + shift.value, 0).toFixed(4)),
    shifts: probe.shifts.map((shift) => ({ t: Math.round(shift.t), value: Number(shift.value.toFixed(4)), sources: shift.sources })),
    fontSwapMs: transition(samples, "condenso"),
    antonMs: transition(samples, "anton"),
    titleSnapPx: snap ? Math.round(snap.delta) : null,
    titleSnapText: snap?.text || null,
    coverMs: firstCover ? Math.round(firstCover.t) : null,
    backdropMs: firstBack ? Math.round(firstBack.t) : null,
    coverToBackdropMs: firstCover && firstBack ? Math.round(firstBack.t - firstCover.t) : null,
    bytesBeforeLcp,
    requestsInFlightAtLcp: inFlight.length,
    inFlightAtLcp: inFlight,
    duplicatePaths: [...byUrl.entries()].filter(([, list]) => list.length > 1).map(([path, list]) => ({
      path,
      count: list.length,
      encoded: list.map((request) => request.encoded),
      fromCache: list.map((request) => Boolean(request.servedFromCache || request.fromDiskCache)),
    })),
    resources,
    errors: probe.errors,
    last: samples.at(-1) || null,
  };
}

async function runOnce({ url, profile, network, shots, label }) {
  const chrome = await launch();
  const browser = connect(chrome.version.webSocketDebuggerUrl);
  await browser.ready;
  try {
    const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
    const list = await fetch(`http://127.0.0.1:${chrome.port}/json/list`).then((response) => response.json());
    const page = list.find((target) => target.id === targetId);
    const client = connect(page.webSocketDebuggerUrl);
    await client.ready;
    const requests = new Map();
    const pageErrors = [];
    client.on((message) => {
      const params = message.params || {};
      if (message.method === "Network.requestWillBeSent") {
        let path = params.request.url;
        try { path = new URL(params.request.url).pathname; } catch { path = path.slice(0, 120); }
        requests.set(params.requestId, {
          path,
          type: params.type,
          priority: params.request?.initialPriority || params.initiator?.type || "",
          initiator: params.initiator?.type || "",
          start: params.timestamp,
          finish: null,
          encoded: 0,
          status: null,
          servedFromCache: false,
          fromDiskCache: false,
          failed: null,
        });
      } else if (message.method === "Network.responseReceived") {
        const request = requests.get(params.requestId);
        if (!request) return;
        request.status = params.response.status;
        request.fromDiskCache = Boolean(params.response.fromDiskCache);
        request.protocol = params.response.protocol;
      } else if (message.method === "Network.loadingFinished") {
        const request = requests.get(params.requestId);
        if (!request) return;
        request.finish = params.timestamp;
        request.encoded = params.encodedDataLength || 0;
      } else if (message.method === "Network.loadingFailed") {
        const request = requests.get(params.requestId);
        if (!request) return;
        request.finish = params.timestamp;
        request.failed = params.errorText;
      } else if (message.method === "Network.requestServedFromCache") {
        const request = requests.get(params.requestId);
        if (request) request.servedFromCache = true;
      } else if (message.method === "Runtime.exceptionThrown") {
        pageErrors.push(params.exceptionDetails?.text || params.exceptionDetails?.exception?.description || "exception");
      } else if (message.method === "Log.entryAdded" && params.entry?.level === "error") {
        pageErrors.push(params.entry.text);
      }
    });
    const view = PROFILES[profile];
    await client.send("Network.enable");
    await client.send("Network.clearBrowserCache");
    await client.send("Network.emulateNetworkConditions", network === "fast3g" ? FAST_3G : OPEN);
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: view.width,
      height: view.height,
      deviceScaleFactor: 1,
      mobile: view.mobile,
      screenWidth: view.width,
      screenHeight: view.height,
    });
    if (view.mobile) {
      await client.send("Network.setUserAgentOverride", {
        userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      });
      await client.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    }
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
    await client.send("Page.navigate", { url });
    const samples = [];
    const frames = [];
    const started = Date.now();
    const budget = network === "fast3g" ? 16000 : 8000;
    while (Date.now() - started < budget) {
      await delay(shots ? 250 : 100);
      let sample;
      try {
        sample = await client.send("Runtime.evaluate", { expression: SAMPLE, returnByValue: true });
      } catch {
        continue;
      }
      if (sample.result?.value) samples.push(sample.result.value);
      if (shots && samples.length) {
        const current = samples.at(-1);
        const interesting = samples.length === 1
          || (current.condenso && !samples.at(-2)?.condenso)
          || (appeared(current.cover) && !appeared(samples.at(-2)?.cover))
          || (appeared(current.back, current.backLayerOpacity ?? 1, current.backStackOpacity ?? 0) && !appeared(samples.at(-2)?.back, samples.at(-2)?.backLayerOpacity ?? 1, samples.at(-2)?.backStackOpacity ?? 0))
          || (current.renderer === "webgl" && samples.at(-2)?.renderer !== "webgl")
          || (current.thumbsReady === current.thumbs && current.thumbs > 0 && samples.at(-2)?.thumbsReady !== current.thumbs);
        if (interesting || samples.length % 8 === 0) {
          const shot = await client.send("Page.captureScreenshot", { format: "jpeg", quality: 45 });
          const file = join(shots, `${String(frames.length).padStart(2, "0")}-${Math.round(current.t)}.jpg`);
          await writeFile(file, Buffer.from(shot.data, "base64"));
          frames.push({ t: Math.round(current.t), file, cover: current.cover, back: current.back, titleW: current.titleW, renderer: current.renderer, thumbsReady: current.thumbsReady });
        }
      }
    }
    const probeResult = await client.send("Runtime.evaluate", { expression: "window.__probe", returnByValue: true });
    const probe = probeResult.result?.value || { shifts: [], lcp: null, fcp: null, errors: [] };
    probe.errors = [...(probe.errors || []), ...pageErrors];
    const timingResult = await client.send("Runtime.evaluate", {
      expression: `(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource").map((entry) => ({
          path: new URL(entry.name, location.href).pathname,
          initiator: entry.initiatorType,
          start: entry.startTime,
          end: entry.responseEnd,
          transfer: entry.transferSize || 0,
          encoded: entry.encodedBodySize || 0,
        }));
        return { resources, document: navigation ? { transfer: navigation.transferSize || 0, end: navigation.responseEnd } : null };
      })()`,
      returnByValue: true,
    });
    const summary = summarize(samples, requests, probe, timingResult.result?.value || { resources: [] });
    summary.profile = profile;
    summary.network = network;
    summary.label = label;
    summary.frames = frames;
    summary.chrome = chrome.version.Browser;
    client.close();
    return summary;
  } finally {
    browser.close();
    chrome.proc.kill("SIGKILL");
    await rm(chrome.dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runMenu({ url, profile }) {
  const chrome = await launch();
  const browser = connect(chrome.version.webSocketDebuggerUrl);
  await browser.ready;
  try {
    const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
    const list = await fetch(`http://127.0.0.1:${chrome.port}/json/list`).then((response) => response.json());
    const page = list.find((target) => target.id === targetId);
    const client = connect(page.webSocketDebuggerUrl);
    await client.ready;
    const view = PROFILES[profile];
    await client.send("Page.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: view.width,
      height: view.height,
      deviceScaleFactor: 1,
      mobile: view.mobile,
      screenWidth: view.width,
      screenHeight: view.height,
    });
    await client.send("Page.navigate", { url });
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 12000);
      client.on((message) => {
        if (message.method === "Page.loadEventFired") {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    const settle = Date.now() + 4000;
    while (Date.now() < settle) {
      const brand = await client.send("Runtime.evaluate", {
        expression: `(() => { const trigger = document.querySelector(".bess-header .bess-menu-trigger"); if (!trigger) return ""; if (getComputedStyle(trigger).visibility === "hidden") return ""; return "shown"; })()`,
        returnByValue: true,
      });
      if (brand.result?.value) break;
      await delay(100);
    }
    const read = async () => {
      const result = await client.send("Runtime.evaluate", { expression: SAMPLE, returnByValue: true });
      return result.result.value;
    };
    const home = await read();
    await client.send("Runtime.evaluate", {
      expression: `document.querySelector(".bess-featured-image")?.click()`,
    });
    const during = [];
    const started = Date.now();
    while (Date.now() - started < 4000) {
      await delay(50);
      const sample = await read();
      during.push({ t: Date.now() - started, url: sample.url, menuX: sample.menuX, scrollbar: sample.scrollbar, navigating: sample.navigating });
      if (sample.url.startsWith("/son") && Date.now() - started > 700) break;
    }
    await delay(400);
    const song = await read();
    const xs = [home.menuX, ...during.map((sample) => sample.menuX), song.menuX].filter((value) => value !== null);
    client.close();
    return {
      profile,
      home: { menuX: home.menuX, scrollbar: home.scrollbar, url: home.url },
      during,
      endOfExpansion: during.filter((sample) => sample.navigating === "true").at(-1) || null,
      song: { menuX: song.menuX, scrollbar: song.scrollbar, url: song.url },
      menuDeltaPx: xs.length ? Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10 : null,
    };
  } finally {
    browser.close();
    chrome.proc.kill("SIGKILL");
    await rm(chrome.dir, { recursive: true, force: true }).catch(() => {});
  }
}

function median(values) {
  const sorted = values.filter((value) => value !== null && value !== undefined).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const url = arg("--url", "https://bessinski.com/");
const label = arg("--label", "prod");
const out = arg("--out", "/tmp/first-load");
const runs = Number(arg("--runs", "5"));
const profiles = arg("--profiles", "desktop").split(",");
const networks = arg("--networks", "fast3g").split(",");
const menu = process.argv.includes("--menu");
const visual = process.argv.includes("--visual");

await mkdir(out, { recursive: true });
const report = {
  url,
  label,
  throttle: { fast3g: FAST_3G, normal: "downloadThroughput -1" },
  claim: "fallback title shifts, cover paints before its backdrop, inactive images and the video spend bytes before LCP",
  kill: { cls: 0.05, coverGapMs: 100, videoBytesBeforeLcp: 50000 },
  runs: [],
  menu: [],
};
for (const profile of profiles) {
  for (const network of networks) {
    for (let index = 0; index < runs; index += 1) {
      const shots = visual && index === 0 ? join(out, `${label}-${profile}-${network}-frames`) : null;
      if (shots) await mkdir(shots, { recursive: true });
      process.stderr.write(`run ${label} ${profile} ${network} ${index + 1}/${runs}\n`);
      const summary = await runOnce({ url, profile, network, shots, label });
      summary.run = index;
      summary.visual = Boolean(shots);
      report.runs.push(summary);
      process.stderr.write(`  cls ${summary.cls} fcp ${summary.fcp} lcp ${summary.lcp} font ${summary.fontSwapMs} snap ${summary.titleSnapPx} cover ${summary.coverMs} back ${summary.backdropMs} gap ${summary.coverToBackdropMs} bytes ${summary.bytesBeforeLcp}\n`);
    }
  }
  if (menu) {
    process.stderr.write(`menu ${label} ${profile}\n`);
    report.menu.push(await runMenu({ url, profile }));
  }
}
const cells = [];
for (const profile of profiles) {
  for (const network of networks) {
    const group = report.runs.filter((run) => run.profile === profile && run.network === network && !run.visual);
    const numeric = report.runs.filter((run) => run.profile === profile && run.network === network);
    const use = group.length ? group : numeric;
    cells.push({
      profile,
      network,
      n: use.length,
      cls: median(use.map((run) => run.cls)),
      clsRange: [Math.min(...use.map((run) => run.cls)), Math.max(...use.map((run) => run.cls))],
      fcp: median(use.map((run) => run.fcp)),
      lcp: median(use.map((run) => run.lcp)),
      fontSwapMs: median(use.map((run) => run.fontSwapMs)),
      titleSnapPx: median(use.map((run) => run.titleSnapPx)),
      antonMs: median(use.map((run) => run.antonMs)),
      coverToBackdropMs: median(use.map((run) => run.coverToBackdropMs)),
      bytesBeforeLcp: median(use.map((run) => run.bytesBeforeLcp)),
    });
  }
}
report.cells = cells;
const file = join(out, `${label}.json`);
await writeFile(file, JSON.stringify(report, null, 2));
process.stdout.write(`${file}\n`);
