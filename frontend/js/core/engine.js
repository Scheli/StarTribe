import * as THREE from "three";
import { OrbitControls }  from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass }     from "three/addons/postprocessing/RenderPass.js";

export function createEngine({
  alpha = true,
  antialias = true,
  toneMapping = THREE.ACESFilmicToneMapping,
  exposure = 0.9,
  attachTo = document.body,
  zIndex = -1,
  clearColor = null,
  fov = 45,
  near = 0.1,
  far = 20000,
  // Abilita input mouse/touch sul canvas
  interactive = true,
  // Opzioni base per OrbitControls (puoi cambiarle dopo via engine.controls)
  controlsOptions = {
    enableDamping: true,
    enablePan: false,
    enableZoom: true,
    minDistance: 1.0,
    maxDistance: 5000,
    minPolarAngle: 0.01,
    maxPolarAngle: Math.PI - 0.01,
    rotateSpeed: 0.9,
    zoomSpeed: 0.8,
    dampingFactor: 0.08
  }
} = {}) {

  const scene  = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    fov,
    window.innerWidth / window.innerHeight,
    near,
    far
  );
  camera.position.set(0, 0, 4);

  const renderer = new THREE.WebGLRenderer({
    alpha,
    antialias,
    powerPreference: "high-performance",
    logarithmicDepthBuffer: true, 
  });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = toneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure ?? 0.9;
  // Se non usi ombre, lasciale off per risparmiare
  renderer.shadowMap.enabled = false; // true se ti servono
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  if (clearColor != null) renderer.setClearColor(clearColor, alpha ? 0 : 1);

  // stile canvas fullscreen
  renderer.domElement.style.cssText = `
    position: fixed; inset: 0; width: 100%; height: 100%;
    display:block; pointer-events:${interactive ? "auto" : "none"}; z-index:${zIndex};
    touch-action: none;
  `;
  attachTo.prepend(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, controlsOptions);
  controls.update();

  const tickers = new Set();
  let raf = null;
  let last = performance.now();

  function onTick(cb) { tickers.add(cb); return () => tickers.delete(cb); }

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt  = Math.min(50, now - last);
    last = now;

    for (const cb of tickers) cb(dt, now);
    controls.update();
    composer.render();
  }
  function start(){ if (!raf) frame(); }
  function stop(){ if (raf){ cancelAnimationFrame(raf); raf = null; } }

  // attiva/disattiva interazione del canvas
  function setInteractive(flag){
    renderer.domElement.style.pointerEvents = flag ? "auto" : "none";
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  }, { passive: true });

  return { scene, camera, renderer, composer, controls, onTick, start, stop, setInteractive };
}
