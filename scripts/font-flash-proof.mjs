#!/usr/bin/env node
// Times how long /son paints the song title in the Impact fallback before
// Bess Condenso is usable. DevTools Fast 3G is 562.5 ms latency and
// 180_000 B/s down. A fresh Chrome profile is the cold load. The same
// profile then reloads, which is the warm refresh.
//
// Claim this number can support or kill:
// the title stays on Impact for about 0.55–0.7 s on a cold load and again
// on refresh.
// A median under 150 ms kills that claim. 150 ms is the noise floor, well
// under one emulated round trip. Condenso is 13 KB, so the request is bound
// by that round trip once it starts, not by bandwidth.

import { execSync, spawn } from "node:child_process";
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

const PROFILES = {
  desktop: { width: 1920, height: 1080, mobile: false },
  mobile: { width: 390, height: 844, mobile: true },
};

const SAMPLE = `(() => {
  const h1 = document.querySelector("#song-title");
  const letters = h1 ? [...h1.querySelectorAll(".bess-letter-word > span")] : [];
  const opacities = letters.map((el) => Number(getComputedStyle(el).opacity));
  const style = h1 ? getComputedStyle(h1) : null;
  const size = style ? style.fontSize : "16px";
  const rect = h1 ? h1.getBoundingClientRect() : null;
  const word = document.querySelector(".bess-wordmark");
  const wordStyle = word ? getComputedStyle(word) : null;
  const preload = !!document.querySelector('link[rel="preload"][as="font"][href="/fonts/condenso.woff2"]');
  const named = (family) => {
    const faces = [...document.fonts].filter((face) => face.family.replace(/["']/g, "") === family);
    return faces.find((face) => face.status === "loaded")?.status || faces[0]?.status || "missing";
  };
  const letter = h1?.querySelector(".bess-letter-word > span");
  const transform = letter ? getComputedStyle(letter).transform : "none";
  const parts = transform && transform.startsWith("matrix") ? transform.match(/-?[\\d.]+/g) : null;
  const ty = parts ? Number(parts[5] || 0) : 0;
  const wordBox = h1?.querySelector(".bess-letter-word")?.getBoundingClientRect();
  const faceStatus = named("Bess Condenso");
  return {
    t: performance.now(),
    visibleLetters: opacities.filter((opacity) => opacity > 0.2).length,
    maxOpacity: opacities.length ? Math.max(...opacities) : 0,
    ty: Math.round(ty),
    rawTransform: transform,
    fontFamily: style ? style.fontFamily : "",
    fontSize: size,
    faceStatus,
    condenso: faceStatus === "loaded",
    width: wordBox ? Math.round(wordBox.width) : 0,
    text: h1 ? (h1.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 40) : "",
    box: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
    wordVisible: wordStyle ? wordStyle.visibility !== "hidden" && Number(wordStyle.opacity) > 0.2 : false,
    anton: named("Bess Anton"),
    preload,
    status: document.fonts.status,
  };
})()`;

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function range(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return [sorted[0], sorted[sorted.length - 1]];
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
  const dir = await mkdtemp(join(tmpdir(), "bess-font-"));
  const bin = process.env.CHROME_PATH || "google-chrome";
  const proc = spawn(bin, [
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
    "--window-size=1920,1080",
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

function headerValue(headers, name) {
  const found = (headers || []).find((header) => header.name.toLowerCase() === name);
  return found ? found.value : null;
}

function armFetch(client, { injectPreload, immutableFont }) {
  if (!injectPreload && !immutableFont) return;
  client.on((message) => {
    if (message.method !== "Fetch.requestPaused") return;
    const paused = message.params;
    rewrite(client, paused, { injectPreload, immutableFont }).catch(async (error) => {
      process.stderr.write(`fetch rewrite failed ${error.message}\n`);
      await client.send("Fetch.continueRequest", { requestId: paused.requestId }).catch(() => {});
    });
  });
}

async function rewrite(client, paused, { injectPreload, immutableFont }) {
  const url = paused.request.url;
  const headers = paused.responseHeaders || [];
  const type = headerValue(headers, "content-type") || "";
  const isDocument = type.includes("text/html");
  const isFont = url.includes("/fonts/condenso.woff2");
  if ((injectPreload && isDocument) || (immutableFont && isFont && paused.responseStatusCode === 200)) {
    const fetched = await client.send("Fetch.getResponseBody", { requestId: paused.requestId });
    let bytes = fetched.base64Encoded ? Buffer.from(fetched.body, "base64") : Buffer.from(fetched.body || "");
    const nextHeaders = headers.filter((header) => !["content-encoding", "content-length"].includes(header.name.toLowerCase()));
    if (injectPreload && isDocument) {
      const html = bytes.toString("utf8");
      const link = '<link rel="preload" as="font" href="/fonts/condenso.woff2" type="font/woff2" crossorigin="anonymous"/>';
      const rewritten = html.includes('href="/fonts/condenso.woff2"')
        ? html
        : html.replace("<head>", `<head>${link}`);
      bytes = Buffer.from(rewritten);
    }
    if (immutableFont && isFont) {
      const kept = nextHeaders.filter((header) => header.name.toLowerCase() !== "cache-control");
      kept.push({ name: "cache-control", value: "public, max-age=31536000, immutable" });
      nextHeaders.length = 0;
      nextHeaders.push(...kept);
    }
    nextHeaders.push({ name: "content-length", value: String(bytes.length) });
    await client.send("Fetch.fulfillRequest", {
      requestId: paused.requestId,
      responseCode: paused.responseStatusCode || 200,
      responseHeaders: nextHeaders,
      body: bytes.toString("base64"),
    });
    return;
  }
  await client.send("Fetch.continueRequest", { requestId: paused.requestId });
}

async function readSample(client) {
  const result = await client.send("Runtime.evaluate", { expression: SAMPLE, returnByValue: true });
  return result.result?.value || null;
}

async function shoot(client, file) {
  const shot = await client.send("Page.captureScreenshot", { format: "png" });
  await writeFile(file, Buffer.from(shot.data, "base64"));
}

function summarizePass(samples, fontRequest) {
  const visible = samples.find((sample) => sample.visibleLetters > 0);
  const loaded = samples.find((sample) => sample.faceStatus === "loaded");
  const discovered = samples.find((sample) => sample.faceStatus !== "missing");
  const fallbackMs = !visible
    ? null
    : loaded && loaded.t <= visible.t
      ? 0
      : loaded
        ? Math.round(loaded.t - visible.t)
        : null;
  const widthAtVisible = visible?.width ?? null;
  const widthAtReady = loaded?.width ?? null;
  const timeline = [];
  for (const sample of samples) {
    const mark = `${sample.faceStatus}:${sample.visibleLetters > 0 ? "shown" : "hidden"}`;
    if (timeline.at(-1)?.mark !== mark) timeline.push({ t: Math.round(sample.t), mark });
  }
  return {
    fallbackMs,
    titleVisibleMs: visible ? Math.round(visible.t) : null,
    condensoMs: loaded ? Math.round(loaded.t) : null,
    discoveredMs: discovered ? Math.round(discovered.t) : null,
    widthAtVisible,
    widthAtReady,
    widthDelta: widthAtVisible !== null && widthAtReady !== null ? widthAtReady - widthAtVisible : null,
    fontFamily: (loaded || visible)?.fontFamily || null,
    preloadInDocument: samples.some((sample) => sample.preload),
    text: visible?.text || samples.at(-1)?.text || "",
    transformAtVisible: visible?.rawTransform || null,
    antonAtTitle: visible ? visible.anton : null,
    wordVisibleAtTitle: visible ? visible.wordVisible : null,
    timeline,
    samples: samples.length,
    font: fontRequest,
    timedOut: Boolean(visible && fallbackMs === null),
  };
}

async function watch(client, shots, tag) {
  const samples = [];
  const started = Date.now();
  let fallbackFile = null;
  let readyFile = null;
  while (Date.now() - started < 12000) {
    await delay(40);
    let sample;
    try { sample = await readSample(client); } catch { continue; }
    if (!sample) continue;
    samples.push(sample);
    const previous = samples.at(-2);
    const becameReady = sample.condenso && !(previous && previous.condenso);
    if (shots && !fallbackFile && sample.visibleLetters > 0 && Math.abs(sample.ty) < 48 && !sample.condenso) {
      fallbackFile = join(shots, `${tag}-fallback.png`);
      await shoot(client, fallbackFile);
    }
    if (shots && becameReady) {
      readyFile = join(shots, `${tag}-condenso.png`);
      await shoot(client, readyFile);
    }
    if (sample.condenso && sample.visibleLetters > 0 && samples.filter((item) => item.condenso && item.visibleLetters > 0).length > 2) break;
  }
  if (shots && !readyFile && samples.at(-1)?.condenso) {
    readyFile = join(shots, `${tag}-condenso.png`);
    await shoot(client, readyFile);
  }
  return { samples, shots: { fallback: fallbackFile, condenso: readyFile } };
}

async function pass(client, { url, shots, tag, clearCache }) {
  const font = {
    url: null,
    status: null,
    fromDiskCache: false,
    servedFromCache: false,
    cacheControl: null,
    requestMs: null,
    encoded: 0,
    failed: null,
  };
  let requestId = null;
  let active = true;
  const navStarted = { t: null };
  const onEvent = (message) => {
    if (!active) return;
    const params = message.params || {};
    if (message.method === "Network.requestWillBeSent" && params.type === "Document") navStarted.t = params.timestamp;
    if (message.method === "Network.requestWillBeSent" && params.request?.url?.includes("/fonts/condenso.woff2")) {
      requestId = params.requestId;
      font.url = params.request.url;
      font.requestMs = navStarted.t === null ? null : Math.round((params.timestamp - navStarted.t) * 1000);
      font.encoded = 0;
      font.status = null;
      font.fromDiskCache = false;
      font.servedFromCache = false;
      font.failed = null;
    } else if (message.method === "Network.responseReceived" && params.requestId === requestId) {
      font.status = params.response.status;
      font.fromDiskCache = Boolean(params.response.fromDiskCache);
      font.cacheControl = params.response.headers?.["cache-control"] || params.response.headers?.["Cache-Control"] || null;
    } else if (message.method === "Network.requestServedFromCache" && params.requestId === requestId) {
      font.servedFromCache = true;
    } else if (message.method === "Network.loadingFinished" && params.requestId === requestId) {
      font.encoded = params.encodedDataLength || 0;
    } else if (message.method === "Network.loadingFailed" && params.requestId === requestId) {
      font.failed = params.errorText;
    }
  };
  client.on(onEvent);
  if (clearCache) await client.send("Network.clearBrowserCache");
  if (clearCache) await client.send("Page.navigate", { url });
  else await client.send("Page.reload", { ignoreCache: false });
  const watched = await watch(client, shots, tag);
  active = false;
  const summary = summarizePass(watched.samples, font);
  summary.shots = watched.shots;
  return summary;
}

async function runPair({ url, profile, shots, shotPhase, injectPreload, immutableFont }) {
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
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", FAST_3G);
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
    }
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    if (injectPreload || immutableFont) {
      armFetch(client, { injectPreload, immutableFont });
      await client.send("Fetch.enable", {
        patterns: [{ urlPattern: "*", requestStage: "Response" }],
      });
    }
    const cold = await pass(client, { url, shots: shotPhase.has("cold") ? shots : null, tag: `${profile}-cold`, clearCache: true });
    const warm = await pass(client, { url, shots: shotPhase.has("warm") ? shots : null, tag: `${profile}-warm`, clearCache: false });
    client.close();
    return { profile, chrome: chrome.version.Browser, cold, warm };
  } finally {
    browser.close();
    chrome.proc.kill("SIGKILL");
    await rm(chrome.dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function headerCheck(pageUrl) {
  const origin = new URL(pageUrl).origin;
  const names = ["condenso.woff2", "anton.woff2", "roboto-condensed.woff2", "roboto-condensed-light.woff2"];
  const headers = [];
  for (const name of names) {
    const response = await fetch(`${origin}/fonts/${name}`, { method: "HEAD" });
    headers.push({
      path: `/fonts/${name}`,
      status: response.status,
      cacheControl: response.headers.get("cache-control"),
      contentLength: response.headers.get("content-length"),
    });
  }
  return headers;
}

const pageUrl = arg("--url", "https://bessinski.com/son");
const label = arg("--label", "before");
const out = arg("--out", "artifacts/font-flash");
const runs = Number(arg("--runs", "5"));
const profiles = arg("--profiles", "desktop,mobile").split(",");
const shotPhase = new Set(arg("--shot-phase", "cold,warm").split(",").filter(Boolean));
const injectPreload = process.argv.includes("--inject-preload");
const immutableFont = process.argv.includes("--immutable-font");
const shots = process.argv.includes("--no-shots") ? null : join(out, label);

await mkdir(out, { recursive: true });
if (shots) await mkdir(shots, { recursive: true });

const report = {
  url: pageUrl,
  label,
  runsRequested: runs,
  throttle: FAST_3G,
  claim: "Impact fallback stays up for about 0.55-0.7s on cold load and on refresh",
  noiseFloorMs: 150,
  injectPreload,
  immutableFont,
  machine: {
    load: execSync("uptime").toString().trim(),
    cores: execSync("nproc").toString().trim(),
  },
  headers: await headerCheck(pageUrl),
  pairs: [],
};

for (const profile of profiles) {
  for (let index = 0; index < runs; index += 1) {
    process.stderr.write(`${label} ${profile} ${index + 1}/${runs}\n`);
    const pair = await runPair({
      url: pageUrl,
      profile,
      shots: shots && index === 0 ? shots : null,
      shotPhase,
      injectPreload,
      immutableFont,
    });
    pair.run = index;
    report.pairs.push(pair);
    process.stderr.write(`  cold ${pair.cold.fallbackMs} ms visible ${pair.cold.titleVisibleMs} font ${pair.cold.condensoMs} status ${pair.cold.font.status} cache ${pair.cold.font.fromDiskCache}\n`);
    process.stderr.write(`  warm ${pair.warm.fallbackMs} ms visible ${pair.warm.titleVisibleMs} font ${pair.warm.condensoMs} status ${pair.warm.font.status} disk ${pair.warm.font.fromDiskCache} mem ${pair.warm.font.servedFromCache}\n`);
  }
}

report.cells = profiles.flatMap((profile) => ["cold", "warm"].map((phase) => {
  const values = report.pairs.filter((pair) => pair.profile === profile).map((pair) => pair[phase].fallbackMs);
  return { profile, phase, n: values.length, fallbackMs: median(values), rangeMs: range(values) };
}));

const file = join(out, `${label}.json`);
await writeFile(file, JSON.stringify(report, null, 2));
process.stdout.write(`${file}\n${JSON.stringify(report.cells)}\n`);
