import * as THREE from "three";
import { GLTFLoader }      from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { UP_AXIS, prepPlanetMaterials, createOrbitRig, smoothFocusAuto, extendOrbitRigWithAuto} from "../utils.js";

import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA } from "../config.js";
import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";

/* Assets */
const TEX_SKY   = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const MODEL_SUN = new URL("./models/Sun.glb",               import.meta.url).href;
const MODEL_MARS= new URL("./models/Mars.glb",              import.meta.url).href;

/* Aliases */
const SUN_POS          = SUN.POS;
const SUN_ROT          = SUN.ROT * TIME.SPEED;
const SUN_ANGULAR_DIAM = SUN.ANGULAR_DIAM;

const MARS_ECC         = ELEMENTS.MARS.ecc;
const MARS_INCL_DEG    = ELEMENTS.MARS.incl_deg;
const MARS_RAAN_DEG    = ELEMENTS.MARS.raan_deg;
const MARS_ARGPERI_DEG = ELEMENTS.MARS.argperi_deg;
const MARS_OBLQ_DEG    = ELEMENTS.MARS.obliquity_deg;

const MARS_A     = SCALE.AU * ELEMENTS.MARS.a_AU;
const MARS_ORBIT = ORBIT.MARS * TIME.SPEED;
const MARS_ROT   = ROT.MARS   * TIME.SPEED;

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

  // Gerarchia Marte
  const marsPivot   = new THREE.Group();
  const marsTilt    = new THREE.Group();
  const marsPhase   = new THREE.Group();
  const marsCarrier = new THREE.Group();
  const marsSpin    = new THREE.Group();
  scene.add(marsPivot);
  marsPivot.add(marsTilt);
  marsTilt.add(marsPhase);
  marsPhase.add(marsCarrier);
  marsCarrier.add(marsSpin);

  marsTilt.rotation.x   = THREE.MathUtils.degToRad(MARS_INCL_DEG);
  marsSpin.rotation.z   = THREE.MathUtils.degToRad(MARS_OBLQ_DEG);
  marsPivot.rotation.y  = THREE.MathUtils.degToRad(MARS_RAAN_DEG);
  marsPhase.rotation.y  = THREE.MathUtils.degToRad(MARS_ARGPERI_DEG); // + nu nel tick

  let mars = null;
  await new Promise((res)=> new GLTFLoader().load(MODEL_MARS,(g)=>{
    mars = g.scene; mars.name = "Mars";
    prepPlanetMaterials(mars, { roughness:0.97, metalness:0.0, normalScale:0.55 });

    const box = new THREE.Box3().setFromObject(mars);
    const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    mars.scale.multiplyScalar(2.4 / max);
    mars.position.set(0,0,0);
    marsSpin.add(mars);
    res();
  }));

  const FILL = CAMERA.FRAME_FILL?.MARS ?? CAMERA.FRAME_FILL_DEFAULT ?? 0.6;
  const FOCUS_DUR = 1.0;

  smoothFocusAuto(engine, mars, { fill: FILL, dur: FOCUS_DUR });

  let orbit = createOrbitRig(engine);
  orbit = extendOrbitRigWithAuto(orbit, engine);
  orbit.setTarget(mars);
  orbit.setRadiusAuto(mars, { fill: FILL });
  orbit.setSpeed(0.11);
  orbit.setElevation(0.22);

  // far partire l’orbita quando il focus è finito
  let focusActive = true, focusTimer = 0;

  // Input (0 refocus, 1 toggle orbit)
  const onKey = (e)=>{
    if (e.key === "0" && mars){
      smoothFocusAuto(engine, mars, { fill: FILL, dur: FOCUS_DUR });
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
  let M_mars = 0;
  const detach = onTick((dt, now)=>{
    sky.update(now);
    sun.update(camera, now, dt);

    marsPivot.position.copy(sun.group.position);
    M_mars = (M_mars + MARS_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_mars, MARS_ECC);
    marsPhase.rotation.y = THREE.MathUtils.degToRad(MARS_ARGPERI_DEG) + nu;
    marsCarrier.position.set(MARS_A * rUnit, 0, 0);

    if (mars) mars.rotateOnAxis(UP_AXIS, MARS_ROT * dt);

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
      [marsPivot].forEach(obj=>{
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
