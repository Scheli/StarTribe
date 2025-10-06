import * as THREE from "three";
import { GLTFLoader }      from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { UP_AXIS, prepPlanetMaterials, createOrbitRig, unitRadius } from "../utils.js";
import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA } from "../config.js";

import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";

/* Assets */
const TEX_SKY     = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const MODEL_SUN   = new URL("./models/Sun.glb",               import.meta.url).href;
const MODEL_VENUS = new URL("./models/Venus.glb",             import.meta.url).href;

/* Aliases */
const SUN_POS          = SUN.POS;
const SUN_ROT          = SUN.ROT * TIME.SPEED;
const SUN_ANGULAR_DIAM = SUN.ANGULAR_DIAM;

const VEN_ECC         = ELEMENTS.VENUS.ecc;
const VEN_INCL_DEG    = ELEMENTS.VENUS.incl_deg;
const VEN_RAAN_DEG    = ELEMENTS.VENUS.raan_deg;
const VEN_ARGPERI_DEG = ELEMENTS.VENUS.argperi_deg;
const VEN_OBLQ_DEG    = ELEMENTS.VENUS.obliquity_deg;

const VEN_A     = SCALE.AU * ELEMENTS.VENUS.a_AU;
const VEN_ORBIT = ORBIT.VENUS * TIME.SPEED;
const VEN_ROT   = ROT.VENUS   * TIME.SPEED; 

// Boost visivo se la rotazione reale è impercettibile
const VEN_ROT_VIS = (Math.abs(VEN_ROT) < 1e-6)
  ? Math.sign(VEN_ROT || -1) * 2e-5   
  : VEN_ROT;

/* Helpers */
function keplerSolve(M, e){
  let E = M;
  for (let k=0;k<4;k++){ const f=E - e*Math.sin(E) - M, fp=1 - e*Math.cos(E); E -= f/fp; }
  const cosE=Math.cos(E), sinE=Math.sin(E);
  return { r:1 - e*cosE, nu:Math.atan2(Math.sqrt(1-e*e)*sinE, cosE - e), E };
}
function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; }

