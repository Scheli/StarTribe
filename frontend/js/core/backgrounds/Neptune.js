import * as THREE from "three";
import { GLTFLoader }      from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { UP_AXIS, prepPlanetMaterials, unitRadius, createOrbitRig } from "../utils.js";
import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA } from "../config.js";

import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";

/* Assets */
const TEX_SKY       = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const MODEL_SUN     = new URL("./models/Sun.glb",               import.meta.url).href;
const MODEL_NEPTUNE = new URL("./models/Neptune.glb",           import.meta.url).href;

/* Aliases */
const SUN_POS          = SUN.POS;
const SUN_ROT          = SUN.ROT * TIME.SPEED;
const SUN_ANGULAR_DIAM = SUN.ANGULAR_DIAM;

const NEPTUNE_ECC         = ELEMENTS.NEPTUNE.ecc;
const NEPTUNE_INCL_DEG    = ELEMENTS.NEPTUNE.incl_deg;
const NEPTUNE_RAAN_DEG    = ELEMENTS.NEPTUNE.raan_deg;
const NEPTUNE_ARGPERI_DEG = ELEMENTS.NEPTUNE.argperi_deg;
const NEPTUNE_OBLQ_DEG    = ELEMENTS.NEPTUNE.obliquity_deg;

const NEPTUNE_A     = SCALE.AU * ELEMENTS.NEPTUNE.a_AU;
const NEPTUNE_ORBIT = ORBIT.NEPTUNE * TIME.SPEED;
const NEPTUNE_ROT   = ROT.NEPTUNE   * TIME.SPEED;

/* Helpers */
function keplerSolve(M, e){
  let E = M;
  for (let k=0;k<4;k++){
    const f  = E - e*Math.sin(E) - M;
    const fp = 1 - e*Math.cos(E);
    E -= f/fp;
  }
  const cosE = Math.cos(E), sinE = Math.sin(E);
  return { r: 1 - e*cosE, nu: Math.atan2(Math.sqrt(1-e*e)*sinE, cosE - e), E };
}
function easeInOutCubic(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; }

