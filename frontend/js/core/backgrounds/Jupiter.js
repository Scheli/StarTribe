import * as THREE from "three";
import { GLTFLoader }      from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { UP_AXIS, prepPlanetMaterials, createOrbitRig, unitRadius } from "../utils.js";
import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA } from "../config.js";

import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";

/* Assets */
const TEX_SKY      = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const MODEL_SUN    = new URL("./models/Sun.glb",               import.meta.url).href;
const MODEL_JUPITER= new URL("./models/Jupiter.glb",           import.meta.url).href;

/* Aliases */
const SUN_POS          = SUN.POS;
const SUN_ROT          = SUN.ROT * TIME.SPEED;
const SUN_ANGULAR_DIAM = SUN.ANGULAR_DIAM;

const JUP_ECC         = ELEMENTS.JUPITER.ecc;
const JUP_INCL_DEG    = ELEMENTS.JUPITER.incl_deg;
const JUP_RAAN_DEG    = ELEMENTS.JUPITER.raan_deg;
const JUP_ARGPERI_DEG = ELEMENTS.JUPITER.argperi_deg;
const JUP_OBLQ_DEG    = ELEMENTS.JUPITER.obliquity_deg;

const JUP_A     = SCALE.AU * ELEMENTS.JUPITER.a_AU;
const JUP_ORBIT = ORBIT.JUPITER * TIME.SPEED;
const JUP_ROT   = ROT.JUPITER   * TIME.SPEED;

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

  // ——— Giove: gerarchia ———
  const jupPivot   = new THREE.Group();
  const jupTilt    = new THREE.Group();
  const jupPhase   = new THREE.Group();
  const jupCarrier = new THREE.Group();
  const jupSpin    = new THREE.Group();
  scene.add(jupPivot);
  jupPivot.add(jupTilt);
  jupTilt.add(jupPhase);
  jupPhase.add(jupCarrier);
  jupCarrier.add(jupSpin);

  jupTilt.rotation.x = THREE.MathUtils.degToRad(JUP_INCL_DEG);
  jupSpin.rotation.z = THREE.MathUtils.degToRad(JUP_OBLQ_DEG);

  let jupiter = null, M_jup = 0;
  await new Promise((res)=> new GLTFLoader().load(MODEL_JUPITER,(g)=>{
    jupiter = g.scene; jupiter.name = "Jupiter";

    // materiali base (bande opache, riflessioni basse)
    prepPlanetMaterials(jupiter, { roughness:0.97, metalness:0.0, normalScale:0.5 });

    // eventuali “ring” nel GLB (raro su Giove, ma safe)
    jupiter.traverse((o)=>{
      if (!o.isMesh || !o.material) return;
      const m  = o.material;
      const nm = (o.name || "").toLowerCase();
      const mm = (m.name || "").toLowerCase();
      const isRing = nm.includes("ring") || nm.includes("anello") || nm.includes("rings") || mm.includes("ring");
      if (isRing){
        m.transparent = true;
        m.depthWrite  = false;
        m.depthTest   = true;
        m.side        = THREE.DoubleSide;
        m.alphaTest   = 0.2;
        m.premultipliedAlpha = true;
        o.renderOrder = 20;
      } else {
        m.transparent = false;
        m.depthWrite  = true;
        m.depthTest   = true;
        o.renderOrder = 10;
      }
    });

    const box = new THREE.Box3().setFromObject(jupiter);
    const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    jupiter.scale.multiplyScalar(3.5 / max);   // Giove più grande a schermo
    jupiter.position.set(0,0,0);
    jupSpin.add(jupiter);
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
  smoothFocusTo(jupiter);

  const orbit = createOrbitRig(engine);
  const rInit = THREE.MathUtils.clamp(unitRadius(jupiter) * CAMERA.RADIUS_MULT, CAMERA.MIN_DIST, CAMERA.MAX_DIST);
  orbit.setTarget(jupiter); orbit.setRadius(rInit); orbit.setSpeed(0.14); orbit.setElevation(0.22);
  let startOrbitAfterFocus = true;

  // ——— Input ———
  const onKey = (e)=>{
    if (e.key === "0" && jupiter){
      const dist = Math.max(CAMERA.MIN_DIST, unitRadius(jupiter) * CAMERA.RADIUS_MULT);
      smoothFocusTo(jupiter, { mult:CAMERA.RADIUS_MULT, minDist:dist, dur:1.0 });
      startOrbitAfterFocus = true;
    }
    if (e.key === "1"){ if (orbit.isRunning()) orbit.stop(); else orbit.start(); }
  };
  window.addEventListener("keydown", onKey);

  // ——— Tick ———
  const detach = onTick((dt, now)=>{
    sky.update(now);
    sun.update(camera, now, dt);

    // Orbita (Keplero)
    jupPivot.position.copy(sun.group.position);
    M_jup = (M_jup + JUP_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_jup, JUP_ECC);

    jupPivot.rotation.y = THREE.MathUtils.degToRad(JUP_RAAN_DEG);
    jupTilt.rotation.x  = THREE.MathUtils.degToRad(JUP_INCL_DEG);
    jupPhase.rotation.y = THREE.MathUtils.degToRad(JUP_ARGPERI_DEG) + nu;
    jupCarrier.position.set(JUP_A * rUnit, 0, 0);

    // Rotazione rapida del pianeta
    if (jupiter) jupiter.rotateOnAxis(UP_AXIS, JUP_ROT * dt);

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
      [jupPivot].forEach(obj=>{
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
