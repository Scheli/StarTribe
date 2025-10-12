import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";

import { UP_AXIS, createOrbitRig, smoothFocusAuto, extendOrbitRigWithAuto,} from "../utils.js";
import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA, MOON  } from "../config.js";

/* Assets */
const TEX_SKY     = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const TEX_NIGHT   = new URL("./textures/earth-night.png",     import.meta.url).href;
const TEX_CLOUDS  = new URL("./textures/earth_clouds.jpg",    import.meta.url).href;
const MODEL_EARTH = new URL("./models/Ter.glb",               import.meta.url).href;
const MODEL_MOON  = new URL("./models/Moon.glb",              import.meta.url).href;
const MODEL_SUN   = new URL("./models/Sun.glb",               import.meta.url).href;

/* Parametri Terra/Luna */
const EARTH_ROT    = (ROT?.EARTH ?? 0.00050) * TIME.SPEED; // spin terrestre
const CLOUDS_DRIFT = -0.00012 * TIME.SPEED;
const TIDAL_LOCK   = true;

// Orbita eliocentrica (dati da ELEMENTS.EARTH)
const EAR_ECC         = ELEMENTS.EARTH.ecc;
const EAR_INCL_DEG    = ELEMENTS.EARTH.incl_deg;
const EAR_RAAN_DEG    = ELEMENTS.EARTH.raan_deg;
const EAR_ARGPERI_DEG = ELEMENTS.EARTH.argperi_deg;
const EAR_A           = SCALE.AU * ELEMENTS.EARTH.a_AU;
const EAR_ORBIT       = ORBIT.EARTH * TIME.SPEED;

const LUNAR_PERIOD_DAYS = MOON?.PERIOD_DAYS ?? 27.321661;
const LUNAR_SPEED_MULT  = MOON?.SPEED_MULT  ?? 1000;
const MOON_ORBIT_SPEED  = (2 * Math.PI) / (LUNAR_PERIOD_DAYS * 86400 * 1000) 
                          * TIME.SPEED * LUNAR_SPEED_MULT;
const MOON_DIST_FACTOR = 8.0;

/* Notte/giorno */
const duskParams = { nightCurve: 1.6, nightIntensity: 1.45, darkStrength: 0.82 };

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

async function buildCloudsTexture(path){
  const bmp = await fetch(path).then(r=>r.blob()).then(createImageBitmap);
  const W=bmp.width, H=bmp.height;
  const cvs=document.createElement("canvas"); cvs.width=W; cvs.height=H;
  const ctx=cvs.getContext("2d", { willReadFrequently:true });
  ctx.drawImage(bmp,0,0);
  const img=ctx.getImageData(0,0,W,H), d=img.data;
  const L0=0.35, L1=0.80, GAM=0.90;
  for (let i=0;i<d.length;i+=4){
    const r=d[i], g=d[i+1], b=d[i+2];
    const l=(0.2126*r+0.7152*g+0.0722*b)/255;
    let a=(l-L0)/(L1-L0); a=Math.min(1,Math.max(0,a)); a=Math.pow(a,GAM);
    d[i]=255; d[i+1]=255; d[i+2]=255; d[i+3]=Math.round(a*255);
  }
  ctx.putImageData(img,0,0);
  const tex=new THREE.CanvasTexture(cvs);
  tex.premultiplyAlpha = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.ClampToEdgeWrapping;
  tex.anisotropy=8; tex.needsUpdate=true;
  return tex;
}

