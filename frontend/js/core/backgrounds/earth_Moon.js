import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { createSky } from "../common/sky.js";
import { createSun } from "../common/sun.js";
import { SCALE, TIME, ROT, ORBIT, SUN, ELEMENTS, POSTFX, CAMERA } from "../config.js";

// ───────────────────────────────────────────────────────
// Asset paths (come nel tuo file)
const TEX_SKY     = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;
const TEX_NIGHT   = new URL("./textures/earth-night.png",     import.meta.url).href;
const TEX_CLOUDS  = new URL("./textures/earth_clouds.jpg",    import.meta.url).href;
const MODEL_EARTH = new URL("./models/Ter.glb",              import.meta.url).href;
const MODEL_MOON  = new URL("./models/Moon.glb",              import.meta.url).href;
const MODEL_SUN   = new URL("./models/Sun.glb",               import.meta.url).href; // opzionale nel createSun

// ───────────────────────────────────────────────────────
// Parametri animazioni (coerenti col resto)
const UP_AXIS        = new THREE.Vector3(0,1,0);
const EARTH_ROT      = (ROT?.EARTH ?? 0.00050) * TIME.SPEED;  
const CLOUDS_DRIFT   = -0.00012 * TIME.SPEED;                 
const MOON_ORBIT     =  0.00018 * TIME.SPEED;                 // rad/ms
const TIDAL_LOCK     = true;

// Blend giorno/notte
const duskParams = {
  nightCurve:     1.6,
  nightIntensity: 1.45,
  darkStrength:   0.82
};

// ───────────────────────────────────────────────────────
// Helpers
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

function focusCamera(camera, controls, obj, mult=4.0, phi=Math.PI/4, theta=0.9){
  if (!obj) return;
  const box=new THREE.Box3().setFromObject(obj);
  const size=box.getSize(new THREE.Vector3()).length();
  const center=box.getCenter(new THREE.Vector3());
  const dist=(size*mult)/Math.tan((Math.PI*camera.fov)/360);
  const offset=new THREE.Vector3().setFromSpherical(new THREE.Spherical(dist, phi, theta));
  camera.position.copy(center).add(offset);
  controls?.target.copy(center);
  controls?.update?.();
}