/* Entry */
export async function initBackground(engine){
  const { scene, camera, composer, controls, onTick } = engine;

  // Bloom (da config)
  if (POSTFX?.BLOOM?.enabled){
    const { strength, radius, threshold } = POSTFX.BLOOM;
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), strength, radius, threshold));
  }

  // ——— Sky condiviso ———
  const sky = createSky({ scene, camera, textureUrl: TEX_SKY });

  // ——— Sole condiviso (con fix anti-eclisse già dentro createSun) ———
  const sun = await createSun({
    scene, camera,
    position: SUN_POS,
    angularDiameter: SUN_ANGULAR_DIAM,
    modelUrl: MODEL_SUN,
    modelTargetSize: 20,
    spin: SUN_ROT,
    pulse: { enabled:true, amp:0.12, speed:0.6, haloAmp:0.10 }
  });

  // ——— Nettuno: gerarchia ———
  const neptunePivot   = new THREE.Group();
  const neptuneTilt    = new THREE.Group();
  const neptunePhase   = new THREE.Group();
  const neptuneCarrier = new THREE.Group();
  const neptuneSpin    = new THREE.Group();
  scene.add(neptunePivot);
  neptunePivot.add(neptuneTilt);
  neptuneTilt.add(neptunePhase);
  neptunePhase.add(neptuneCarrier);
  neptuneCarrier.add(neptuneSpin);

  neptuneTilt.rotation.x = THREE.MathUtils.degToRad(NEPTUNE_INCL_DEG);
  neptuneSpin.rotation.z = THREE.MathUtils.degToRad(NEPTUNE_OBLQ_DEG);

  let neptune = null, M_nep = 0;
  await new Promise((res)=> new GLTFLoader().load(MODEL_NEPTUNE,(g)=>{
    neptune = g.scene; neptune.name = "Neptune";
    prepPlanetMaterials(neptune, { roughness:0.97, metalness:0.0, normalScale:0.5 });

    const box = new THREE.Box3().setFromObject(neptune);
    const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    neptune.scale.multiplyScalar(2.8 / max);
    neptune.position.set(0,0,0);
    neptuneSpin.add(neptune);
    res();
  }));

  // ——— Focus + Orbit rig ———
  const state = { pending:null };
  function smoothFocusTo(obj, { mult=CAMERA.RADIUS_MULT, minDist=CAMERA.MIN_DIST, dur=1.0 }={}){
    if (!obj) return;
    obj.updateMatrixWorld(true);
    const R = unitRadius(obj);
    let dir = camera.position.clone().sub(controls.target); if (dir.lengthSq() < 1e-6) dir.set(0,0,1);
    dir.setLength(Math.max(minDist, R * mult));
    const c = obj.getWorldPosition(new THREE.Vector3());
    state.pending = { fromPos:camera.position.clone(), toPos:c.clone().add(dir), fromTgt:controls.target.clone(), toTgt:c.clone(), t:0, dur };
  }
  smoothFocusTo(neptune);

  const orbit = createOrbitRig(engine);
  const rInit = THREE.MathUtils.clamp(unitRadius(neptune) * CAMERA.RADIUS_MULT, CAMERA.MIN_DIST, CAMERA.MAX_DIST);
  orbit.setTarget(neptune); orbit.setRadius(rInit); orbit.setSpeed(0.12); orbit.setElevation(0.22);
  let startOrbitAfterFocus = true;

  // ——— Input ———
  const onKey = (e)=>{
    if (e.key === "0" && neptune){
      const dist = Math.max(CAMERA.MIN_DIST, unitRadius(neptune) * CAMERA.RADIUS_MULT);
      smoothFocusTo(neptune, { mult:CAMERA.RADIUS_MULT, minDist:dist, dur:1.0 });
      startOrbitAfterFocus = true;
    }
    if (e.key === "1"){ if (orbit.isRunning()) orbit.stop(); else orbit.start(); }
  };
  window.addEventListener("keydown", onKey);

  // ——— Tick ———
  const detach = onTick((dt, now)=>{
    sky.update(now);            // stelle + twinkle agganciati alla camera
    sun.update(camera, now, dt); // sprite dimensione angolare + rotazione + pulse

    // Orbita (Keplero)
    neptunePivot.position.copy(sun.group.position);
    M_nep = (M_nep + NEPTUNE_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_nep, NEPTUNE_ECC);

    neptunePivot.rotation.y = THREE.MathUtils.degToRad(NEPTUNE_RAAN_DEG);
    neptuneTilt.rotation.x  = THREE.MathUtils.degToRad(NEPTUNE_INCL_DEG);
    neptunePhase.rotation.y = THREE.MathUtils.degToRad(NEPTUNE_ARGPERI_DEG) + nu;
    neptuneCarrier.position.set(NEPTUNE_A * rUnit, 0, 0);

    // Rotazione di Nettuno
    if (neptune) neptune.rotateOnAxis(UP_AXIS, NEPTUNE_ROT * dt);

    // Smooth focus → avvio orbit
    if (state.pending){
      state.pending.t += dt/1000;
      const a = Math.min(1, state.pending.t / state.pending.dur);
      const k = easeInOutCubic(a);
      camera.position.lerpVectors(state.pending.fromPos, state.pending.toPos, k);
      controls.target.lerpVectors(state.pending.fromTgt, state.pending.toTgt, k);
      if (a >= 1) state.pending = null;
    } else if (startOrbitAfterFocus){
      orbit.start(); startOrbitAfterFocus = false;
    }
  });

  // ——— Cleanup ———
  return {
    dispose(){
      detach && detach();
      window.removeEventListener("keydown", onKey);
      orbit.stop();
      sky.dispose();
      sun.dispose();
      [neptunePivot].forEach(obj=>{
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
