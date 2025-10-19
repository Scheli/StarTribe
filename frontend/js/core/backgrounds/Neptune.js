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
const MODEL_NEPTUNE  = new URL("./models/Neptune.glb",           import.meta.url).href;

/* Aliases */
const SUN_POS          = SUN.POS;
const SUN_ROT          = SUN.ROT * TIME.SPEED;
const SUN_ANGULAR_DIAM = SUN.ANGULAR_DIAM;

const NEP_ECC         = ELEMENTS.NEPTUNE.ecc;
const NEP_INCL_DEG    = ELEMENTS.NEPTUNE.incl_deg;
const NEP_RAAN_DEG    = ELEMENTS.NEPTUNE.raan_deg;
const NEP_ARGPERI_DEG = ELEMENTS.NEPTUNE.argperi_deg;
const NEP_OBLQ_DEG    = ELEMENTS.NEPTUNE.obliquity_deg;

const NEP_A     = SCALE.AU * ELEMENTS.NEPTUNE.a_AU;
const NEP_ORBIT = ORBIT.NEPTUNE * TIME.SPEED;
const NEP_ROT   = ROT.NEPTUNE   * TIME.SPEED;

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

export async function initBackground(engine){
  const { scene, camera, composer, onTick } = engine;

  let bloomPass = null;
  if (POSTFX?.BLOOM?.enabled){
    const { strength, radius, threshold } = POSTFX.BLOOM;
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      strength, radius, threshold
    );
    composer.addPass(bloomPass);
  }

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

  sun.group.traverse((o)=>{
    const m = o.material;
    if (!m) return;
    m.depthTest = true;          
    m.depthWrite = false;        
    o.renderOrder = 0;           
  });

  // Gerarchia Nettuno
  const nepPivot   = new THREE.Group();
  const nepTilt    = new THREE.Group();
  const nepPhase   = new THREE.Group();
  const nepCarrier = new THREE.Group();
  const nepSpin    = new THREE.Group();
  scene.add(nepPivot);
  nepPivot.add(nepTilt);
  nepTilt.add(nepPhase);
  nepPhase.add(nepCarrier);
  nepCarrier.add(nepSpin);

  nepTilt.rotation.x   = THREE.MathUtils.degToRad(NEP_INCL_DEG);
  nepSpin.rotation.z   = THREE.MathUtils.degToRad(NEP_OBLQ_DEG);
  nepPivot.rotation.y  = THREE.MathUtils.degToRad(NEP_RAAN_DEG);
  nepPhase.rotation.y  = THREE.MathUtils.degToRad(NEP_ARGPERI_DEG); // + nu nel tick

  let neptune = null;
  await new Promise((res)=> new GLTFLoader().load(MODEL_NEPTUNE,(g)=>{
    neptune = g.scene; neptune.name = "Neptune";
    prepPlanetMaterials(neptune, { roughness:0.97, metalness:0.0, normalScale:0.5 });

    const box = new THREE.Box3().setFromObject(neptune);
    const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    neptune.scale.multiplyScalar(2.8 / max);
    neptune.position.set(0,0,0);
    nepSpin.add(neptune);
    res();
  }));

  const FILL = CAMERA.FRAME_FILL?.NEPTUNE ?? CAMERA.FRAME_FILL_DEFAULT ?? 0.6;
  const FOCUS_DUR = 1.0;

  smoothFocusAuto(engine, neptune, { fill: FILL, dur: FOCUS_DUR });

  let orbit = createOrbitRig(engine);
  orbit = extendOrbitRigWithAuto(orbit, engine);
  orbit.setTarget(neptune);
  orbit.setRadiusAuto(neptune, { fill: FILL });
  orbit.setSpeed(0.12);
  orbit.setElevation(0.22);

  // far partire l’orbita quando il focus è finito
  let focusActive = true, focusTimer = 0;

  // Input (0 refocus, 1 toggle orbit)
  const onKey = (e)=>{
    if (e.key === "0" && neptune){
      smoothFocusAuto(engine, neptune, { fill: FILL, dur: FOCUS_DUR });
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
  let M_nep = 0;
  const detach = onTick((dt, now)=>{
    sky.update(now);
    sun.update(camera, now, dt);

    nepPivot.position.copy(sun.group.position);
    M_nep = (M_nep + NEP_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_nep, NEP_ECC);
    nepPhase.rotation.y = THREE.MathUtils.degToRad(NEP_ARGPERI_DEG) + nu;
    nepCarrier.position.set(NEP_A * rUnit, 0, 0);

    if (neptune) neptune.rotateOnAxis(UP_AXIS, NEP_ROT * dt);

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
      [nepPivot].forEach(obj=>{
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
