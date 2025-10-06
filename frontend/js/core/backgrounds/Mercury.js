import * as THREE from "three";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { UP_AXIS, prepPlanetMaterials, unitRadius, createOrbitRig } from "../utils.js";
import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA } from "../config.js";

import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";

const TEX_SKY = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const MODEL_SUN = new URL("./models/Sun.glb", import.meta.url).href;
const MODEL_MERCURY = new URL("./models/Mercury.glb", import.meta.url).href;

export async function initBackground(engine){
  const { scene, camera, composer, controls, onTick } = engine;

  if (POSTFX?.BLOOM?.enabled){
    const { strength, radius, threshold } = POSTFX.BLOOM;
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), strength, radius, threshold));
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

  // ——— Mercurio (immutato) ———
  const mercuryPivot   = new THREE.Group();
  const mercuryTilt    = new THREE.Group();
  const mercuryPhase   = new THREE.Group();
  const mercuryCarrier = new THREE.Group();
  const mercurySpin    = new THREE.Group();
  scene.add(mercuryPivot);
  mercuryPivot.add(mercuryTilt);
  mercuryTilt.add(mercuryPhase);
  mercuryPhase.add(mercuryCarrier);
  mercuryCarrier.add(mercurySpin);

  mercuryTilt.rotation.x = THREE.MathUtils.degToRad(ELEMENTS.MERCURY.incl_deg);
  mercurySpin.rotation.z = THREE.MathUtils.degToRad(ELEMENTS.MERCURY.obliquity_deg);

  let mercury=null, M_mer=0;
  await new Promise((res)=> new GLTFLoader().load(MODEL_MERCURY,(g)=>{
    mercury = g.scene; mercury.name = "Mercury";
    prepPlanetMaterials(mercury, { roughness:0.96, metalness:0.0, normalScale:0.5 });
    const box=new THREE.Box3().setFromObject(mercury);
    const max=box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    mercury.scale.multiplyScalar(2.0/max);
    mercurySpin.add(mercury);
    res();
  }));

  // Focus + Orbit (come prima)
  const state={ pending:null };
  function smoothFocusTo(obj, { mult=CAMERA.RADIUS_MULT, minDist=CAMERA.MIN_DIST, dur=0.9 }={}){
    if(!obj) return;
    obj.updateMatrixWorld(true);
    const R=unitRadius(obj);
    let dir=camera.position.clone().sub(controls.target); if(dir.lengthSq()<1e-6) dir.set(0,0,1);
    dir.setLength(Math.max(minDist, R*mult));
    const c=obj.getWorldPosition(new THREE.Vector3());
    state.pending={ fromPos:camera.position.clone(), toPos:c.clone().add(dir), fromTgt:controls.target.clone(), toTgt:c.clone(), t:0, dur };
  }
  smoothFocusTo(mercury);

  const orbit=createOrbitRig(engine);
  const rInit = THREE.MathUtils.clamp(unitRadius(mercury) * (CAMERA.RADIUS_MULT_BIG?.MERCURY ?? CAMERA.RADIUS_MULT), CAMERA.MIN_DIST, CAMERA.MAX_DIST);
  orbit.setTarget(mercury); orbit.setRadius(rInit); orbit.setSpeed(0.16); orbit.setElevation(0.22);
  let startOrbitAfterFocus = true;

  // Keybinds
  const onKey = (e)=>{
    if (e.key === "0" && mercury){
      const mult = (CAMERA.RADIUS_MULT_BIG?.MERCURY ?? CAMERA.RADIUS_MULT);
      const dist = Math.max(CAMERA.MIN_DIST, unitRadius(mercury) * mult);
      smoothFocusTo(mercury, { mult, minDist:dist, dur:0.9 });
      startOrbitAfterFocus = true;
    }
    if (e.key === "1"){ if (orbit.isRunning()) orbit.stop(); else orbit.start(); }
  };
  window.addEventListener("keydown", onKey);

  // Tick
  const detach = onTick((dt, now)=>{
    sky.update(now);              
    sun.update(camera, now, dt);  

    mercuryPivot.position.copy(sun.group.position);
    M_mer = (M_mer + ORBIT.MERCURY * TIME.SPEED * dt) % (Math.PI*2);
    const { r:rUnit, nu } = (function(M,e){ let E=M; for(let k=0;k<4;k++){const f=E-e*Math.sin(E)-M,fp=1-e*Math.cos(E);E-=f/fp;} const cosE=Math.cos(E), sinE=Math.sin(E); return { r:1-e*cosE, nu:Math.atan2(Math.sqrt(1-e*e)*sinE, cosE-e), E }; })(M_mer, ELEMENTS.MERCURY.ecc);
    mercuryPivot.rotation.y = THREE.MathUtils.degToRad(ELEMENTS.MERCURY.raan_deg);
    mercuryTilt.rotation.x  = THREE.MathUtils.degToRad(ELEMENTS.MERCURY.incl_deg);
    mercuryPhase.rotation.y = THREE.MathUtils.degToRad(ELEMENTS.MERCURY.argperi_deg) + nu;
    mercuryCarrier.position.set(SCALE.AU * ELEMENTS.MERCURY.a_AU * rUnit, 0, 0);

    const spin = (true ? 1.5 * ORBIT.MERCURY * TIME.SPEED : ROT.MERCURY * TIME.SPEED);
    if (mercury) mercury.rotateOnAxis(UP_AXIS, spin * dt);

    if (state.pending){
      state.pending.t += dt/1000;
      const a=Math.min(1, state.pending.t/state.pending.dur);
      const k = a<0.5 ? 4*a*a*a : 1 - Math.pow(-2*a+2,3)/2;
      camera.position.lerpVectors(state.pending.fromPos, state.pending.toPos, k);
      controls.target.lerpVectors(state.pending.fromTgt, state.pending.toTgt, k);
      if (a>=1) state.pending=null;
    } else if (startOrbitAfterFocus){
      orbit.start(); startOrbitAfterFocus=false;
    }
  });

  return {
    dispose(){
      detach && detach();
      window.removeEventListener("keydown", onKey);
      orbit.stop();
      sky.dispose();          
      sun.dispose();          
      [mercuryPivot].forEach(obj=>{
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
