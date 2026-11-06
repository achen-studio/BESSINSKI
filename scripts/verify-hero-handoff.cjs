const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const out = process.env.OUT || '/tmp/bess-handoff';
const base = process.env.BASE_URL || 'http://127.0.0.1:4174';
fs.mkdirSync(out, { recursive: true });
async function instrument({ noGL }) {
  const events = window.__heroEvents = [];
  const log = (type, data = {}) => events.push({ t: performance.now(), type, ...data });
  window.__heroLog = log;
  const watch = img => {
    img.addEventListener('load', () => log('image-load', { src: img.src, connected: img.isConnected }));
    img.addEventListener('error', () => log('image-error', { src: img.src }));
    return img;
  };
  const create = document.createElementNS.bind(document);
  document.createElementNS = (...args) => {
    const element = create(...args);
    return element instanceof HTMLImageElement ? watch(element) : element;
  };
  const decode = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = function () {
    log('decode-start', { src: this.src });
    return decode.call(this).then(() => log('decode-end', { src: this.src }));
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    if (noGL && /webgl/.test(kind)) { window.__glDenied = true; return null; }
    const gl = getContext.call(this, kind, ...args);
    if (gl && /webgl/.test(kind) && !gl.__watched) {
      gl.__watched = true;
      const draw = gl.drawElements.bind(gl);
      gl.drawElements = (...values) => {
        draw(...values);
        if (this.classList.contains('bess-hero-canvas')) {
          const pixel = new Uint8Array(4);
          gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          if (!gl.__drawn) log('first-WebGL-draw', { pixel: [...pixel] });
          gl.__drawn = true;
          window.__heroDrawn = true;
        }
      };
      const upload = gl.texImage2D.bind(gl);
      gl.texImage2D = (...values) => {
        const source = values.at(-1);
        if (source instanceof HTMLImageElement) log('texture-upload', { src: source.src });
        return upload(...values);
      };
      const subUpload = gl.texSubImage2D.bind(gl);
      gl.texSubImage2D = (...values) => {
        const source = values.at(-1);
        if (source instanceof HTMLImageElement) log('texture-upload', { src: source.src });
        return subUpload(...values);
      };
    }
    return gl;
  };
  let previous = '', lastImage, lastCanvas;
  const sample = () => {
    const hero = document.querySelector('.bess-home-hero');
    const image = hero?.querySelector('.bess-featured-image img');
    const canvas = hero?.querySelector('.bess-hero-canvas');
    if (image && image !== lastImage) {
      log('image-mounted', { src: image.src });
      watch(image);
      image.decode().catch(() => {});
      lastImage = image;
    }
    if (canvas && canvas !== lastCanvas) { log('canvas-mounted'); lastCanvas = canvas; }
    if (image && canvas) {
      const data = { renderer: hero.dataset.renderer, image: getComputedStyle(image).opacity, canvas: getComputedStyle(canvas).opacity, complete: image.complete, drawn: !!window.__heroDrawn, navigating: !!hero.dataset.navigating };
      const signature = JSON.stringify(data);
      if (signature !== previous) {
        log('visibility', data);
        previous = signature;
        if (data.navigating && window.__saveHeroTrace) void window.__saveHeroTrace(events);
      }
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  window.addEventListener('pagehide', () => { log('pagehide'); console.debug('HERONAV:' + JSON.stringify(events)); });
}
(async () => {
  const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
  const browser = await engine.launch(engine === chromium ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {});
  const results = [];
  try {
    for (const width of [390, 1440]) {
      for (const mode of (process.env.MODES || 'normal,slow,no-webgl').split(',')) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
        await context.addInitScript(instrument, { noGL: mode === 'no-webgl' });
        const page = await context.newPage();
        let traceName = '';
        await page.exposeFunction('__saveHeroTrace', data => {
          fs.writeFileSync(`${out}/${traceName}-navigation.json`, JSON.stringify(data, null, 2));
        });
        page.on('console', message => {
          if (message.text().startsWith('HERONAV:')) {
            const data = JSON.parse(message.text().slice(8));
            if (data.some(event => event.navigating)) fs.writeFileSync(`${out}/${traceName}-navigation.json`, JSON.stringify(data, null, 2));
          }
        });
        if (mode === 'slow' && engine === chromium) {
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
        } else if (mode === 'slow') {
          await page.route('**/*', async route => { await new Promise(r => setTimeout(r, 150)); await route.continue(); });
        }
        for (const cache of mode === 'normal' ? ['cold', 'warm'] : ['cold']) {
          traceName = `${width}-${mode}-${cache}`;
          await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
          await page.waitForFunction(noGL => noGL ? window.__glDenied && document.querySelector('.bess-featured-image img')?.complete : document.querySelector('.bess-home-hero')?.dataset.renderer === 'webgl', mode === 'no-webgl', { timeout: 120000 });
          await page.screenshot({ path: `${out}/${traceName}-handoff.png` });
          await page.waitForTimeout(400);
          const events = await page.evaluate(() => window.__heroEvents);
          const dips = events.filter(e => e.type === 'visibility' && e.renderer === 'webgl' && e.complete && !e.navigating && Number(e.image) === 0 && Number(e.canvas) < .999);
          const premature = events.filter(e => e.type === 'visibility' && e.renderer === 'webgl' && !e.drawn);
          const firstFrameValid = mode === 'no-webgl' || events.some(e => e.type === 'first-WebGL-draw' && e.pixel[3] === 255);
          const fallbackVisible = mode !== 'no-webgl' || await page.locator('.bess-featured-image img').evaluate(e => e.naturalWidth > 0 && getComputedStyle(e).opacity === '1');
          const name = `${width}-${mode}-${cache}`;
          fs.writeFileSync(`${out}/${name}.json`, JSON.stringify(events, null, 2));
          await page.screenshot({ path: `${out}/${name}.png` });
          const imageSrc = await page.locator('.bess-featured-image img').getAttribute('src');
          await page.locator('.bess-featured-image').click();
          await page.waitForURL('**/son', { waitUntil: 'domcontentloaded', timeout: 120000 });
          await page.waitForFunction(() => document.querySelector('.bess-song-hero-image')?.complete);
          const destination = await page.locator('.bess-song-hero-image').getAttribute('src');
          results.push({ name, dips: dips.length, premature: premature.length, sameAsset: imageSrc === destination, firstFrameValid, fallbackVisible });
          console.log(results.at(-1));
          await page.goBack({ waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => document.querySelector('.bess-home-hero') && !document.querySelector('.bess-home-hero').dataset.navigating);
        }
        await context.close();
      }
    }
  } finally { await browser.close(); fs.writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2)); }
  if (!process.env.EXPECT_BASELINE && results.some(result => result.dips || result.premature || !result.sameAsset || !result.firstFrameValid || !result.fallbackVisible)) {
    throw new Error('Hero handoff regression; inspect the saved traces.');
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