// ───────────────────────────────────────────────────────
export async function initBackground(engine){
  const { scene, camera, composer, controls, onTick } = engine;

  // Bloom da config
  let bloomPass=null;
  if (POSTFX?.BLOOM?.enabled && composer){
    const { strength, radius, threshold } = POSTFX.BLOOM;
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), strength, radius, threshold);
    composer.addPass(bloomPass);
  }

  // Cielo + Sole condivisi
  const sky = createSky({ scene, camera, textureUrl: TEX_SKY });
  const sun = await createSun({
    scene, camera,
    position: SUN.POS,
    angularDiameter: SUN.ANGULAR_DIAM,
    modelUrl: MODEL_SUN,          // se non ti serve il GLB, togli modelUrl
    modelTargetSize: 20,
    spin: SUN.ROT * TIME.SPEED,
    pulse: { enabled:true, amp:0.12, speed:0.6, haloAmp:0.10 },
    lightIntensity: 1.8,
    lightTint: [1.0, 0.95, 0.85]
  });

  // Terra
  const nightTex = new THREE.TextureLoader().load(TEX_NIGHT);
  nightTex.colorSpace = THREE.SRGBColorSpace; nightTex.anisotropy=8; nightTex.flipY=false;

  let earthRoot=null, earthMesh=null, cloudsMesh=null;

  await new Promise((resolve)=>{
    new GLTFLoader().load(MODEL_EARTH, async (gltf)=>{
      earthRoot = gltf.scene;
      scene.add(earthRoot);

      // prendi la mesh principale
      earthRoot.traverse(o=>{
        if (o.isMesh && (!earthMesh || /earth/i.test(o.name))) earthMesh=o;
      });
      if (!earthMesh){
        earthRoot.traverse(o=>{ if(!earthMesh && o.isMesh) earthMesh=o; });
      }
      if (!earthMesh){
        console.error("Earth mesh non trovata in Ter1.glb");
        return resolve();
      }

      // materiale: emissive notturna
      earthMesh.material.emissive = new THREE.Color(1.0, 0.88, 0.65);
      earthMesh.material.emissiveMap = nightTex;
      earthMesh.material.emissiveIntensity = duskParams.nightIntensity;
      earthMesh.material.needsUpdate = true;

      // hook terminatore + ombra nubi (view-space light dir)
      earthMesh.material.onBeforeCompile = (shader)=>{
        shader.uniforms.lightDirView     = { value:new THREE.Vector3(1,0,0) };
        shader.uniforms.uNightCurve      = { value:duskParams.nightCurve };
        shader.uniforms.uDarkStrength    = { value:duskParams.darkStrength };
        shader.uniforms.cloudsMap        = { value:null };
        shader.uniforms.uCloudsShift     = { value:0.0 };
        shader.uniforms.uShadowStrength  = { value:0.35 };

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

        earthMesh.userData.shader = shader;
        earthMesh.material.needsUpdate = true;
      };

      // shell nubi
      const cloudsTex = await buildCloudsTexture(TEX_CLOUDS);
      const cloudsMat = new THREE.MeshLambertMaterial({
        map: cloudsTex,
        transparent: true,
        depthWrite: false,
        depthTest:  true,           // test SI
        side:       THREE.FrontSide, // solo faccia esterna → niente “dietro” visibile
        alphaTest:  0.02,
        color:      0xffffff,
        opacity:    1.0
      });
      cloudsMesh = new THREE.Mesh(earthMesh.geometry, cloudsMat);
      cloudsMesh.scale.setScalar(1.003);
      cloudsMesh.renderOrder = 2;
      earthMesh.add(cloudsMesh);

      if (earthMesh.userData.shader){
        earthMesh.userData.shader.uniforms.cloudsMap.value = cloudsTex;
      }

      // focus iniziale
      focusCamera(camera, controls, earthMesh, 4.5, Math.PI/4, 0.9);
      resolve();
    });
  });

  // Luna semplice
  const moonPivot = new THREE.Group(); scene.add(moonPivot);
  let moon=null;
  new GLTFLoader().load(MODEL_MOON, (gltf)=>{
    moon = gltf.scene;
    moonPivot.add(moon);
    // distanza “gradevole”: ~8 raggi della Terra
    const R = (()=>{ // calcola raggio mondo Terra
      if (!earthMesh || !earthMesh.geometry) return 1;
      if (!earthMesh.geometry.boundingSphere) earthMesh.geometry.computeBoundingSphere();
      const r = earthMesh.geometry.boundingSphere.radius || 1;
      const s = earthMesh.getWorldScale(new THREE.Vector3());
      return r * Math.max(s.x,s.y,s.z);
    })();
    moon.position.set(8.0 * R, 0, 0);
  });

  // ───────────────────────────────────────────────────────
  // Tick
  const normalMat = new THREE.Matrix3();
  const wSun = new THREE.Vector3();
  const wEarth = new THREE.Vector3();
  const dirWorld = new THREE.Vector3();
  const dirView  = new THREE.Vector3();

  const detach = onTick((dt)=>{
    // aggiornamenti condivisi
    sky.update(performance.now());
    sun.update(camera, performance.now(), dt);

    // Terra
    if (earthRoot) earthRoot.rotateOnAxis(UP_AXIS, EARTH_ROT * dt);

    // Uniform direzione luce (view space) per il terminatore
    if (earthMesh && earthMesh.userData?.shader){
      sun.group.getWorldPosition(wSun);
      earthMesh.getWorldPosition(wEarth);
      dirWorld.subVectors(wSun, wEarth).normalize();
      normalMat.getNormalMatrix(camera.matrixWorldInverse);
      dirView.copy(dirWorld).applyMatrix3(normalMat).normalize();
      const U = earthMesh.userData.shader.uniforms;
      U.lightDirView.value.copy(dirView);
      // drift nubi come UV shift
      U.uCloudsShift.value = (U.uCloudsShift.value + (CLOUDS_DRIFT*dt)/(Math.PI*2)) % 1.0;
    }

    // Nubi (mesh) ruotano piano
    if (cloudsMesh) cloudsMesh.rotateOnAxis(UP_AXIS, CLOUDS_DRIFT * dt);

    // Luna: orbita semplice + tidal lock
    if (moon && earthMesh){
      earthMesh.getWorldPosition(wEarth);
      moonPivot.position.copy(wEarth);
      moonPivot.rotateOnAxis(UP_AXIS, MOON_ORBIT * dt);
      if (TIDAL_LOCK) moon.lookAt(wEarth);
    }
  });

  // ───────────────────────────────────────────────────────
  // Cleanup
  return {
    dispose(){
      detach && detach();
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
