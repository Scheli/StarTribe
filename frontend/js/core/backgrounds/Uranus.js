import * as THREE from "three";
import { GLTFLoader }      from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { UP_AXIS, prepPlanetMaterials, createOrbitRig, smoothFocusAuto, extendOrbitRigWithAuto} from "../utils.js";
import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA } from "../config.js";
import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";

/* Assets */
const TEX_SKY       = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const MODEL_SUN     = new URL("./models/Sun.glb",               import.meta.url).href;
const MODEL_URANUS  = new URL("./models/Uranus.glb",            import.meta.url).href;

/* Aliases */
const URA_ECC         = ELEMENTS.URANUS.ecc;
const URA_INCL_DEG    = ELEMENTS.URANUS.incl_deg;
const URA_RAAN_DEG    = ELEMENTS.URANUS.raan_deg;
const URA_ARGPERI_DEG = ELEMENTS.URANUS.argperi_deg;
const URA_OBLQ_DEG    = ELEMENTS.URANUS.obliquity_deg;

const URA_A     = SCALE.AU * ELEMENTS.URANUS.a_AU;
const URA_ORBIT = ORBIT.URANUS * TIME.SPEED;
const URA_ROT   = ROT.URANUS   * TIME.SPEED;

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

  // Gerarchia Urano
  const uraPivot   = new THREE.Group();
  const uraTilt    = new THREE.Group();
  const uraPhase   = new THREE.Group();
  const uraCarrier = new THREE.Group();
  const uraSpin    = new THREE.Group();
  scene.add(uraPivot);
  uraPivot.add(uraTilt);
  uraTilt.add(uraPhase);
  uraPhase.add(uraCarrier);
  uraCarrier.add(uraSpin);

  // Rotazioni costanti
  uraTilt.rotation.x  = THREE.MathUtils.degToRad(URA_INCL_DEG);
  uraSpin.rotation.z  = THREE.MathUtils.degToRad(URA_OBLQ_DEG);   
  uraPivot.rotation.y = THREE.MathUtils.degToRad(URA_RAAN_DEG);
  uraPhase.rotation.y = THREE.MathUtils.degToRad(URA_ARGPERI_DEG); 

  let uranus = null;
  await new Promise((res)=> new GLTFLoader().load(MODEL_URANUS,(g)=>{
    uranus = g.scene; uranus.name = "Uranus";
    prepPlanetMaterials(uranus, { roughness:0.98, metalness:0.0, normalScale:0.45 });

    uranus.traverse(o=>{
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

    const box = new THREE.Box3().setFromObject(uranus);
    const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    uranus.scale.multiplyScalar(2.7 / max);
    uranus.position.set(0,0,0);
    uraSpin.add(uranus);
    res();
  }));

  const FILL = CAMERA.FRAME_FILL?.URANUS ?? CAMERA.FRAME_FILL_DEFAULT ?? 0.6;
  const FOCUS_DUR = 1.0;

  smoothFocusAuto(engine, uranus, { fill: FILL, dur: FOCUS_DUR });

  let orbit = createOrbitRig(engine);
  orbit = extendOrbitRigWithAuto(orbit, engine);
  orbit.setTarget(uranus);
  orbit.setRadiusAuto(uranus, { fill: FILL });
  orbit.setSpeed(0.12);
  orbit.setElevation(0.22);

  let focusActive = true, focusTimer = 0;

  // Input
  const onKey = (e)=>{
    if (e.key === "0" && uranus){
      smoothFocusAuto(engine, uranus, { fill: FILL, dur: FOCUS_DUR });
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
  let M_ura = 0;
  const detach = onTick((dt, now)=>{
    sky.update(now);
    sun.update(camera, now, dt);

    uraPivot.position.copy(sun.group.position);
    M_ura = (M_ura + URA_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_ura, URA_ECC);
    uraPhase.rotation.y = THREE.MathUtils.degToRad(URA_ARGPERI_DEG) + nu;
    uraCarrier.position.set(URA_A * rUnit, 0, 0);

    if (uranus) uranus.rotateOnAxis(UP_AXIS, URA_ROT * dt);

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
      [uraPivot].forEach(obj=>{
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
