#!/usr/bin/env node
// Frame probe for two hero motions.
//
// Decision this run can change:
// a return to home is a rise when the active title letter travels at least
// 0.35em upward and passes through blur >= 4px while its opacity climbs
// from below 0.25 to above 0.8. It is opacity-only when that climb happens
// with travel under 0.12em and blur under 1px.
// A cover click fails when any frame shows a home title and a song title
// together, or a home title while the cover is already 12% wider than its
// start. The pass is zero such frames.
// Noise floor: one headless Chrome pass per viewport. A single frame under
// 0.12 opacity does not count as a title. Arrow navigation is the control.
// If the arrow does not rise, the probe is wrong and the other numbers are
// not a verdict.
// Limiter: the page animation clock. Sampling reads computed style on rAF.
// Screenshots are a second pass and are not the measurement.

import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const base = arg("--base", "https://bessinski.com").replace(/\/$/, "");
const outRoot = arg("--out", "/tmp/title-motion-proof");
const patch = arg("--patch", "none");
const only = arg("--only", "");
const shots = !process.argv.includes("--no-shots");
const profileArg = arg("--profile", "");

const PROFILES = [
  { id: "desktop", width: 1440, height: 900, mobile: false },
  { id: "mobile", width: 390, height: 844, mobile: true },
];

const BOOT = `(() => {
  if (window.__take) return;
  const blurPx = (filter) => {
    const match = /blur\\(([\\d.]+)px\\)/.exec(filter || "");
    return match ? Number(match[1]) : 0;
  };
  const tyPx = (transform) => {
    if (!transform || transform === "none") return 0;
    const m3 = /matrix3d\\(([^)]+)\\)/.exec(transform);
    if (m3) return Number(m3[1].split(",")[13]);
    const m = /matrix\\(([^)]+)\\)/.exec(transform);
    if (m) return Number(m[1].split(",")[5]);
    return 0;
  };
  const read = (span) => {
    if (!span) return null;
    const cs = getComputedStyle(span);
    const size = parseFloat(cs.fontSize) || 16;
    const rect = span.getBoundingClientRect();
    return {
      o: Math.round(Number(cs.opacity) * 1000) / 1000,
      ty: Math.round((tyPx(cs.transform) / size) * 1000) / 1000,
      blur: Math.round(blurPx(cs.filter) * 10) / 10,
      top: Math.round(rect.top * 10) / 10,
      size: Math.round(size * 10) / 10,
    };
  };
  const shownCount = (spans, parentOpacity) => spans.reduce((count, span) => {
    const opacity = Number(getComputedStyle(span).opacity) * parentOpacity;
    if (opacity <= 0.12) return count;
    const rect = span.getBoundingClientRect();
    if (rect.width < 1 || rect.bottom < 0 || rect.top > innerHeight) return count;
    return count + 1;
  }, 0);
  window.__take = () => {
    const hero = document.querySelector(".bess-home-hero");
    const cover = document.querySelector("a.bess-featured-image");
    const box = cover ? cover.getBoundingClientRect() : null;
    const img = cover ? cover.querySelector("img") : null;
    const canvas = document.querySelector(".bess-hero-canvas");
    const songH = document.querySelector(".bess-song-heading h1");
    const songSpans = songH ? [...songH.querySelectorAll(".bess-letter-word>span")] : [];
    const songParent = songH ? Number(getComputedStyle(songH).opacity) : 1;
    const captions = [...document.querySelectorAll(".bess-featured-caption")].map((cap) => {
      const h1 = cap.querySelector("h1");
      const spans = h1 ? [...h1.querySelectorAll(".bess-letter-word>span")] : [];
      const capO = Number(getComputedStyle(cap).opacity);
      return {
        title: h1 ? h1.getAttribute("aria-label") : "",
        active: cap.getAttribute("data-active") === "true",
        shown: shownCount(spans, capO),
        a: read(spans[0]),
        b: read(spans[Math.min(4, Math.max(0, spans.length - 1))]),
      };
    });
    const songShown = shownCount(songSpans, songParent);
    const homeShown = captions.reduce((sum, cap) => sum + (cap.shown > 0 ? 1 : 0), 0);
    const songLetter = read(songSpans[0]);
    return {
      t: Math.round(performance.now()),
      path: location.pathname,
      titleReady: hero ? (hero.dataset.title || "") : "",
      pair: hero ? (hero.dataset.pair || "") : "",
      navigating: hero ? (hero.dataset.navigating || "") : "",
      coverW: box ? Math.round(box.width) : 0,
      imgO: img ? Math.round(Number(getComputedStyle(img).opacity) * 100) / 100 : null,
      canvasO: canvas ? Math.round(Number(getComputedStyle(canvas).opacity) * 100) / 100 : null,
      song: Boolean(songH),
      songO: songLetter ? songLetter.o : null,
      songTy: songLetter ? songLetter.ty : null,
      songShown,
      homeShown,
      titles: homeShown + (songShown > 0 ? 1 : 0),
      captions,
    };
  };
  try {
    if (sessionStorage.getItem("bess-probe")) {
      sessionStorage.removeItem("bess-probe");
      window.__samples = [];
      const tick = () => {
        window.__samples.push(window.__take());
        if (!window.__probeStop && window.__samples.length < 200) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  } catch { /* sessionStorage can be blocked */ }
})();`;

