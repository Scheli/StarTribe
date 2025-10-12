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
const MODEL_SATURN  = new URL("./models/Saturn.glb",            import.meta.url).href;

/* Aliases */
const SAT_ECC         = ELEMENTS.SATURN.ecc;
const SAT_INCL_DEG    = ELEMENTS.SATURN.incl_deg;
const SAT_RAAN_DEG    = ELEMENTS.SATURN.raan_deg;
const SAT_ARGPERI_DEG = ELEMENTS.SATURN.argperi_deg;
const SAT_OBLQ_DEG    = ELEMENTS.SATURN.obliquity_deg;

const SAT_A     = SCALE.AU * ELEMENTS.SATURN.a_AU;
const SAT_ORBIT = ORBIT.SATURN * TIME.SPEED;
const SAT_ROT   = ROT.SATURN   * TIME.SPEED;

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

  // Gerarchia Saturno
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

  // rotazioni costanti (fuori dal tick)
  satTilt.rotation.x   = THREE.MathUtils.degToRad(SAT_INCL_DEG);
  satSpin.rotation.z   = THREE.MathUtils.degToRad(SAT_OBLQ_DEG);
  satPivot.rotation.y  = THREE.MathUtils.degToRad(SAT_RAAN_DEG);
  satPhase.rotation.y  = THREE.MathUtils.degToRad(SAT_ARGPERI_DEG); // + nu nel tick

  // Mesh Saturno (+ anelli)
  let saturn = null;
  await new Promise((res)=> new GLTFLoader().load(MODEL_SATURN,(g)=>{
    saturn = g.scene; saturn.name = "Saturn";
    prepPlanetMaterials(saturn, { roughness:0.97, metalness:0.0, normalScale:0.5 });

    // anelli: trasparenza/ordinamento
    saturn.traverse(o=>{
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
        m.blending    = THREE.NormalBlending;
        o.renderOrder = 20; // dopo il globo
      } else {
        m.transparent = false;
        m.depthWrite  = true;
        m.depthTest   = true;
        o.renderOrder = 10;
      }
    });

    // normalizzazione dimensione schermo
    const box = new THREE.Box3().setFromObject(saturn);
    const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b),1);
    saturn.scale.multiplyScalar(3.2 / max);
    saturn.position.set(0,0,0);
    satSpin.add(saturn);
    res();
  }));

  /* -------- Focus + Orbit rig (auto frame-fill) -------- */
  const FILL = CAMERA.FRAME_FILL?.SATURN ?? CAMERA.FRAME_FILL_DEFAULT ?? 0.6;
  const FOCUS_DUR = 1.0;

  // focus morbido
  smoothFocusAuto(engine, saturn, { fill: FILL, dur: FOCUS_DUR });

  // rig + estensioni
  let orbit = createOrbitRig(engine);
  orbit = extendOrbitRigWithAuto(orbit, engine);
  orbit.setTarget(saturn);
  orbit.setRadiusAuto(saturn, { fill: FILL });
  orbit.setSpeed(0.10);
  orbit.setElevation(0.22);

  // far partire l’orbita quando il focus è finito
  let focusActive = true, focusTimer = 0;

  // Input (0 refocus, 1 toggle orbit)
  const onKey = (e)=>{
    if (e.key === "0" && saturn){
      smoothFocusAuto(engine, saturn, { fill: FILL, dur: FOCUS_DUR });
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
  let M_sat = 0;
  const detach = onTick((dt, now)=>{
    sky.update(now);
    sun.update(camera, now, dt);

    // Orbita eliocentrica (Keplero)
    satPivot.position.copy(sun.group.position);
    M_sat = (M_sat + SAT_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_sat, SAT_ECC);
    satPhase.rotation.y = THREE.MathUtils.degToRad(SAT_ARGPERI_DEG) + nu;
    satCarrier.position.set(SAT_A * rUnit, 0, 0);

    // Spin planetario
    if (saturn) saturn.rotateOnAxis(UP_AXIS, SAT_ROT * dt);

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
