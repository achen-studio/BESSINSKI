// Optional Rêver tue experiment: individual glyphs drift and rotate inside the lyrics.
export async function mountScatteredLyrics(root: HTMLDivElement, effect: "scatter" | "rotate" | "gravity" = "scatter"): Promise<() => void> {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover)").matches) return () => {};
  const base = root.querySelector<HTMLElement>(".bess-lyrics-base");
  if (!base) return () => {};
  await document.fonts.ready;
  if (!root.isConnected) return () => {};
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  canvas.className = "bess-portrait-test-canvas";
  canvas.dataset.renderer = effect === "gravity" ? "gravity-letters" : effect === "rotate" ? "rotating-letters" : "scattered-letters";
  canvas.setAttribute("aria-hidden", "true");
  const oldOpacity = base.style.opacity;
  type Letter = { text: string; x: number; y: number; dx: number; dy: number; angle: number; seed: number; falling: boolean; speed: number; wet: number; drift: number };
  let letters: Letter[] = [];
  let width = 0, height = 0, fontSize = 0, font = "", color = "";
  let active = false, stopped = false, frame = 0, last = 0, clock = 0, amount = 0;
  let pointerX = -1000, pointerY = -1000;
  function measure() {
    const box = root.getBoundingClientRect();
    width = box.width; height = root.clientHeight;
    const style = getComputedStyle(base!);
    fontSize = parseFloat(style.fontSize);
    font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    color = style.color;
    // Long lyric columns need only one device pixel per CSS pixel.
    canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    const previous = letters;
    letters = [];
    const walker = document.createTreeWalker(base!, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      let offset = 0;
      for (const text of Array.from(node.textContent || "")) {
        const start = offset; offset += text.length;
        if (!text.trim()) continue;
        const range = document.createRange(); range.setStart(node,start); range.setEnd(node,offset);
        const rect = range.getBoundingClientRect();
        const i = letters.length, old = previous[i];
        letters.push({ text, x: rect.left-box.left+rect.width/2, y: rect.top-box.top+rect.height/2,
          dx: old?.dx || 0, dy: old?.dy || 0, angle: old?.angle || 0, seed: ((i*137+53)%997)/997,
          falling: old?.falling || false, speed: old?.speed || 0, wet: old?.wet || 0, drift: old?.drift || 0 });
      }
    }
    canvas.dataset.letterCount = String(letters.length);
    if (active || amount > 0) start();
  }
  function draw(now: number) {
    frame = 0;
    if (stopped || document.hidden) return;
    const dt = Math.min(.04,Math.max(0,(now-last)/1000)); last = now;
    clock += dt;
    amount = Math.max(0,Math.min(1,amount+(active ? dt : -dt)*2.5));
    const follow = 1-Math.exp(-dt*11);
    ctx!.clearRect(0,0,width,height);
    ctx!.font = font; ctx!.fillStyle = color; ctx!.textAlign = "center"; ctx!.textBaseline = "middle";
    let motion = 0, landed = 0;
    for (const letter of letters) {
      const phase = letter.seed*Math.PI*2;
      // Use the original position so displaced glyphs cannot activate their neighbours.
      const dx = letter.x-pointerX, dy = letter.y-pointerY;
      const distance = Math.hypot(dx,dy);
      const proximity = active ? Math.max(0,1-distance/100) : 0;
      const influence = effect === "rotate" ? amount : proximity*proximity*(3-2*proximity)*amount;
      let tx = ((letter.seed-.5)*190+Math.sin(clock*1.2+phase)*45)*influence;
      let ty = (Math.cos(phase*3)*90+Math.sin(clock*.9+phase*2)*40)*influence;
      if (influence > 0) {
        const push = influence*65;
        tx += dx/Math.max(1,distance)*push; ty += dy/Math.max(1,distance)*push;
        tx = Math.max(fontSize/2-letter.x,Math.min(width-fontSize/2-letter.x,tx));
        ty = Math.max(fontSize/2-letter.y,Math.min(height-fontSize/2-letter.y,ty));
      }
      if (effect === "rotate") { tx = 0; ty = 0; }
      // Letters detach near the cursor, then fall independently to the bottom of the lyrics.
      const funnelDistance = distance/100;
      const funnel = active ? Math.max(0,1-funnelDistance) : 0;
      const gravity = funnel*funnel*(3-2*funnel)*amount;
      if(effect === "gravity") {
        letter.wet = gravity>.08 ? letter.wet+dt : 0;
        if(active && !letter.falling && letter.wet>.08+letter.seed*.4) {
          letter.falling=true;letter.speed=30+letter.seed*50;letter.drift=0;
        }
        if(!active) { letter.falling=false;letter.speed=0;letter.wet=0; }
        tx = 0;
        ty = 0;
      }
      letter.dx += (tx-letter.dx)*follow;
      if(effect === "gravity" && letter.falling) {
        letter.speed=Math.min(1200,letter.speed+(420+letter.seed*240)*dt);
        const bottom=Math.max(0,height-fontSize/2-letter.y);
        letter.dy=Math.min(bottom,letter.dy+letter.speed*dt);
        // Keep each drop in its original column; only its rotation and falling speed vary.
        if(letter.dy>=bottom) { letter.speed=0;landed++; }
      } else letter.dy += (ty-letter.dy)*follow;
      const targetAngle = effect === "rotate"
        ? (active ? Math.atan2(pointerY-letter.y,pointerX-letter.x)+Math.PI/2 : 0)
        : effect === "gravity" ? (letter.falling ? (letter.seed-.5)*Math.PI*2+Math.sin(letter.dy*.008+phase)*1.2 : 0)
        : (Math.sin(clock*.7+phase)*.65+(letter.seed-.5)*1.2)*influence;
      const angleDelta = targetAngle-letter.angle;
      letter.angle += (effect === "rotate" ? Math.atan2(Math.sin(angleDelta),Math.cos(angleDelta)) : angleDelta)*follow;
      if(effect === "rotate") letter.angle=Math.atan2(Math.sin(letter.angle),Math.cos(letter.angle));
      motion = Math.max(motion,Math.abs(letter.dx),Math.abs(letter.dy),Math.abs(letter.angle)*fontSize);
      ctx!.save();ctx!.translate(letter.x+letter.dx,letter.y+letter.dy);ctx!.rotate(letter.angle);
      ctx!.fillText(letter.text,0,0);ctx!.restore();
    }
    canvas.dataset.active = String(active);
    canvas.dataset.displacement = String(motion);
    if(effect === "gravity") canvas.dataset.landed = String(landed);
    if (active || amount > 0 || motion > .15) frame = requestAnimationFrame(draw);
    else { ctx!.clearRect(0,0,width,height);base!.style.opacity = oldOpacity; }
  }
  function start() {
    if (frame || stopped || document.hidden) return;
    base!.style.opacity = "0";last = performance.now();frame = requestAnimationFrame(draw);
  }
  function move(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    const box = root.getBoundingClientRect();
    pointerX = event.clientX-box.left; pointerY = event.clientY-box.top;
    active = true;start();
  }
  function leave() { active = false;start(); }
  function visibility() { if(document.hidden) { cancelAnimationFrame(frame);frame=0; } else if(active || amount>0) start(); }
  const observer = new ResizeObserver(measure);
  measure();root.append(canvas);root.dataset.portrait = "ready";delete root.dataset.active;
  observer.observe(root);
  root.addEventListener("pointermove",move);root.addEventListener("pointerleave",leave);
  window.addEventListener("blur",leave);document.addEventListener("visibilitychange",visibility);
  return () => {
    stopped = true;cancelAnimationFrame(frame);observer.disconnect();
    root.removeEventListener("pointermove",move);root.removeEventListener("pointerleave",leave);
    window.removeEventListener("blur",leave);document.removeEventListener("visibilitychange",visibility);
    base.style.opacity = oldOpacity;delete root.dataset.portrait;canvas.remove();
  };
}
