import * as THREE from "three";
import { GLTFLoader }      from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { UP_AXIS, prepPlanetMaterials, createOrbitRig, unitRadius } from "../utils.js";
import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA } from "../config.js";

import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";

/* Assets */
const TEX_SKY       = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const MODEL_SUN     = new URL("./models/Sun.glb",               import.meta.url).href;
const MODEL_SATURN  = new URL("./models/Saturn.glb",            import.meta.url).href;

/* Aliases */
const SUN_POS          = SUN.POS;
const SUN_ROT          = SUN.ROT * TIME.SPEED;
const SUN_ANGULAR_DIAM = SUN.ANGULAR_DIAM;

const SAT_ECC         = ELEMENTS.SATURN.ecc;
const SAT_INCL_DEG    = ELEMENTS.SATURN.incl_deg;
const SAT_RAAN_DEG    = ELEMENTS.SATURN.raan_deg;
const SAT_ARGPERI_DEG = ELEMENTS.SATURN.argperi_deg;
const SAT_OBLQ_DEG    = ELEMENTS.SATURN.obliquity_deg;

const SAT_A     = SCALE.AU * ELEMENTS.SATURN.a_AU;
const SAT_ORBIT = ORBIT.SATURN * TIME.SPEED;
const SAT_ROT   = ROT.SATURN   * TIME.SPEED;

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

  // ——— Sole condiviso ———
  const sun = await createSun({
    scene, camera,
    position: SUN_POS,
    angularDiameter: SUN_ANGULAR_DIAM,
    modelUrl: MODEL_SUN,
    modelTargetSize: 20,
    spin: SUN_ROT,
    pulse: { enabled:true, amp:0.12, speed:0.6, haloAmp:0.10 }
  });

  // ——— Saturno: gerarchia ———
  const satPivot   = new THREE.Group();
  const satTilt    = new THREE.Group();
  const satPhase   = new THREE.Group();
  const satCarrier = new THREE.Group();
  const satSpin    = new THREE.Group();
  scene.add(satPivot);
  satPivot.add(satTilt);
  satTilt.add(satPhase);
  satPhase.add(satCarrier);
  satCarrier.add(satSpin);

  satTilt.rotation.x = THREE.MathUtils.degToRad(SAT_INCL_DEG);
  satSpin.rotation.z = THREE.MathUtils.degToRad(SAT_OBLQ_DEG);

  let saturn = null, M_sat = 0;
  await new Promise((res)=> new GLTFLoader().load(MODEL_SATURN,(g)=>{
    saturn = g.scene; saturn.name = "Saturn";

    // materiali di base
    prepPlanetMaterials(saturn, { roughness:0.97, metalness:0.0, normalScale:0.5 });

    // assicurati che gli anelli non “spariscano” davanti/di dietro
    saturn.traverse((o)=>{
      if (!o.isMesh || !o.material) return;
      const m = o.material;
      const nm = (o.name || "").toLowerCase();
      const mm = (m.name || "").toLowerCase();
      const isRing = nm.includes("ring") || nm.includes("anello") || nm.includes("rings") || mm.includes("ring");

      if (isRing){
        m.transparent = true;
        m.depthWrite  = false;           // non scrive depth
        m.depthTest   = true;            // ma rispetta depth del pianeta
        m.side        = THREE.DoubleSide;
        m.alphaTest   = 0.2;
        m.premultipliedAlpha = true;
        m.blending    = THREE.NormalBlending;
        o.renderOrder = 20;              // disegna dopo il pianeta
      } else {
        m.transparent = false;
        m.depthWrite  = true;
        m.depthTest   = true;
        o.renderOrder = 10;
      }
    });

    // fit dimensioni
    const box = new THREE.Box3().setFromObject(saturn);
    const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    saturn.scale.multiplyScalar(3.2 / max);
    saturn.position.set(0,0,0);
    satSpin.add(saturn);
    res();
  }));

  // ——— Focus + Orbit rig ———
  const state = { pending:null };
  function smoothFocusTo(obj, { mult=(CAMERA.RADIUS_MULT_BIG?.SATURN ?? CAMERA.RADIUS_MULT), minDist=CAMERA.MIN_DIST, dur=1.0 }={}){
    if (!obj) return;
    obj.updateMatrixWorld(true);
    const R = unitRadius(obj);
    let dir = camera.position.clone().sub(controls.target); if (dir.lengthSq() < 1e-6) dir.set(0,0,1);
    dir.setLength(Math.max(minDist, R * mult));
    const c = obj.getWorldPosition(new THREE.Vector3());
    state.pending = { fromPos:camera.position.clone(), toPos:c.clone().add(dir), fromTgt:controls.target.clone(), toTgt:c.clone(), t:0, dur };
  }
  smoothFocusTo(saturn);

  const orbit = createOrbitRig(engine);
  const mult  = (CAMERA.RADIUS_MULT_BIG?.SATURN ?? CAMERA.RADIUS_MULT);
  const rInit = THREE.MathUtils.clamp(unitRadius(saturn) * mult, CAMERA.MIN_DIST, CAMERA.MAX_DIST);
  orbit.setTarget(saturn); orbit.setRadius(rInit); orbit.setSpeed(0.10); orbit.setElevation(0.22);
  let startOrbitAfterFocus = true;

  // ——— Input ———
  const onKey = (e)=>{
    if (e.key === "0" && saturn){
      const dist = Math.max(CAMERA.MIN_DIST, unitRadius(saturn) * mult);
      smoothFocusTo(saturn, { mult, minDist:dist, dur:1.0 });
      startOrbitAfterFocus = true;
    }
    if (e.key === "1"){ if (orbit.isRunning()) orbit.stop(); else orbit.start(); }
  };
  window.addEventListener("keydown", onKey);

  // ——— Tick ———
  const detach = onTick((dt, now)=>{
    sky.update(now);             // stelle + twinkle
    sun.update(camera, now, dt); // sprite dimensione angolare + rotazione + pulse

    // Orbita (Keplero)
    satPivot.position.copy(sun.group.position);
    M_sat = (M_sat + SAT_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_sat, SAT_ECC);

    satPivot.rotation.y = THREE.MathUtils.degToRad(SAT_RAAN_DEG);
    satTilt.rotation.x  = THREE.MathUtils.degToRad(SAT_INCL_DEG);
    satPhase.rotation.y = THREE.MathUtils.degToRad(SAT_ARGPERI_DEG) + nu;
    satCarrier.position.set(SAT_A * rUnit, 0, 0);

    // Rotazione del pianeta
    if (saturn) saturn.rotateOnAxis(UP_AXIS, SAT_ROT * dt);

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
      [satPivot].forEach(obj=>{
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
