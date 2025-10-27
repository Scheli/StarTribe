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
  zIndex = 0,                 
  clearColor = null,
  fov = 45,
  near = 0.1,
  far = 20000,
  interactive = false,        
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
    logarithmicDepthBuffer: true
  });
  renderer.setClearAlpha(0); 
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = toneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure ?? 0.9;
  renderer.shadowMap.enabled = false;

  if (clearColor != null) renderer.setClearColor(clearColor, alpha ? 0 : 1);

  const el = renderer.domElement;
  el.setAttribute("data-startribe", "engine");
  el.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: ${interactive ? "auto" : "none"};
    z-index: ${zIndex};
    touch-action: none;
    opacity: 0;                           
    transition: opacity 0.9s ease-in-out; 
  `;
  if (getComputedStyle(attachTo).position === "static") attachTo.style.position = "relative";
  attachTo.prepend(el);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, controlsOptions);
  controls.update();

  const tickers = new Set();
  let raf = null, last = performance.now();

  function onTick(cb){ tickers.add(cb); return () => tickers.delete(cb); }
  function frame(){
    raf = requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(50, now - last);
    last = now;
    for (const cb of tickers) cb(dt, now);
    controls.update();
    composer.render();
  }
  function start(){ if (!raf) frame(); }
  function stop(){ if (raf){ cancelAnimationFrame(raf); raf = null; } }
  function setInteractive(flag){ renderer.domElement.style.pointerEvents = flag ? "auto" : "none"; }

  function resize(){
    const w = attachTo.clientWidth  || window.innerWidth;
    const h = attachTo.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
  }
  resize();
  const onWinResize = () => resize();
  window.addEventListener("resize", onWinResize, { passive: true });

  function disposeMaterial(m){
    if (!m) return;
    ["map","normalMap","roughnessMap","metalnessMap","emissiveMap","aoMap","envMap","alphaMap","displacementMap"]
      .forEach(k => m[k]?.dispose?.());
    m.dispose?.();
  }
  function deepDispose(root){
    root.traverse(o => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach(disposeMaterial);
      else disposeMaterial(o.material);
    });
  }

  function dispose(){
    stop();
    window.removeEventListener("resize", onWinResize);
    controls.dispose?.();
    deepDispose(scene);
    composer?.passes?.splice(0, composer.passes.length);
    composer?.dispose?.();
    renderer.renderLists?.dispose?.();
    renderer.dispose?.();
    el.remove?.();
  }

  return { scene, camera, renderer, composer, controls, onTick, start, stop, setInteractive, dispose };
}
