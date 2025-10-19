import * as THREE from "three";
import { createSky } from "../core/common/sky.js";

export function mountAuthSky(container, {
  textureUrl   = "../js/core/backgrounds/textures/stars_milky_way.jpg",
  radius       = 4000,
  camYawDegSec = 0.8,   
  camPitchAmp  = 0.015, 
  camPitchHz   = 0.06   
} = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 1);

  const canvas = renderer.domElement;
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "-1";
  canvas.style.pointerEvents = "none";
  container.appendChild(canvas);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 10000);
  camera.position.set(0, 0, 2);
  const basePitch = camera.rotation.x;

  const S = createSky({ scene, camera, textureUrl, radius, twinkle: true });

  let last = performance.now();
  let raf = 0;

  const animate = (now = 0) => {
    raf = requestAnimationFrame(animate);
    const dt = (now - last) * 0.001; 
    last = now;

    const yawRadPerSec = THREE.MathUtils.degToRad(camYawDegSec);
    camera.rotateY(yawRadPerSec * dt);

    const pitch = camPitchAmp * Math.sin(2 * Math.PI * camPitchHz * (now * 0.001));
    camera.rotation.x = basePitch + pitch;

    S.update(now);              
    renderer.render(scene, camera);
  };
  animate();

  const onResize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    S.dispose();
    renderer.dispose();
    if (canvas.parentNode === container) container.removeChild(canvas);
  };
}
