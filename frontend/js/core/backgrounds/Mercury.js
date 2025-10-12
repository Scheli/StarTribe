import * as THREE from "three";
import { GLTFLoader }      from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { UP_AXIS, prepPlanetMaterials, createOrbitRig, smoothFocusAuto, extendOrbitRigWithAuto} from "../utils.js";

import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA } from "../config.js";
import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";

/* Assets */
const TEX_SKY        = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const MODEL_SUN      = new URL("./models/Sun.glb",               import.meta.url).href;
const MODEL_MERCURY  = new URL("./models/Mercury.glb",           import.meta.url).href;

/* Orbita / assetto */
const MER_ECC         = ELEMENTS.MERCURY.ecc;
const MER_INCL_DEG    = ELEMENTS.MERCURY.incl_deg;
const MER_RAAN_DEG    = ELEMENTS.MERCURY.raan_deg;
const MER_ARGPERI_DEG = ELEMENTS.MERCURY.argperi_deg;
const MER_OBLQ_DEG    = ELEMENTS.MERCURY.obliquity_deg;

const MER_A     = SCALE.AU * ELEMENTS.MERCURY.a_AU;
const MER_ORBIT = ORBIT.MERCURY * TIME.SPEED;

// Spin: 3:2 risonante (vero per Mercurio) o valore tabellato ROT.MERCURY
const USE_RESONANT_3to2 = true;
const MER_SPIN = USE_RESONANT_3to2
  ? (1.5 * ORBIT.MERCURY) * TIME.SPEED   // 3:2 della velocità orbitale media
  : ROT.MERCURY * TIME.SPEED;

/* Helpers */
function keplerSolve(M, e){
  let E = M;
  for (let k=0;k<4;k++){
    const f  = E - e*Math.sin(E) - M;
    const fp = 1 - e*Math.cos(E);
    E -= f/fp;
  }
  const cosE = Math.cos(E), sinE = Math.sin(E);
  return { r: 1 - e*cosE, nu: Math.atan2(Math.sqrt(1-e*e)*sinE, cosE - e) };
}

/* Entry */
export async function initBackground(engine){
  const { scene, camera, composer, onTick } = engine;

  // Bloom
  let bloomPass = null;
  if (POSTFX?.BLOOM?.enabled){
    const { strength, radius, threshold } = POSTFX.BLOOM;
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      strength, radius, threshold
    );
    composer.addPass(bloomPass);
  }

  // Sky + Sun
  const sky = createSky({ scene, camera, textureUrl: TEX_SKY });
  const sun = await createSun({
    scene, camera,
    position: SUN.POS,
    angularDiameter: SUN.ANGULAR_DIAM,
    modelUrl: MODEL_SUN,
    modelTargetSize: 20,
    spin: SUN.ROT * TIME.SPEED,
    pulse: { enabled:true, amp:0.12, speed:0.6, haloAmp:0.10 }
  });

  // Gerarchia Mercurio
  const merPivot   = new THREE.Group();
  const merTilt    = new THREE.Group();
  const merPhase   = new THREE.Group();
  const merCarrier = new THREE.Group();
  const merSpin    = new THREE.Group();
  scene.add(merPivot);
  merPivot.add(merTilt);
  merTilt.add(merPhase);
  merPhase.add(merCarrier);
  merCarrier.add(merSpin);

  // rotazioni costanti
  merTilt.rotation.x  = THREE.MathUtils.degToRad(MER_INCL_DEG);
  merSpin.rotation.z  = THREE.MathUtils.degToRad(MER_OBLQ_DEG);
  merPivot.rotation.y = THREE.MathUtils.degToRad(MER_RAAN_DEG);
  merPhase.rotation.y = THREE.MathUtils.degToRad(MER_ARGPERI_DEG); // + nu nel tick

  // Mesh Mercurio
  let mercury = null;
  await new Promise((res)=> new GLTFLoader().load(MODEL_MERCURY,(g)=>{
    mercury = g.scene; mercury.name = "Mercury";
    prepPlanetMaterials(mercury, { roughness:0.96, metalness:0.0, normalScale:0.5 });

    // normalizzazione dimensione su schermo
    const box = new THREE.Box3().setFromObject(mercury);
    const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    mercury.scale.multiplyScalar(2.0 / max);
    mercury.position.set(0,0,0);
    merSpin.add(mercury);
    res();
  }));

  /* -------- Focus + Orbit rig (auto frame-fill) -------- */
  const FILL = CAMERA.FRAME_FILL?.MERCURY ?? CAMERA.FRAME_FILL_DEFAULT ?? 0.6;
  const FOCUS_DUR = 0.9;

  // focus morbido
  smoothFocusAuto(engine, mercury, { fill: FILL, dur: FOCUS_DUR });

  // rig + estensioni
  let orbit = createOrbitRig(engine);
  orbit = extendOrbitRigWithAuto(orbit, engine);
  orbit.setTarget(mercury);
  orbit.setRadiusAuto(mercury, { fill: FILL });
  orbit.setSpeed(0.16);
  orbit.setElevation(0.22);

  // far partire l’orbita quando il focus termina
  let focusActive = true, focusTimer = 0;

  // Input (0 refocus, 1 toggle orbit)
  const onKey = (e)=>{
    if (e.key === "0" && mercury){
      smoothFocusAuto(engine, mercury, { fill: FILL, dur: FOCUS_DUR });
      focusActive = true; focusTimer = 0;
      if (orbit.isRunning()) orbit.stop();
    }
    if (e.key === "1"){
      if (orbit.isRunning()) orbit.stop();
      else { orbit.matchCameraToCurrent(); orbit.start(); }
    }
  };
  window.addEventListener("keydown", onKey);

  // Tick
  let M_mer = 0;
  const detach = onTick((dt, now)=>{
    sky.update(now);
    sun.update(camera, now, dt);

    // Orbita eliocentrica (Keplero)
    merPivot.position.copy(sun.group.position);
    M_mer = (M_mer + MER_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_mer, MER_ECC);
    merPhase.rotation.y = THREE.MathUtils.degToRad(MER_ARGPERI_DEG) + nu;
    merCarrier.position.set(MER_A * rUnit, 0, 0);

    // Spin (risonante 3:2 o tabellato)
    if (mercury) mercury.rotateOnAxis(UP_AXIS, MER_SPIN * dt);

    // fine focus → warm-start & start orbit
    if (focusActive){
      focusTimer += dt/1000;
      if (focusTimer >= FOCUS_DUR){
        focusActive = false;
        orbit.matchCameraToCurrent();
        orbit.start();
      }
    }
  });

  // Cleanup
  return {
    dispose(){
      detach && detach();
      window.removeEventListener("keydown", onKey);
      orbit.stop();
      sky.dispose();
      sun.dispose();
      if (bloomPass && composer) composer.removePass(bloomPass);
      [merPivot].forEach(obj=>{
        if (!obj) return;
        obj.traverse?.(n=>{
          if (n.material){
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach(m=>m.map?.dispose?.());
            mats.forEach(m=>m.dispose?.());
          }
          n.geometry?.dispose?.();
        });
        obj.parent && obj.parent.remove(obj);
      });
    }
  };
}
