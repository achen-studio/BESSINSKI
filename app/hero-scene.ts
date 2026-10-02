import * as THREE from "three";
import { createHeroMotion, type HeroPresentation } from "./hero-motion";

const vertexShader = `
  uniform float uFold;
  uniform float uSide;
  uniform float uTravel;
  uniform vec2 uSize;
  varying vec2 vUv;
  varying float vShade;
  void main() {
    vUv = uv;
    float delay = (1.0 - uv.x) * 0.42;
    float angle = 3.14159265 * smoothstep(0.0, 1.0, (uFold - delay) / (1.0 - delay));
    vec3 p = position;
    p.xy *= uSize;
    float y = p.y;
    p.y = y * cos(angle);
    p.z = y * sin(angle) - uFold * 26.0;
    p.x += uSide * uFold * uTravel;
    vShade = abs(sin(angle)) * 0.24 + step(cos(angle), 0.0) * 0.18;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform vec2 uCrop;
  uniform vec2 uSize;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vShade;
  void main() {
    vec2 cropUv = (vUv - 0.5) * uCrop + 0.5;
    vec4 color = texture2D(uTexture, cropUv);
    vec2 edge = abs((vUv - 0.5) * uSize) - uSize * 0.5 + 5.0;
    float rounded = length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0) - 5.0;
    color.a *= (1.0 - smoothstep(-0.8, 0.8, rounded)) * uOpacity;
    color.rgb *= 1.0 - vShade;
    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;

export function createHeroScene(canvas: HTMLCanvasElement, hero: HTMLElement, cover: HTMLElement, sources: string[], initial: number, ready: (value: boolean) => void, arrive: HeroPresentation) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 10000);
  const geometry = new THREE.PlaneGeometry(1, 1, 64, 12);
  const textures: THREE.Texture[] = [];
  let disposed = false;
  let loaded = false;
  let visible = true;
  let lost = false;
  let current = initial;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const materials = sources.map(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, side: THREE.DoubleSide,
    depthTest: false, depthWrite: false,
    uniforms: {
      uTexture: { value: null }, uFold: { value: 0 }, uSide: { value: 1 },
      uTravel: { value: 0 }, uSize: { value: new THREE.Vector2(1, 1) },
      uCrop: { value: new THREE.Vector2(1, 1) }, uOpacity: { value: 0 },
    },
  }));
  const meshes = materials.map(material => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  });
  const render = () => {
    if (disposed || !loaded || !visible || lost || document.hidden) return;
    motion.sheets.forEach((sheet, index) => {
      materials[index].uniforms.uFold.value = sheet.fold;
      materials[index].uniforms.uSide.value = sheet.side;
      materials[index].uniforms.uOpacity.value = Math.min(1, sheet.opacity * 4);
      meshes[index].visible = sheet.opacity > 0.001;
      meshes[index].renderOrder = index === current ? 1 : 0;
    });
    renderer.render(scene, camera);
  };
  const motion = createHeroMotion(sources.length, initial, render, arrive);
  const resize = () => {
    if (disposed) return;
    const bounds = hero.getBoundingClientRect();
    const card = cover.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    renderer.setSize(bounds.width, bounds.height, false);
    camera.aspect = bounds.width / bounds.height;
    camera.position.z = Math.max(bounds.width, 920) * 1.62;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(bounds.height / (2 * camera.position.z)));
    camera.updateProjectionMatrix();
    meshes.forEach((mesh, index) => {
      mesh.position.set(card.left - bounds.left + card.width / 2 - bounds.width / 2, bounds.height / 2 - (card.top - bounds.top + card.height / 2), 0);
      const uniforms = materials[index].uniforms;
      uniforms.uSize.value.set(card.width, card.height);
      uniforms.uTravel.value = bounds.width * 0.5 + card.width * 0.54;
      const image = textures[index]?.image as HTMLImageElement | undefined;
      if (image) {
        const ratio = (image.width / image.height) / (card.width / card.height);
        uniforms.uCrop.value.set(Math.min(1, 1 / ratio), Math.min(1, ratio));
      }
    });
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(hero);
  observer.observe(cover);
  const updateVisibility = () => {
    if (!visible || document.hidden) motion.pause();
    else { motion.resume(); render(); }
  };
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; updateVisibility(); });
  intersection.observe(hero);
  document.addEventListener("visibilitychange", updateVisibility);
  const onPreference = () => { if (reduced.matches) motion.select(current, true); };
  reduced.addEventListener("change", onPreference);
  const onLost = (event: Event) => { event.preventDefault(); lost = true; ready(false); motion.pause(); };
  const onRestored = () => { lost = false; resize(); updateVisibility(); ready(loaded); };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const loader = new THREE.TextureLoader();
  Promise.all(sources.map(async (source, index) => {
    const texture = await loader.loadAsync(source);
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    textures[index] = texture;
    materials[index].uniforms.uTexture.value = texture;
  })).then(() => {
    if (disposed) return;
    loaded = true;
    motion.select(current, true);
    resize();
    ready(true);
  }).catch(() => { if (!disposed) ready(false); });
  resize();

  return {
    select(index: number, direction?: number) {
      current = index;
      motion.select(index, reduced.matches || !loaded, direction);
      updateVisibility();
    },
    destroy() {
      disposed = true;
      motion.destroy();
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
      reduced.removeEventListener("change", onPreference);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      geometry.dispose();
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      renderer.dispose();
    },
  };
}
