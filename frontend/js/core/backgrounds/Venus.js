import * as THREE from "three";
import { GLTFLoader }      from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { UP_AXIS, prepPlanetMaterials, createOrbitRig, smoothFocusAuto, extendOrbitRigWithAuto} from "../utils.js";
import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA } from "../config.js";
import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";

/* Assets */
const TEX_SKY     = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const MODEL_SUN   = new URL("./models/Sun.glb",               import.meta.url).href;
const MODEL_VENUS = new URL("./models/Venus.glb",             import.meta.url).href;

/* Orbita / assetto */
const VEN_ECC         = ELEMENTS.VENUS.ecc;
const VEN_INCL_DEG    = ELEMENTS.VENUS.incl_deg;
const VEN_RAAN_DEG    = ELEMENTS.VENUS.raan_deg;
const VEN_ARGPERI_DEG = ELEMENTS.VENUS.argperi_deg;
const VEN_OBLQ_DEG    = ELEMENTS.VENUS.obliquity_deg;

const VEN_A     = SCALE.AU * ELEMENTS.VENUS.a_AU;
const VEN_ORBIT = ORBIT.VENUS * TIME.SPEED;
const VEN_ROT   = ROT.VENUS   * TIME.SPEED;

const VEN_ROT_VIS = (Math.abs(VEN_ROT) < 1e-6)
  ? Math.sign(VEN_ROT || -1) * 2e-5
  : VEN_ROT;

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
    position: SUN.POS,
    angularDiameter: SUN.ANGULAR_DIAM,
    modelUrl: MODEL_SUN,
    modelTargetSize: 20,
    spin: SUN.ROT * TIME.SPEED,
    pulse: { enabled:true, amp:0.12, speed:0.6, haloAmp:0.10 }
  });

  sun.group.traverse((o)=>{
    const m = o.material;
    if (!m) return;
    m.depthTest = true;          
    m.depthWrite = false;        
    o.renderOrder = 0;           
  });

  // Gerarchia Venere
  const venPivot   = new THREE.Group();
  const venTilt    = new THREE.Group();
  const venPhase   = new THREE.Group();
  const venCarrier = new THREE.Group();
  const venSpin    = new THREE.Group();
  scene.add(venPivot);
  venPivot.add(venTilt);
  venTilt.add(venPhase);
  venPhase.add(venCarrier);
  venCarrier.add(venSpin);

  // Rotazioni costanti
  venTilt.rotation.x  = THREE.MathUtils.degToRad(VEN_INCL_DEG);
  venSpin.rotation.z  = THREE.MathUtils.degToRad(VEN_OBLQ_DEG);
  venPivot.rotation.y = THREE.MathUtils.degToRad(VEN_RAAN_DEG);
  venPhase.rotation.y = THREE.MathUtils.degToRad(VEN_ARGPERI_DEG); 

  let venus = null, venusClouds = null;
  await new Promise((res)=> new GLTFLoader().load(MODEL_VENUS,(g)=>{
    venus = g.scene; venus.name = "Venus";
    prepPlanetMaterials(venus, { roughness:0.98, metalness:0.0, normalScale:0.45 });

    venusClouds = venus.getObjectByName("Venus_Clouds")
               || venus.getObjectByName("Clouds")
               || venus.getObjectByName("clouds");
    if (venusClouds){
      const mats = Array.isArray(venusClouds.material) ? venusClouds.material : [venusClouds.material];
      for (const m of mats){
        if (!m) continue;
        m.transparent = true;
        m.depthWrite  = false;
        m.depthTest   = true;
        m.side        = THREE.FrontSide;
        m.alphaTest   = Math.max(0.0, m.alphaTest || 0.02);
        if ('metalness' in m) m.metalness = 0.0;
        if ('roughness' in m) m.roughness = 1.0;
        if (m.map){
          m.map.wrapS = THREE.RepeatWrapping;
          m.map.wrapT = THREE.RepeatWrapping;
          m.map.anisotropy = 8;
          m.map.needsUpdate = true;
        }
        m.needsUpdate = true;
      }
      venusClouds.renderOrder = 21;
      venusClouds.scale.multiplyScalar(1.008);
      venusClouds.userData._drift = -0.0006; // rad/ms
    }

    const box = new THREE.Box3().setFromObject(venus);
    const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    venus.scale.multiplyScalar(2.4 / max);
    venSpin.add(venus);
    res();
  }));

  const FILL = CAMERA.FRAME_FILL?.VENUS ?? CAMERA.FRAME_FILL_DEFAULT ?? 0.6;
  const FOCUS_DUR = 1.0;

  smoothFocusAuto(engine, venus, { fill: FILL, dur: FOCUS_DUR });

  let orbit = createOrbitRig(engine);
  orbit = extendOrbitRigWithAuto(orbit, engine);
  orbit.setTarget(venus);
  orbit.setRadiusAuto(venus, { fill: FILL });
  orbit.setSpeed(0.10);
  orbit.setElevation(0.22);

  let focusActive = true, focusTimer = 0;

  // Input (0 refocus, 1 toggle orbit)
  const onKey = (e)=>{
    if (e.key === "0" && venus){
      smoothFocusAuto(engine, venus, { fill: FILL, dur: FOCUS_DUR });
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
  let M_ven = 0;
  const detach = onTick((dt, now)=>{
    sky.update(now);
    sun.update(camera, now, dt);

    venPivot.position.copy(sun.group.position);
    M_ven = (M_ven + VEN_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_ven, VEN_ECC);
    venPhase.rotation.y = THREE.MathUtils.degToRad(VEN_ARGPERI_DEG) + nu;
    venCarrier.position.set(VEN_A * rUnit, 0, 0);

    if (venSpin) venSpin.rotateOnAxis(UP_AXIS, VEN_ROT_VIS * dt);
    if (venusClouds) venusClouds.rotateOnAxis(UP_AXIS, (venusClouds.userData._drift ?? -0.0006) * dt);

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