const PATCHES = {
  none: "",
  gate: `(() => {
    const style = document.createElement("style");
    style.setAttribute("data-probe", "gate");
    style.textContent = ".bess-home-hero:not([data-title=ready]) .bess-featured-caption h1 .bess-letter-word>span{opacity:0!important;filter:blur(10px)!important;transform:translateY(.75em)!important;transition:none!important}";
    const mount = () => (document.head || document.documentElement).appendChild(style);
    if (document.head) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  })();`,
  "gate-live": `(() => {
    const style = document.createElement("style");
    style.setAttribute("data-probe", "gate-live");
    style.textContent = ".bess-home-hero:not([data-title=ready]) .bess-featured-caption h1 .bess-letter-word>span{opacity:0!important;filter:blur(10px)!important;transform:translateY(.75em)!important}";
    const mount = () => (document.head || document.documentElement).appendChild(style);
    if (document.head) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  })();`,
  clip: `(() => {
    const style = document.createElement("style");
    style.setAttribute("data-probe", "clip");
    style.textContent = ".bess-letter-word>span{overflow:hidden}";
    const mount = () => (document.head || document.documentElement).appendChild(style);
    if (document.head) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  })();`,
  defer: `(() => {
    let released = false;
    let timer = 0;
    const strip = () => {
      document.querySelectorAll(".bess-featured-caption[data-active]").forEach((el) => {
        el.dataset.holdActive = "1";
        el.removeAttribute("data-active");
      });
    };
    const release = () => {
      document.querySelectorAll("[data-hold-active]").forEach((el) => {
        el.setAttribute("data-active", "true");
        delete el.dataset.holdActive;
      });
    };
    const sync = () => {
      const hero = document.querySelector(".bess-home-hero");
      if (!hero || hero.dataset.title !== "ready") {
        released = false;
        cancelAnimationFrame(timer);
        strip();
        return;
      }
      if (released) return;
      strip();
      released = true;
      timer = requestAnimationFrame(() => requestAnimationFrame(release));
    };
    new MutationObserver(sync).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-active", "data-title"],
    });
    sync();
  })();`,
};

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
      if (message.error) reject(new Error(message.error.message || "cdp"));
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
  const dir = await mkdtemp(join(tmpdir(), "bess-motion-"));
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
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--window-size=1440,900",
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  proc.stderr.on("data", (chunk) => { log += chunk; });
  proc.stdout.on("data", (chunk) => { log += chunk; });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) break;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return { proc, port, dir, version: await response.json() };
    } catch { /* chrome is still binding the port */ }
    await delay(80);
  }
  proc.kill("SIGKILL");
  throw new Error(`chrome did not start\\n${log.slice(-800)}`);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.text || result.exceptionDetails.exception?.description || "evaluate failed";
    throw new Error(text);
  }
  return result.result?.value;
}

async function safeEval(client, expression, attempts = 8) {
  let last = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await evaluate(client, expression);
    } catch (error) {
      last = error;
      await delay(40);
    }
  }
  throw last;
}