/* Entry */
export async function initBackground(engine){
  const { scene, camera, composer, controls, onTick } = engine;

  // Bloom (da config)
  if (POSTFX?.BLOOM?.enabled){
    const { strength, radius, threshold } = POSTFX.BLOOM;
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), strength, radius, threshold));
  }

  // Sky + Sole condivisi
  const sky = createSky({ scene, camera, textureUrl: TEX_SKY });
  const sun = await createSun({
    scene, camera,
    position: SUN_POS,
    angularDiameter: SUN_ANGULAR_DIAM,
    modelUrl: MODEL_SUN,
    modelTargetSize: 20,
    spin: SUN_ROT,
    pulse: { enabled:true, amp:0.12, speed:0.6, haloAmp:0.10 }
  });

  // Gerarchia Venere
  const venPivot   = new THREE.Group();
  const venTilt    = new THREE.Group();
  const venPhase   = new THREE.Group();
  const venCarrier = new THREE.Group();
  const venSpin    = new THREE.Group();
  scene.add(venPivot); venPivot.add(venTilt); venTilt.add(venPhase); venPhase.add(venCarrier); venCarrier.add(venSpin);

  venTilt.rotation.x = THREE.MathUtils.degToRad(VEN_INCL_DEG);
  venSpin.rotation.z = THREE.MathUtils.degToRad(VEN_OBLQ_DEG);

  // Stato
  let venus=null, venusClouds=null, M_ven=0;

  // Carica GLB
  await new Promise((resolve)=> new GLTFLoader().load(MODEL_VENUS,(g)=>{
    venus = g.scene; venus.name = "Venus";
    venSpin.add(venus);

    // Corpo pianeta
    prepPlanetMaterials(venus, { roughness:0.98, metalness:0.0, normalScale:0.45 });

    // Guscio nuvole (nomi tipici)
    venusClouds = venus.getObjectByName("Venus_Clouds")
             || venus.getObjectByName("Clouds")
             || venus.getObjectByName("clouds");

    // Fix overlay nuvole: visibili davanti, niente “dietro”
    if (venusClouds) {
      const mats = Array.isArray(venusClouds.material) ? venusClouds.material : [venusClouds.material];
      for (const m of mats) {
        if (!m) continue;
        m.transparent = true;
        m.depthWrite  = false;     // non scrive nello z-buffer
        m.depthTest   = true;      // ma testa contro il globo per occultare il retro
        m.side        = THREE.FrontSide; // solo faccia esterna
        m.alphaTest   = Math.max(0.0, m.alphaTest || 0.02);
        m.blending    = THREE.NormalBlending;
        if ('metalness' in m) m.metalness = 0.0;
        if ('roughness' in m) m.roughness = 1.0;
        if (m.map) {
          m.map.wrapS = THREE.RepeatWrapping;
          m.map.wrapT = THREE.RepeatWrapping;
          m.map.anisotropy = 8;
          m.map.needsUpdate = true;
        }
        m.needsUpdate = true;
      }
      venusClouds.renderOrder = 21;        // dopo il globo
      venusClouds.scale.multiplyScalar(1.008);
      venusClouds.userData._drift = -0.0006; // super-rotazione
    }

    // Scala coerente
    const box = new THREE.Box3().setFromObject(venus);
    const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    venus.scale.multiplyScalar(2.4 / max);

    resolve();
  }));

  // Focus iniziale + orbit rig
  const state={ pending:null };
  function smoothFocusTo(obj,{ mult=CAMERA.RADIUS_MULT, minDist=CAMERA.MIN_DIST, dur=1.0 }={}){
    if (!obj) return;
    obj.updateMatrixWorld(true);
    const R=unitRadius(obj);
    let dir=camera.position.clone().sub(controls.target); if (dir.lengthSq()<1e-6) dir.set(0,0,1);
    dir.setLength(Math.max(minDist, R*mult));
    const c=obj.getWorldPosition(new THREE.Vector3());
    state.pending={ fromPos:camera.position.clone(), toPos:c.clone().add(dir), fromTgt:controls.target.clone(), toTgt:c.clone(), t:0, dur };
  }
  smoothFocusTo(venus);

  const orbit = createOrbitRig(engine);
  const rInit = THREE.MathUtils.clamp(unitRadius(venus) * CAMERA.RADIUS_MULT, CAMERA.MIN_DIST, CAMERA.MAX_DIST);
  orbit.setTarget(venus); orbit.setRadius(rInit); orbit.setSpeed(0.14); orbit.setElevation(0.22);
  let startOrbitAfterFocus = true;

  // Input
  const onKey=(e)=>{
    if (e.key==="0" && venus){
      const dist=Math.max(CAMERA.MIN_DIST, unitRadius(venus) * CAMERA.RADIUS_MULT);
      smoothFocusTo(venus, { mult:CAMERA.RADIUS_MULT, minDist:dist, dur:1.0 });
      startOrbitAfterFocus = true;
    }
    if (e.key==="1"){ if (orbit.isRunning()) orbit.stop(); else orbit.start(); }
  };
  window.addEventListener("keydown", onKey);

  // Tick
  const detach = onTick((dt, now)=>{
    sky.update(now);
    sun.update(camera, now, dt);

    // Orbita (Keplero)
    venPivot.position.copy(sun.group.position);
    M_ven = (M_ven + VEN_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_ven, VEN_ECC);
    venPivot.rotation.y = THREE.MathUtils.degToRad(VEN_RAAN_DEG);
    venTilt.rotation.x  = THREE.MathUtils.degToRad(VEN_INCL_DEG);
    venPhase.rotation.y = THREE.MathUtils.degToRad(VEN_ARGPERI_DEG) + nu;
    venCarrier.position.set(VEN_A * rUnit, 0, 0);

    // Rotazioni: corpo sul nodo inclinato (venSpin), nuvole con drift relativo
    if (venSpin) venSpin.rotateOnAxis(UP_AXIS, VEN_ROT_VIS * dt);
    if (venusClouds) venusClouds.rotateOnAxis(UP_AXIS, (venusClouds.userData._drift ?? -0.0006) * dt);

    // Smooth focus → avvio orbit
    if (state.pending){
      state.pending.t += dt/1000;
      const a = Math.min(1, state.pending.t/state.pending.dur);
      const k = easeInOutCubic(a);
      camera.position.lerpVectors(state.pending.fromPos, state.pending.toPos, k);
      controls.target.lerpVectors(state.pending.fromTgt, state.pending.toTgt, k);
      if (a >= 1) state.pending = null;
    } else if (startOrbitAfterFocus){
      orbit.start(); startOrbitAfterFocus = false;
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
      [venPivot].forEach(obj=>{
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