export async function initBackground(engine){
  const { scene, camera, composer, onTick } = engine;

  // Bloom
  let bloomPass = null;
  if (POSTFX?.BLOOM?.enabled && composer){
    const { strength, radius, threshold } = POSTFX.BLOOM;
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      strength, radius, threshold
    );
    composer.addPass(bloomPass);
  }

  // Cielo + Sole
  const sky = createSky({ scene, camera, textureUrl: TEX_SKY });
  const sun = await createSun({
    scene, camera,
    position: SUN.POS,
    angularDiameter: SUN.ANGULAR_DIAM,
    modelUrl: MODEL_SUN,
    modelTargetSize: 20,
    spin: SUN.ROT * TIME.SPEED,
    pulse: { enabled:true, amp:0.12, speed:0.6, haloAmp:0.10 },
    lightIntensity: 1.8,
    lightTint: [1.0, 0.95, 0.85]
  });

  // Pivot/gerarchie Terra eliocentrica
  const earthOrbitPivot = new THREE.Group();   // centro sul Sole → traslato dal Sole
  const earthTilt       = new THREE.Group();   // inclinazione orbitale
  const earthPhase      = new THREE.Group();   // argomento del perielio + anomalia vera
  const earthCarrier    = new THREE.Group();   // traslazione su asse X (a*e)
  const earthSpin       = new THREE.Group();   // rotazione su asse proprio
  scene.add(earthOrbitPivot);
  earthOrbitPivot.add(earthTilt);
  earthTilt.add(earthPhase);
  earthPhase.add(earthCarrier);
  earthCarrier.add(earthSpin);

  earthOrbitPivot.rotation.y = THREE.MathUtils.degToRad(EAR_RAAN_DEG);
  earthTilt.rotation.x       = THREE.MathUtils.degToRad(EAR_INCL_DEG);

  // Terra (mesh + shader blend giorno/notte)
  const nightTex = new THREE.TextureLoader().load(TEX_NIGHT);
  nightTex.colorSpace = THREE.SRGBColorSpace; nightTex.anisotropy=8; nightTex.flipY=false;

  let earth=null, cloudsMesh=null;
  await new Promise((resolve)=>{
    new GLTFLoader().load(MODEL_EARTH, async (gltf)=>{
      earth = gltf.scene;
      earth.name = "Earth";
      earthSpin.add(earth);

      // hook shader: terminatore + night + ombra nubi
      earth.traverse(o=>{
        if (!o.isMesh || !o.material) return;
        o.material.emissive = new THREE.Color(1.0, 0.88, 0.65);
        o.material.emissiveMap = nightTex;
        o.material.emissiveIntensity = duskParams.nightIntensity;
        o.material.onBeforeCompile = (shader)=>{
          shader.uniforms.lightDirView    = { value:new THREE.Vector3(1,0,0) };
          shader.uniforms.uNightCurve     = { value:duskParams.nightCurve };
          shader.uniforms.uDarkStrength   = { value:duskParams.darkStrength };
          shader.uniforms.cloudsMap       = { value:null };
          shader.uniforms.uCloudsShift    = { value:0.0 };
          shader.uniforms.uShadowStrength = { value:0.35 };
          const tfn = (shader.glslVersion===THREE.GLSL3) ? "texture" : "texture2D";
          shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `
            #include <common>
            uniform vec3  lightDirView;
            uniform float uNightCurve;
            uniform float uDarkStrength;
            uniform sampler2D cloudsMap;
            uniform float uCloudsShift;
            uniform float uShadowStrength;
          `)
          .replace("#include <lights_fragment_end>", `
            #include <lights_fragment_end>
            {
              float ndl   = dot(normalize(normal), normalize(lightDirView));
              float dayL  = smoothstep(0.0, 0.2, ndl);
              float nightL= pow(1.0 - dayL, uNightCurve);

              totalEmissiveRadiance *= nightL;
              diffuseColor.rgb *= (1.0 - nightL * uDarkStrength);

              #ifdef USE_UV
                vec2 cuv = vUv + vec2(uCloudsShift, 0.0);
                float a  = ${tfn}(cloudsMap, cuv).a;
                diffuseColor.rgb *= 1.0 - (a * dayL * uShadowStrength);
              #endif
            }
          `);
          (o.userData ||= {}).shader = shader;
        };
        o.material.needsUpdate = true;
      });

      // Shell nubi
      const cloudsTex = await buildCloudsTexture(TEX_CLOUDS);
      const cloudsMat = new THREE.MeshLambertMaterial({
        map: cloudsTex,
        transparent: true,
        depthWrite: false,
        depthTest:  true,
        side:       THREE.FrontSide,
        alphaTest:  0.02,
        color:      0xffffff,
        opacity:    1.0
      });
      // riusa la geo del mesh principale (primo mesh trovato)
      let earthMesh = null;
      earth.traverse(o=>{ if (!earthMesh && o.isMesh) earthMesh = o; });
      if (earthMesh){
        cloudsMesh = new THREE.Mesh(earthMesh.geometry, cloudsMat);
        cloudsMesh.scale.setScalar(1.003);
        cloudsMesh.renderOrder = 2;
        earthMesh.add(cloudsMesh);

        const shader = earthMesh.userData?.shader;
        if (shader) shader.uniforms.cloudsMap.value = cloudsTex;
      }

      resolve();
    });
  });

  // Luna: pivot figlio della Terra
  const moonPivot = new THREE.Group(); earthSpin.add(moonPivot);
  let moon=null;
  new GLTFLoader().load(MODEL_MOON, (gltf)=>{
    moon = gltf.scene; moonPivot.add(moon);
  });

  /* -------------------- Focus + Orbit rig (auto frame-fill) -------------------- */
  const FILL = CAMERA.FRAME_FILL?.EARTH ?? CAMERA.FRAME_FILL_DEFAULT ?? 0.6;
  const FOCUS_DUR = 1.0;

  // focus morbido verso la Terra
  smoothFocusAuto(engine, earthSpin, { fill: FILL, dur: FOCUS_DUR });

  // rig con estensioni (auto raggio + warm-start)
  let orbit = createOrbitRig(engine);
  orbit = extendOrbitRigWithAuto(orbit, engine);
  orbit.setTarget(earthSpin);
  orbit.setRadiusAuto(earthSpin, { fill: FILL });
  orbit.setSpeed(0.14);
  orbit.setElevation(0.22);

  // avvia orbit dopo il focus
  let focusActive = true, focusTimer = 0;

  // Input opzionali
  const onKey = (e)=>{
    if (e.key === "0" && earthSpin){
      smoothFocusAuto(engine, earthSpin, { fill: FILL, dur: FOCUS_DUR });
      focusActive = true; focusTimer = 0;
      if (orbit.isRunning()) orbit.stop();
    }
    if (e.key === "1"){
      if (orbit.isRunning()) orbit.stop();
      else { orbit.matchCameraToCurrent(); orbit.start(); }
    }
  };
  window.addEventListener("keydown", onKey);

  /* --------------------------------- Tick --------------------------------- */
  const normalMat = new THREE.Matrix3();
  const wSun = new THREE.Vector3();
  const wEarth = new THREE.Vector3();
  const dirWorld = new THREE.Vector3();
  const dirView  = new THREE.Vector3();

  // anomalia media Terra
  let M_earth = 0;

  const detach = onTick((dt, now)=>{
    sky.update(now);
    sun.update(camera, now, dt);

    // Posiziona pivot Terra sul Sole
    earthOrbitPivot.position.copy(sun.group.position);

    // Keplero: aggiorna orbita eliocentrica Terra
    M_earth = (M_earth + EAR_ORBIT * dt) % (Math.PI * 2);
    const { r:rUnit, nu } = keplerSolve(M_earth, EAR_ECC);
    earthOrbitPivot.rotation.y = THREE.MathUtils.degToRad(EAR_RAAN_DEG);
    earthTilt.rotation.x       = THREE.MathUtils.degToRad(EAR_INCL_DEG);
    earthPhase.rotation.y      = THREE.MathUtils.degToRad(EAR_ARGPERI_DEG) + nu;
    earthCarrier.position.set(EAR_A * rUnit, 0, 0);

    // Rotazione terrestre
    if (earthSpin) earthSpin.rotateOnAxis(UP_AXIS, EARTH_ROT * dt);

    // Direzione luce (view space) + drift nubi
    if (earth && earth.children){
      sun.group.getWorldPosition(wSun);
      earthSpin.getWorldPosition(wEarth);
      dirWorld.subVectors(wSun, wEarth).normalize();
      normalMat.getNormalMatrix(camera.matrixWorldInverse);
      dirView.copy(dirWorld).applyMatrix3(normalMat).normalize();

      // aggiorna uniform su tutti i mesh della Terra
      earth.traverse(o=>{
        const shader = o.userData?.shader;
        if (shader){
          shader.uniforms.lightDirView.value.copy(dirView);
          shader.uniforms.uCloudsShift.value =
            (shader.uniforms.uCloudsShift.value + (CLOUDS_DRIFT*dt)/(Math.PI*2)) % 1.0;
        }
      });
    }

    // Nubi leggere
    if (cloudsMesh) cloudsMesh.rotateOnAxis(UP_AXIS, CLOUDS_DRIFT * dt);

    if (moon && earthSpin){
      const Rvis = (()=>{ 
        let em=null; earth.traverse(o=>{ if (!em && o.isMesh) em=o; });
        if (!em) return 1;
        if (!em.geometry.boundingSphere) em.geometry.computeBoundingSphere();
        const s = em.getWorldScale(new THREE.Vector3());
        return (em.geometry.boundingSphere?.radius || 1) * Math.max(s.x,s.y,s.z);
      })();

      moonPivot.rotateOnAxis(UP_AXIS, MOON_ORBIT_SPEED * dt);

      moon.position.set(MOON_DIST_FACTOR * Rvis, 0, 0);

      if (TIDAL_LOCK) {
        earthSpin.getWorldPosition(wEarth);
        moon.lookAt(wEarth);
      }
    }
    if (focusActive){
      focusTimer += dt/1000;
      if (focusTimer >= FOCUS_DUR){
        focusActive = false;
        orbit.matchCameraToCurrent();
        orbit.start();
      }
    }
  });

  /* ------------------------------- Cleanup ------------------------------- */
  return {
    dispose(){
      detach && detach();
      window.removeEventListener("keydown", onKey);
      orbit.stop();
      sky.dispose();
      sun.dispose();
      if (bloomPass && composer) composer.removePass(bloomPass);
      [scene].forEach(root=>{
        root.traverse?.(n=>{
          if (n.material){
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach(m=>m.map?.dispose?.());
            mats.forEach(m=>m.dispose?.());
          }
          n.geometry?.dispose?.();
        });
      });
    }
  };
}