function clickExpr(selector) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`;
}

async function click(client, selector) {
  const point = await safeEval(client, clickExpr(selector));
  if (!point) throw new Error(`missing click target ${selector}`);
  const shared = { x: point.x, y: point.y, button: "left", clickCount: 1 };
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", ...shared });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...shared });
  return point;
}

async function waitFor(client, expression, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const value = await evaluate(client, expression);
      if (value) return value;
    } catch { /* navigation can destroy the context for a moment */ }
    await delay(40);
  }
  throw new Error(`timeout ${expression.slice(0, 140)}`);
}

async function sample(client, ms) {
  await safeEval(client, `(() => {
    window.__gen = (window.__gen || 0) + 1;
    const gen = window.__gen;
    window.__samples = [];
    const tick = () => {
      if (window.__gen !== gen) return;
      window.__samples.push(window.__take());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return gen;
  })()`);
  await delay(ms);
  return safeEval(client, `(() => { window.__gen += 1; return window.__samples || []; })()`);
}

function captionByTitle(frame, title) {
  return (frame.captions || []).find((cap) => cap.title === title) || null;
}

function endingTitle(frames) {
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const active = (frames[index].captions || []).find((cap) => cap.active);
    if (active?.title) return active.title;
  }
  return frames.at(-1)?.captions?.[0]?.title || null;
}

function series(frames, pick, title) {
  return frames.map((frame) => {
    const cap = captionByTitle(frame, title);
    const letter = cap ? cap[pick] : null;
    return letter ? { ...letter, t: frame.t, title: cap.title, ready: frame.titleReady, active: cap.active } : null;
  }).filter(Boolean);
}

function classifyReturn(frames) {
  const home = frames.filter((frame) => frame.path === "/");
  const title = endingTitle(home);
  const letters = series(home, "a", title);
  if (letters.length < 4) return { verdict: "short", frames: home.length, letters: letters.length, title };
  const low = letters.filter((letter) => letter.o < 0.25);
  const high = letters.filter((letter) => letter.o > 0.8);
  const climb = letters.filter((letter) => letter.o >= 0.12 && letter.o <= 0.9);
  const travel = letters.length ? Math.max(...letters.map((letter) => letter.top)) - Math.min(...letters.map((letter) => letter.top)) : 0;
  const size = letters.find((letter) => letter.size)?.size || 16;
  const travelEm = travel / size;
  const peakTy = Math.max(0, ...letters.map((letter) => Math.abs(letter.ty)));
  const peakBlur = Math.max(0, ...letters.map((letter) => letter.blur));
  const climbTy = climb.length ? Math.max(...climb.map((letter) => Math.abs(letter.ty))) : 0;
  const climbBlur = climb.length ? Math.max(...climb.map((letter) => letter.blur)) : 0;
  const first = letters[0];
  const readyFlip = home.find((frame) => frame.titleReady === "ready");
  const readyLetter = readyFlip ? captionByTitle(readyFlip, title)?.a : null;
  const rise = low.length > 0 && high.length > 0 && climb.length >= 3 && climbTy >= 0.35 && climbBlur >= 4;
  const opacityOnly = low.length > 0 && high.length > 0 && climb.length >= 3 && climbTy < 0.12 && climbBlur < 1;
  let verdict = "other";
  if (rise) verdict = "rise";
  else if (opacityOnly) verdict = "opacity-only";
  else if (low.length > 0 && high.length > 0 && climb.length < 3) verdict = "pop";
  else if (low.length === 0 && high.length > 0) verdict = "already-visible";
  else if (low.length > 0 && high.length === 0) verdict = "stuck-hidden";
  return {
    verdict,
    frames: home.length,
    title,
    travelEm: round(travelEm),
    peakTy: round(peakTy),
    peakBlur: round(peakBlur),
    climbTy: round(climbTy),
    climbBlur: round(climbBlur),
    climbFrames: climb.length,
    opacityStart: first?.o ?? null,
    opacityEnd: letters.at(-1)?.o ?? null,
    firstReady: readyFlip ? { t: readyFlip.t, o: readyLetter?.o ?? null, ty: readyLetter?.ty ?? null, blur: readyLetter?.blur ?? null } : null,
    first: { t: first?.t, o: first?.o, ty: first?.ty, blur: first?.blur, ready: first?.ready, active: first?.active },
    blackMs: blackout(home),
  };
}

function blackout(home) {
  if (!home.length) return null;
  const start = home[0].t;
  const lit = home.find((frame) => (frame.imgO ?? 0) > 0.4 || (frame.canvasO ?? 0) > 0.4);
  return lit ? lit.t - start : null;
}

function classifyClick(frames) {
  const withCover = frames.filter((frame) => frame.coverW > 40);
  const startW = withCover[0]?.coverW || 0;
  let homeDuringExpand = 0;
  let both = 0;
  let maxTitles = 0;
  const titleTrace = [];
  for (const frame of frames) {
    maxTitles = Math.max(maxTitles, frame.titles || 0);
    const grew = startW > 0 && frame.coverW > startW * 1.12 && frame.coverW - startW > 24;
    const homeUp = frame.homeShown > 0;
    const songUp = frame.songShown > 0;
    if (homeUp && songUp) both += 1;
    if (homeUp && grew && frame.path === "/") homeDuringExpand += 1;
    if (titleTrace.length < 8 && (homeUp || songUp || grew)) {
      titleTrace.push({ t: frame.t, path: frame.path, titles: frame.titles, home: frame.homeShown, song: frame.songShown, coverW: frame.coverW, songO: frame.songO });
    }
  }
  const songFrames = frames.filter((frame) => frame.song);
  const songLit = songFrames.find((frame) => (frame.songO ?? 0) > 0.15);
  const holdMs = songFrames.length && songLit ? songLit.t - songFrames[0].t : null;
  const endW = [...frames].reverse().find((frame) => frame.coverW > 40)?.coverW || 0;
  return {
    frames: frames.length,
    startW,
    endW,
    maxTitles,
    both,
    homeDuringExpand,
    holdMs,
    pass: both === 0 && homeDuringExpand === 0 && maxTitles <= 1,
    trace: titleTrace,
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

async function prepare(client, profile, reduced) {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: profile.width,
    height: profile.height,
    deviceScaleFactor: 1,
    mobile: profile.mobile,
  });
  if (reduced) {
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
  }
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: BOOT });
  if (PATCHES[patch]) await client.send("Page.addScriptToEvaluateOnNewDocument", { source: PATCHES[patch] });
}

async function goto(client, path) {
  await client.send("Page.navigate", { url: `${base}${path}` });
  await waitFor(client, "document.readyState === 'complete'", 20000);
  await safeEval(client, BOOT);
}

async function homeSettled(client) {
  await waitFor(client, `(() => {
    const hero = document.querySelector(".bess-home-hero");
    const letter = document.querySelector('.bess-featured-caption[data-active="true"] h1 .bess-letter-word>span');
    if (!hero || !letter) return false;
    return hero.dataset.title === "ready" && Number(getComputedStyle(letter).opacity) > 0.85;
  })()`, 15000);
}

async function shotBurst(client, dir, prefix, ms, every) {
  await mkdir(dir, { recursive: true });
  const frames = [];
  const start = Date.now();
  let index = 0;
  while (Date.now() - start < ms) {
    let clock = null;
    let path = null;
    try {
      clock = await evaluate(client, "Math.round(performance.now())");
      path = await evaluate(client, "location.pathname");
    } catch { /* the document may be swapping */ }
    try {
      const shot = await client.send("Page.captureScreenshot", { format: "jpeg", quality: 60 });
      const name = `${prefix}-${String(index).padStart(2, "0")}-t${clock ?? "x"}.jpg`;
      await writeFile(join(dir, name), Buffer.from(shot.data, "base64"));
      frames.push({ name, t: clock, path });
      index += 1;
    } catch { /* skip a frame that landed mid-navigation */ }
    const next = index * every;
    const elapsed = Date.now() - start;
    if (next > elapsed) await delay(next - elapsed);
  }
  return frames;
}

function labelAndTile(dir, prefix, planche) {
  const labeledDir = join(dir, `${prefix}-labeled`);
  spawnSync("mkdir", ["-p", labeledDir], { stdio: "ignore" });
  const files = spawnSync("bash", ["-lc", `ls ${JSON.stringify(dir)}/${prefix}-*.jpg 2>/dev/null`], { encoding: "utf8" });
  const list = files.stdout.split("\n").filter(Boolean).sort();
  if (!list.length) return null;
  const labeled = [];
  for (const file of list) {
    const name = file.split("/").pop();
    const stamp = (name.match(/t(\d+|x)/) || [])[1] || "";
    const dest = join(labeledDir, name);
    const draw = spawnSync("ffmpeg", [
      "-y", "-i", file,
      "-vf", `drawtext=fontfile=${FONT}:text='${prefix} ${stamp}':fontsize=20:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=6:x=8:y=8`,
      dest,
    ], { stdio: "ignore" });
    labeled.push(draw.status === 0 ? dest : file);
  }
  let cols = Math.min(6, labeled.length);
  while (cols > 1 && labeled.length % cols !== 0) cols -= 1;
  const rows = Math.ceil(labeled.length / cols);
  const args = ["-y"];
  for (const file of labeled) args.push("-i", file);
  const scales = labeled.map((_, index) => `[${index}]scale=280:-1,setsar=1[s${index}]`).join(";");
  const stack = labeled.map((_, index) => `[s${index}]`).join("");
  args.push("-filter_complex", `${scales};${stack}xstack=inputs=${labeled.length}:grid=${cols}x${rows}:fill=black[out]`, "-map", "[out]", "-frames:v", "1", planche);
  const tiled = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (tiled.status !== 0) {
    process.stderr.write(`${tiled.stderr || ""}\n`.slice(-500));
    return null;
  }
  return planche;
}

async function runProfile(chrome, profile, reduced = false) {
  const { targetId } = await chrome.browser.send("Target.createTarget", { url: "about:blank" });
  const list = await fetch(`http://127.0.0.1:${chrome.port}/json/list`).then((response) => response.json());
  const page = list.find((target) => target.id === targetId);
  const client = connect(page.webSocketDebuggerUrl);
  await client.ready;
  const id = reduced ? "reduced" : profile.id;
  const dir = join(outRoot, id);
  await mkdir(dir, { recursive: true });
  try {
    await prepare(client, profile, reduced);
    await goto(client, "/");
    await homeSettled(client);
    const report = { id, patch, base, width: profile.width, height: profile.height };

    if (!only || only === "click") {
      const rest = await safeEval(client, "window.__take()");
      await click(client, "a.bess-featured-image");
      const frames = [rest, ...await sample(client, reduced ? 900 : 2800)];
      report.click = reduced ? { frames: frames.length } : classifyClick(frames);
      if (reduced) {
        const landed = frames.find((frame) => frame.path.startsWith("/son"));
        report.click.landMs = landed ? landed.t - frames[0].t : null;
        report.click.songOpacity = frames.at(-1)?.songO ?? null;
        report.click.pass = Boolean(landed) && report.click.landMs < 800 && (report.click.songOpacity ?? 0) > 0.9;
      }
      await writeFile(join(dir, "click.json"), JSON.stringify(frames));
    }

    if (!reduced && (!only || only === "logo")) {
      const onSong = await safeEval(client, "location.pathname.startsWith('/son')");
      if (!onSong) {
        await click(client, "a.bess-featured-image");
      }
      await waitFor(client, `location.pathname.startsWith('/son') && document.querySelector('a.bess-wordmark') && getComputedStyle(document.querySelector('a.bess-wordmark')).visibility !== 'hidden'`, 12000);
      await safeEval(client, `sessionStorage.setItem('bess-probe','logo')`);
      await click(client, "a.bess-wordmark");
      await waitFor(client, `location.pathname === '/' && (window.__samples || []).length > 8`, 12000);
      await delay(1500);
      await safeEval(client, `window.__probeStop = true`);
      const frames = await safeEval(client, `window.__samples || []`);
      report.logo = classifyReturn(frames);
      await writeFile(join(dir, "logo.json"), JSON.stringify(frames));
      await homeSettled(client);
    }

    if (!reduced && (!only || only === "back")) {
      const onSong = await safeEval(client, "location.pathname.startsWith('/son')");
      if (!onSong) {
        await homeSettled(client);
        await click(client, "a.bess-featured-image");
        await waitFor(client, "location.pathname.startsWith('/son')", 12000);
      }
      await safeEval(client, `(() => {
        window.__gen = (window.__gen || 0) + 1;
        const gen = window.__gen;
        window.__samples = [];
        const tick = () => {
          if (window.__gen !== gen) return;
          window.__samples.push(window.__take());
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })()`);
      await safeEval(client, "history.back()");
      await delay(1800);
      const frames = await safeEval(client, `(() => { window.__gen += 1; return window.__samples || []; })()`);
      report.back = classifyReturn(frames);
      await writeFile(join(dir, "back.json"), JSON.stringify(frames));
      await homeSettled(client);
    }

    if (!reduced && (!only || only === "arrow")) {
      await click(client, "button.bess-carousel-next");
      const frames = await sample(client, 1400);
      report.arrow = classifyReturn(frames);
      await writeFile(join(dir, "arrow.json"), JSON.stringify(frames));
    }

    if (reduced) {
      await waitFor(client, "location.pathname.startsWith('/son')", 8000);
      await click(client, "a.bess-wordmark");
      await delay(250);
      const frames = await sample(client, 900);
      const home = frames.filter((frame) => frame.path === "/");
      const end = series(home, "a", endingTitle(home)).at(-1);
      report.logo = {
        frames: home.length,
        opacityEnd: end?.o ?? null,
        tyEnd: end?.ty ?? null,
        pass: (end?.o ?? 0) > 0.9 && Math.abs(end?.ty ?? 1) < 0.08,
      };
    }

    if (shots && !reduced && !only) {
      await goto(client, "/");
      await homeSettled(client);
      const clickPromise = click(client, "a.bess-featured-image");
      const clickShots = shotBurst(client, dir, "click", 2200, 160);
      await clickPromise;
      report.clickShots = await clickShots;
      await waitFor(client, "location.pathname.startsWith('/son') && getComputedStyle(document.querySelector('a.bess-wordmark')).visibility !== 'hidden'", 12000);
      const logoPromise = click(client, "a.bess-wordmark");
      const logoShots = shotBurst(client, dir, "logo", 1500, 140);
      await logoPromise;
      report.logoShots = await logoShots;
      await homeSettled(client);
      await click(client, "a.bess-featured-image");
      await waitFor(client, "location.pathname.startsWith('/son')", 12000);
      const backPromise = safeEval(client, "history.back()");
      const backShots = shotBurst(client, dir, "back", 1500, 140);
      await backPromise;
      report.backShots = await backShots;
      report.planches = {
        click: labelAndTile(dir, "click", join(outRoot, `planche-click-${id}.jpg`)),
        logo: labelAndTile(dir, "logo", join(outRoot, `planche-logo-${id}.jpg`)),
        back: labelAndTile(dir, "back", join(outRoot, `planche-back-${id}.jpg`)),
      };
    }

    const checks = [];
    if (report.arrow) checks.push(["arrow-rise", report.arrow.verdict === "rise"]);
    if (report.logo?.verdict) checks.push(["logo-rise", report.logo.verdict === "rise"]);
    if (report.back?.verdict) checks.push(["back-rise", report.back.verdict === "rise"]);
    if (report.click?.pass !== undefined) checks.push(["click-single-title", report.click.pass === true]);
    if (report.logo?.pass !== undefined) checks.push(["reduced-logo", report.logo.pass === true]);
    report.checks = Object.fromEntries(checks);
    report.pass = checks.every(([, ok]) => ok);
    await writeFile(join(dir, "report.json"), JSON.stringify(report, null, 2));
    return report;
  } finally {
    client.close();
    await chrome.browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

const chromeProc = await launch();
const browser = connect(chromeProc.version.webSocketDebuggerUrl);
await browser.ready;
const chrome = { ...chromeProc, browser };
const reports = [];
try {
  const profiles = (only === "reduced" ? [] : PROFILES).filter((profile) => !profileArg || profile.id === profileArg);
  for (const profile of profiles) reports.push(await runProfile(chrome, profile, false));
  if (!only || only === "reduced") reports.push(await runProfile(chrome, PROFILES[0], true));
} finally {
  browser.close();
  chromeProc.proc.kill("SIGKILL");
  await rm(chromeProc.dir, { recursive: true, force: true }).catch(() => {});
}

const summary = {
  base,
  patch,
  pass: reports.every((report) => report.pass),
  reports: reports.map((report) => ({
    id: report.id,
    pass: report.pass,
    checks: report.checks,
    arrow: report.arrow ? { verdict: report.arrow.verdict, travelEm: report.arrow.travelEm, climbTy: report.arrow.climbTy, climbBlur: report.arrow.climbBlur, title: report.arrow.title } : undefined,
    logo: report.logo,
    back: report.back,
    click: report.click ? {
      pass: report.click.pass,
      maxTitles: report.click.maxTitles,
      both: report.click.both,
      homeDuringExpand: report.click.homeDuringExpand,
      holdMs: report.click.holdMs,
      startW: report.click.startW,
      endW: report.click.endW,
      landMs: report.click.landMs,
      songOpacity: report.click.songOpacity,
      trace: report.click.trace,
    } : undefined,
    planches: report.planches,
  })),
};
await mkdir(outRoot, { recursive: true });
await writeFile(join(outRoot, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
