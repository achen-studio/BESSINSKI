import * as THREE from "three";

// Only glyphs are rendered; a luminance lookup controls their density along the silhouette.
export async function mountPortraitTest(root: HTMLDivElement): Promise<() => void> {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover)").matches) return () => {};
  const base = root.querySelector<HTMLElement>(".bess-lyrics-base");
  if (!base) return () => {};
  const region = root.parentElement!;
  const heading = region.querySelector<HTMLElement>("h2");
  const savedRootStyle = root.getAttribute("style");
  const savedBaseStyle = base.getAttribute("style");
  const photo = new Image();
  photo.src = "/bess/silhouette-rain-reference.jpg";
  await Promise.all([photo.decode(), document.fonts.ready]);
  if (!root.isConnected) return () => {};
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
  catch { return () => {}; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setClearColor(0, 0);
  const canvas = renderer.domElement;
  canvas.className = "bess-portrait-test-canvas"; canvas.setAttribute("aria-hidden", "true");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
  const alphabet = Array.from(new Set(((heading?.textContent || "")+(base.textContent || "BESSINSKI")).replace(/\s/g, ""))).slice(0, 128);
  const atlas = document.createElement("canvas"); atlas.width = 1024; atlas.height = 512;
  const ink = atlas.getContext("2d")!;
  ink.fillStyle = "white"; ink.font = '48px "Roboto Condensed", sans-serif';
  ink.textAlign = "center"; ink.textBaseline = "middle";
  alphabet.forEach((letter, i) => ink.fillText(letter, (i % 16) * 64 + 32, Math.floor(i / 16) * 64 + 32));
  const glyphAtlas = new THREE.CanvasTexture(atlas);
  const aspect = photo.naturalHeight / photo.naturalWidth;
  const sample = document.createElement("canvas"); sample.width = 160; sample.height = Math.round(160 * aspect);
  const ctx = sample.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(photo, 0, 0, sample.width, sample.height);
  const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
  const density = new THREE.DataTexture(new Uint8Array(pixels), sample.width, sample.height);
  density.minFilter = THREE.LinearFilter; density.magFilter = THREE.LinearFilter; density.needsUpdate = true;
  const targets: number[] = [], strengths: number[] = [], sizes: number[] = [], layers: number[] = [];
  for (let col = 0; col < 112; col++) for (let row = 0; row < 200; row++) {
    const seed = ((col * 73) % 127) / 127;
    targets.push((col + .5) / 112, (row + seed) / 200, .025 + seed * .045);
    strengths.push(.7 + seed * .3);
    sizes.push(1.15 + ((col * 17 + row * 23) % 71) / 71 * .95);
    layers.push(0);
  }
  const count = strengths.length;
  const origin = new Float32Array(count * 3), glyphs = new Float32Array(count);
  const phases = new Float32Array(count);
  const delays = new Float32Array(count), sourceWeights = new Float32Array(count);
  const impulses = new Float32Array(count * 2), velocities = new Float32Array(count * 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("position", new THREE.BufferAttribute(origin, 3));
  geometry.setAttribute("target", new THREE.Float32BufferAttribute(targets, 3));
  geometry.setAttribute("strength", new THREE.Float32BufferAttribute(strengths, 1));
  geometry.setAttribute("letterSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("glyph", new THREE.BufferAttribute(glyphs, 1));
  geometry.setAttribute("layer", new THREE.Float32BufferAttribute(layers, 1));
  geometry.setAttribute("delay", new THREE.BufferAttribute(delays, 1));
  geometry.setAttribute("sourceWeight", new THREE.BufferAttribute(sourceWeights, 1));
  geometry.setAttribute("impulse", new THREE.BufferAttribute(impulses, 2).setUsage(THREE.DynamicDrawUsage));
  const uniforms = {
    atlas: { value: glyphAtlas }, density: { value: density }, amount: { value: 0 }, time: { value: 0 }, aspect: { value: aspect },
    size: { value: 800 }, center: { value: new THREE.Vector2() },
    sourceOffset: { value: 0 }, elapsed: { value: 0 }, viewWidth: { value: 800 }, left: { value: 0 }, viewHeight: { value: 800 },
    maxLetterSize: { value: 32 }, sourceLetterSize: { value: 24 }, ratio: { value: renderer.getPixelRatio() }, cameraDistance: { value: 2000 },
  };
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, uniforms,
    vertexShader: `
      attribute vec3 target; attribute float strength; attribute float letterSize; attribute float glyph;
      attribute float phase; attribute float layer; attribute float delay; attribute float sourceWeight; attribute vec2 impulse;
      uniform float amount; uniform float time; uniform float aspect; uniform float size; uniform vec2 center;
      uniform sampler2D density;
      uniform float maxLetterSize; uniform float sourceLetterSize; uniform float ratio; uniform float cameraDistance;
      uniform float sourceOffset; uniform float elapsed; uniform float viewWidth; uniform float viewHeight; uniform float left;
      varying float vStrength; varying float vGlyph;
      void main() {
        float fallingY = fract(target.y+time*target.z);
        float light = texture2D(density,vec2(target.x,fallingY)).r;
        vec3 p = vec3((target.x-.5)*size,(.5-fallingY)*size*aspect,0.);
        p.xy += center;
        if(abs(layer)>.5) p = vec3(left+target.x*viewWidth,-target.y*viewHeight,0.);
        float progress = smoothstep(0.,1.,phase);
        vec3 travel = mix(position+vec3(0.,sourceOffset,0.),p,progress);
        float arc = sin(progress*3.14159265);
        travel.x += arc*(target.x-.5)*viewWidth*.35;
        travel.y += arc*(.2+target.x*.15)*viewHeight;
        travel.xy += impulse*progress;
        vec4 mv = modelViewMatrix*vec4(travel,1.);
        gl_Position = projectionMatrix*mv;
        float projected = max(8.,size/112.*1.65)*letterSize*cameraDistance/(-mv.z);
        if(abs(layer)>.5) projected = maxLetterSize*(layer>0. ? 1. : .82);
        gl_PointSize = min(maxLetterSize,mix(sourceLetterSize,projected,progress))*ratio;
        float columnSeed = fract(sin(floor(target.x*112.)*127.1)*43758.5453);
        float top = .015+columnSeed*.085;
        float bottom = .015+fract(columnSeed*7.13)*.085;
        float edge = smoothstep(top,top+.09,fallingY)*(1.-smoothstep(1.-bottom-.09,1.-bottom,fallingY));
        float finalInk = min(1.,pow(light,.65)*2.1)*strength*edge;
        if(abs(layer)>.5) finalInk = strength;
        vStrength = mix(sourceWeight,finalInk,smoothstep(.05,.85,progress))*smoothstep(0.,.2,phase*1.7);
        vGlyph = glyph;
      }`,
    fragmentShader: `
      uniform sampler2D atlas; varying float vStrength; varying float vGlyph;
      void main() {
        vec2 cell = vec2(mod(vGlyph,16.),floor(vGlyph/16.));
        vec2 uv = vec2((cell.x+gl_PointCoord.x)/16.,1.-(cell.y+gl_PointCoord.y)/8.);
        float alpha = texture2D(atlas,uv).a*vStrength;
        if(alpha<.01) discard;
        gl_FragColor = vec4(0.,0.,0.,alpha);
      }`,
  });
  const letters = new THREE.Points(geometry, material); letters.frustumCulled = false; scene.add(letters);
  let active = false, stopped = false, frame = 0, last = performance.now();
  let pointerInside = false, canvasHeight = 0;
  let naturalHeight = 0, compactHeight = 0;
  let inView = true;
  let transitionEnd = 2.9;
  const pointer = new THREE.Vector2();
  const paragraphs = [...(heading ? [heading] : []), ...Array.from(base.querySelectorAll<HTMLElement>("p"))];
  const originalChildren = paragraphs.map(p=>Array.from(p.childNodes));
  const sourceLetters: HTMLElement[] = [];
  let characterDelays: number[] = [];
  function splitSourceLetters() {
    paragraphs.forEach(p=>{
      const fragment=document.createDocumentFragment();
      for(const letter of Array.from(p.textContent || "")) {
        if(!letter.trim()) { fragment.append(document.createTextNode(letter));continue; }
        const span=document.createElement("span");span.textContent=letter;
        sourceLetters.push(span);fragment.append(span);
      }
      p.replaceChildren(fragment);
    });
  }
  function updateHeight() {
    const progress = THREE.MathUtils.smoothstep(uniforms.elapsed.value/transitionEnd,0,1);
    root.style.height = `${THREE.MathUtils.lerp(naturalHeight,compactHeight,progress)}px`;
  }
  function resize() {
    const box = root.getBoundingClientRect();
    naturalHeight = base!.scrollHeight;
    const feature = root.closest(".bess-lyrics-section")?.querySelector(".bess-lyric-feature")?.getBoundingClientRect();
    const platforms = root.closest(".bess-lyrics-section")?.querySelector(".bess-platforms")?.getBoundingClientRect();
    compactHeight = Math.max(360,(platforms?.bottom ?? feature?.bottom ?? box.top+800)-box.top);
    const left = feature ? feature.right - feature.width * .25 - box.left : -box.width * .3;
    const right = document.documentElement.clientWidth - box.left;
    const viewWidth = right - left, viewHeight = compactHeight;
    canvasHeight = viewHeight;
    // Extend the drawing surface, not the hover region or the silhouette geometry.
    const videoElement = root.closest(".bess-song-content")?.querySelector(".bess-video");
    const video = videoElement?.getBoundingClientRect();
    const videoTransform = videoElement ? getComputedStyle(videoElement).transform : "none";
    const revealOffset = videoTransform === "none" ? 0 : new DOMMatrixReadOnly(videoTransform).m42;
    const canvasTop = video ? video.bottom-revealOffset-box.top : -24;
    const renderHeight = viewHeight-canvasTop;
    renderer.setSize(viewWidth, renderHeight);
    Object.assign(canvas.style, { left: `${left}px`, right: "auto", top: `${canvasTop}px`, maxWidth: "none" });
    const distance = renderHeight / (2 * Math.tan(THREE.MathUtils.degToRad(35) / 2));
    camera.aspect = viewWidth / renderHeight;
    const cameraY = -canvasTop-renderHeight/2;
    camera.position.set((left + right) / 2, cameraY, distance);
    camera.lookAt((left + right) / 2, cameraY, 0); camera.updateProjectionMatrix();
    uniforms.cameraDistance.value = distance;
    uniforms.size.value = Math.min(viewWidth * .91, viewHeight / aspect);
    uniforms.viewWidth.value = viewWidth; uniforms.viewHeight.value = viewHeight; uniforms.left.value = left;
    uniforms.center.value.set((left + right) / 2, -uniforms.size.value * aspect / 2);
    const fontSize=parseFloat(getComputedStyle(base!).fontSize);
    uniforms.sourceLetterSize.value=fontSize*4/3;
    uniforms.maxLetterSize.value=fontSize*1.65;
    const positions: { x: number; y: number; glyph: number }[] = [];
    for(const paragraph of paragraphs) {
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent || "";
      for (let j = 0; j < text.length; j++) {
        if (!text[j].trim()) continue;
        const range = document.createRange(); range.setStart(node, j); range.setEnd(node, j + 1);
        const r = range.getBoundingClientRect();
        positions.push({ x: r.x - box.x + r.width / 2, y: -(r.y - box.y + r.height / 2), glyph: Math.max(0, alphabet.indexOf(text[j])) });
      }
    }
    }
    characterDelays = positions.map((p,index)=> {
      const scatter=((index*137+31)%997)/997;
      return scatter*.85+Math.min(.3,Math.max(0,-p.y/viewHeight)*.18);
    });
    transitionEnd = Math.max(0,...characterDelays)+1.7;
    for (let i = 0; i < count; i++) {
      const p = positions[i % positions.length]; if (!p) continue;
      origin[i * 3] = p.x; origin[i * 3 + 1] = p.y; glyphs[i] = p.glyph;
      delays[i] = characterDelays[i % positions.length];
      sourceWeights[i] = i < positions.length ? 1 : 0;
    }
    geometry.attributes.position.needsUpdate = true; geometry.attributes.glyph.needsUpdate = true;
    geometry.attributes.delay.needsUpdate = true; geometry.attributes.sourceWeight.needsUpdate = true;
    updateHeight();
  }
  function draw(now: number) {
    if (stopped) return;
    if(document.hidden || !inView) { frame=0; return; }
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now;
    const follow = 1 - Math.exp(-dt * 8);
    uniforms.amount.value += ((active ? 1 : 0) - uniforms.amount.value) * follow;
    if(active && uniforms.elapsed.value>=transitionEnd) uniforms.time.value += dt;
    // One reversible timeline preserves the same paths and character stagger both ways.
    uniforms.elapsed.value=THREE.MathUtils.clamp(uniforms.elapsed.value+(active ? dt : -dt)*2.3,0,transitionEnd);
    for(let i=0;i<count;i++) {
      phases[i]=THREE.MathUtils.clamp((uniforms.elapsed.value-delays[i])/1.7,0,1);
    }
    geometry.attributes.phase.needsUpdate=true;
    sourceLetters.forEach((letter, i) => {
      const opacity=String(1-THREE.MathUtils.smoothstep(phases[i]*1.7,0,.2));
      if(letter.style.opacity!==opacity) letter.style.opacity=opacity;
    });
    updateHeight();
    const size = uniforms.size.value, center = uniforms.center.value;
    let maxImpulse = 0;
    for(let i=0;i<count;i++) {
      const j=i*2, t=i*3, layer=layers[i];
      const fallingY=(targets[t+1]+uniforms.time.value*targets[t+2])%1;
      const x=layer ? uniforms.left.value+targets[t]*uniforms.viewWidth.value : (targets[t]-.5)*size+center.x;
      const y=layer ? -targets[t+1]*canvasHeight : (.5-fallingY)*size*aspect+center.y;
      const dx=x+impulses[j]-pointer.x, dy=y+impulses[j+1]-pointer.y;
      const distance=Math.hypot(dx,dy), radius=110;
      let fx=0,fy=0;
      if(pointerInside && distance<radius) {
        const force=(1-distance/radius)*1700*(layer>0 ? 1.6 : layer<0 ? .45 : .8);
        fx=dx/Math.max(1,distance)*force;fy=dy/Math.max(1,distance)*force;
      }
      velocities[j]+=(fx-impulses[j]*30-velocities[j]*9)*dt;
      velocities[j+1]+=(fy-impulses[j+1]*30-velocities[j+1]*9)*dt;
      impulses[j]+=velocities[j]*dt;impulses[j+1]+=velocities[j+1]*dt;
      maxImpulse=Math.max(maxImpulse,Math.hypot(impulses[j],impulses[j+1]));
    }
    geometry.attributes.impulse.needsUpdate=true;
    renderer.render(scene, camera);
    canvas.dataset.rainTime = String(uniforms.time.value);
    canvas.dataset.maxDisplacement = String(maxImpulse);
    canvas.dataset.latched = String(active);
    canvas.dataset.stickyOffset = "0";
    if (active || uniforms.elapsed.value > 0) frame = requestAnimationFrame(draw);
    else { frame = 0; base!.style.removeProperty("opacity"); }
  }
  function start() { if (!frame && !stopped && !document.hidden && inView) { last = performance.now(); frame = requestAnimationFrame(draw); } }
  function move(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    const box=root.getBoundingClientRect();
    pointer.set(event.clientX-box.left,-(event.clientY-box.top));pointerInside=true;
    active = true; start();
  }
  function leave() { pointerInside=false;active=false;start(); }
  function followPointer(event: PointerEvent) {
    if((!active && uniforms.elapsed.value===0) || event.pointerType==="touch") return;
    const r=region.getBoundingClientRect(), box=root.getBoundingClientRect();
    pointerInside=event.clientX>=r.left && event.clientX<=r.right && event.clientY>=r.top && event.clientY<=r.bottom;
    pointer.set(event.clientX-box.left,-(event.clientY-box.top));
    active=pointerInside;start();
  }
  function lost(event: Event) { event.preventDefault(); cleanup(); }
  let observedWidth = 0;
  let resizeFrame = 0;
  const observer = new ResizeObserver(([entry]) => {
    if(entry.contentRect.width!==observedWidth) {
      observedWidth=entry.contentRect.width;
      cancelAnimationFrame(resizeFrame);
      resizeFrame=requestAnimationFrame(()=>{ if(!stopped) resize(); });
    }
  });
  const visibility = new IntersectionObserver(([entry]) => {
    inView=entry.isIntersecting;
    if(inView && (active || uniforms.elapsed.value>0)) start();
  });
  function visibilityChange() { if(!document.hidden && (active || uniforms.elapsed.value>0)) start(); }
  function cleanup() {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame); observer.disconnect(); visibility.disconnect();
    region.removeEventListener("pointermove", move); region.removeEventListener("pointerleave", leave);
    window.removeEventListener("blur", leave); canvas.removeEventListener("webglcontextlost", lost);
    window.removeEventListener("pointermove",followPointer);window.removeEventListener("resize",resize);
    document.removeEventListener("visibilitychange",visibilityChange);
    paragraphs.forEach((p,i)=>p.replaceChildren(...originalChildren[i]));
    if(savedRootStyle===null) root.removeAttribute("style"); else root.setAttribute("style",savedRootStyle);
    if(savedBaseStyle===null) base!.removeAttribute("style"); else base!.setAttribute("style",savedBaseStyle);
    delete root.dataset.portrait; base!.style.removeProperty("opacity"); canvas.remove();
    geometry.dispose(); material.dispose(); glyphAtlas.dispose(); density.dispose(); renderer.dispose();
  }
  try {
    splitSourceLetters(); resize();
    base!.style.height="100%"; base!.style.overflow="hidden";
    renderer.render(scene, camera); root.append(canvas);
    canvas.dataset.renderer = "letters-only"; canvas.dataset.letterCount = String(count);
    delete root.dataset.active; root.dataset.portrait = "ready";
    observer.observe(root); region.addEventListener("pointermove", move); region.addEventListener("pointerleave", leave);
    visibility.observe(root);document.addEventListener("visibilitychange",visibilityChange);
    window.addEventListener("blur", leave); canvas.addEventListener("webglcontextlost", lost);
    window.addEventListener("pointermove",followPointer,{passive:true});window.addEventListener("resize",resize);
  } catch { cleanup(); }
  return cleanup;
}
