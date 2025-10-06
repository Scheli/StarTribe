import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/* =========================================================
   Config & asset paths (adatta ai tuoi)
   ========================================================= */
const TEX_SKY    = "./textures/stars_milky_way.jpg"; // sfondo
const TEX_NIGHT  = "./textures/earth-night.png";     // luci notturne Terra (sRGB)
const TEX_CLOUDS = "./textures/earth_clouds.jpg";    // mappa nubi (JPG)
const MODEL_EARTH= "./models/Ter1.glb";               // Terra
const MODEL_MOON = "./models/Moon.glb";              // Luna
const MODEL_SUN  = "./models/dragon_ball.glb";               // Sole (facoltativo, per disco 3D)

// Parametri animazioni
const EARTH_ROT      = 0.00050; // rad/ms
const CLOUDS_DRIFT   = -0.00012; // rad/ms
const MOON_ORBIT     = 0.00018; // rad/ms
const TIDAL_LOCK     = true;     // la Luna mostra sempre la stessa faccia
const SUN_ROT        = 0.00005;  // rad/ms
const SUN_POS        = new THREE.Vector3(-80, 20, -160);
const SUN_ANG_DIAM   = THREE.MathUtils.degToRad(0.53); // ~0.53°

// Parametri blend giorno/notte
const duskParams = {
  duskStart: 0.02,      // non usato direttamente, ma utile se vuoi espandere
  duskEnd:  -0.22,      // non usato direttamente, ma utile se vuoi espandere
  nightCurve: 1.6,      // curva del passaggio a notte
  nightIntensity: 1.45, // intensità emissiva delle luci notturne
  darkStrength: 0.82    // quanto scurisce il lato notturno
};

/* =========================================================
   Renderer, scena, camera, controlli
   ========================================================= */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 20000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Post FX (bloom per il Sole)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.2, 0.75);
composer.addPass(bloom);

/* =========================================================
   Cielo: via lattea + stelle parallax (billboard enorme)
   ========================================================= */
function makeMilkyWayDome(path, radius = 1600) {
  const tex = new THREE.TextureLoader().load(path);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false })
  );
}
function makeStarsLayer(n, radius, size, opacity) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const z = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const x = r * Math.cos(phi), y = r * Math.sin(phi);
    pos[i * 3] = x * radius; pos[i * 3 + 1] = z * radius; pos[i * 3 + 2] = y * radius;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size, opacity, transparent: true, sizeAttenuation: true, depthWrite: false });
  return new THREE.Points(geo, mat);
}

const skyDome = makeMilkyWayDome(TEX_SKY, 1600); scene.add(skyDome);
const starsGroup = new THREE.Group();
starsGroup.add(
  makeStarsLayer(12000, 1595, 0.6, 0.70),
  makeStarsLayer(6000, 1598, 1.1, 0.80),
  makeStarsLayer(1500, 1602, 1.8, 0.95)
); scene.add(starsGroup);

/* =========================================================
   Sole: luce + billboard (disco/alone) + GLB opzionale
   ========================================================= */
const sunGroup = new THREE.Group();
sunGroup.position.copy(SUN_POS);
scene.add(sunGroup);

const sunLight = new THREE.PointLight(0xffffff, 1.8, 0, 0);
sunLight.color.setRGB(1.0, 0.95, 0.85);
sunLight.position.copy(SUN_POS);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.bias = -0.00015;
sunLight.shadow.normalBias = 0.01;
scene.add(sunLight);

// Billboard del Sole (disco + alone)
const sunDiscMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  uniforms: { uColor: { value: new THREE.Color(1.0, 0.95, 0.85) }, uIntensity: { value: 1.2 }, uSoft: { value: 0.06 }, uTime: { value: 0.0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uIntensity,uSoft,uTime;\nfloat limb(vec2 uv,float s){ vec2 p=uv*2.-1.; float r=length(p); float core=1.-smoothstep(1.-s,1.,r); float dark=pow(1.-clamp(r,0.,1.),.4); return clamp(core+.4*dark,0.,1.);}\nvoid main(){ float m=limb(vUv,uSoft); m*=0.95+0.05*sin(uTime*2.3); vec3 col=uColor*m*uIntensity; gl_FragColor=vec4(col,m);} }
`});
const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sunDiscMat);
sunDisc.renderOrder = 11; sunGroup.add(sunDisc);

const sunHaloMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  uniforms: { uColor: { value: new THREE.Color(1.0, 0.85, 0.6) }, uIntensity: { value: 0.7 }, uFeather: { value: 0.9 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uIntensity,uFeather;\nvoid main(){ vec2 p=vUv*2.-1.; float r=length(p); float a=1.-smoothstep(uFeather,1.,r); vec3 c=uColor*a*uIntensity; gl_FragColor=vec4(c,a);} `
});
const sunHalo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sunHaloMat);
sunHalo.renderOrder = 10; sunGroup.add(sunHalo);

// (Opzionale) Sole 3D dal GLB
new GLTFLoader().load(MODEL_SUN, (g) => {
  const sun = g.scene; sun.traverse(o => { if (o.isMesh && o.material && 'emissiveIntensity' in o.material) o.material.emissiveIntensity = 8.0; if (o.material) o.material.depthWrite = false; });
  sun.scale.setScalar(10);
  sun.renderOrder = 9;
  sunGroup.add(sun);
});

// Aggiorna dimensione billboard in base alla distanza (diametro angolare costante)
const _sunPosW = new THREE.Vector3();
function updateSunSprites() {
  sunGroup.getWorldPosition(_sunPosW);
  const d = camera.position.distanceTo(_sunPosW);
  const size = 2 * d * Math.tan(SUN_ANG_DIAM * 0.5);
  sunDisc.scale.setScalar(size);
  sunHalo.scale.setScalar(size * 2.8);
  sunDisc.quaternion.copy(camera.quaternion);
  sunHalo.quaternion.copy(camera.quaternion);
}

/* =========================================================
   Terra + shader giorno/notte + nubi
   ========================================================= */
const nightTex = new THREE.TextureLoader().load(TEX_NIGHT);
nightTex.colorSpace = THREE.SRGBColorSpace; nightTex.anisotropy = 8; nightTex.flipY = false;

let earthRoot = null; // nodo root del GLB Terra
let earthMesh = null; // mesh principale
let cloudsMesh = null; // guscio nubi sintetico

// Utilità minime
const UP = new THREE.Vector3(0,1,0);
function earthWorldRadius(){
  if (!earthMesh || !earthMesh.geometry) return 1;
  if (!earthMesh.geometry.boundingSphere) earthMesh.geometry.computeBoundingSphere();
  const r = earthMesh.geometry.boundingSphere.radius || 1;
  const s = earthMesh.getWorldScale(new THREE.Vector3());
  return r * Math.max(s.x, s.y, s.z);
}

// Piccolo helper per generare un'alpha dalle clouds JPG
async function buildCloudsTexture(path){
  const bmp = await fetch(path).then(r=>r.blob()).then(b=>createImageBitmap(b));
  const W=bmp.width, H=bmp.height;
  const canv=document.createElement('canvas'); canv.width=W; canv.height=H; const ctx=canv.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bmp,0,0); const img=ctx.getImageData(0,0,W,H), d=img.data;
  const L0=0.35, L1=0.80, GAM=0.90; // threshold + gamma
  for(let i=0;i<d.length;i+=4){ const r=d[i], g=d[i+1], b=d[i+2]; const l=(0.2126*r+0.7152*g+0.0722*b)/255; let a=(l-L0)/(L1-L0); a=Math.min(1,Math.max(0,a)); a=Math.pow(a,GAM); d[i]=255; d[i+1]=255; d[i+2]=255; d[i+3]=Math.round(a*255); }
  ctx.putImageData(img,0,0);
  const tex = new THREE.CanvasTexture(canv); tex.premultiplyAlpha = true; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy=8;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true; return tex;
}

// Atmosfera sottile (rim light back-side)
function makeAtmosphereOuter(){
  return new THREE.Mesh(
    new THREE.SphereGeometry(1.05,64,64),
    new THREE.ShaderMaterial({ side:THREE.BackSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false,
      uniforms:{ glowColor:{value:new THREE.Color(0x5aa9ff)}, intensity:{value:0.08}, power:{value:2.8} },
      vertexShader:`varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader:`uniform vec3 glowColor; uniform float intensity; uniform float power; varying vec3 vN; void main(){ float rim=pow(1.0-max(dot(vN,vec3(0,0,1)),0.0), power); gl_FragColor=vec4(glowColor, rim*intensity);} `
    })
  );
}

// Carica Terra
new GLTFLoader().load(MODEL_EARTH, async (gltf) => {
  earthRoot = gltf.scene; scene.add(earthRoot);
  // prova a prendere una mesh chiamata "Earth", altrimenti la prima mesh
  earthRoot.traverse(o=>{ if (o.isMesh && (!earthMesh || /earth/i.test(o.name))) earthMesh = o; });
  if (!earthMesh) earthRoot.traverse(o=>{ if (!earthMesh && o.isMesh) earthMesh=o; });
  if (!earthMesh) return;

  // Materiale Terra: emissive notturna + attenuazione giorno/notte + ombra nubi
  const shaderHook = (shader)=>{
    shader.uniforms.lightDirView = { value: new THREE.Vector3(1,0,0) };
    shader.uniforms.uNightCurve  = { value: duskParams.nightCurve };
    shader.uniforms.uDarkStrength= { value: duskParams.darkStrength };
    shader.uniforms.cloudsMap    = { value: null };
    shader.uniforms.uCloudsShift = { value: 0.0 };
    shader.uniforms.uShadowStrength = { value: 0.35 };
    const tfn = (shader.glslVersion===THREE.GLSL3) ? 'texture' : 'texture2D';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 lightDirView;\nuniform float uNightCurve;\nuniform float uDarkStrength;\nuniform sampler2D cloudsMap;\nuniform float uCloudsShift;\nuniform float uShadowStrength;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n{\n  float ndl = dot(normalize(normal), normalize(lightDirView));\n  float dayL   = smoothstep(0.0, 0.2, ndl);\n  float nightL = pow(1.0 - dayL, uNightCurve);\n  totalEmissiveRadiance *= nightL;\n  diffuseColor.rgb *= (1.0 - nightL * uDarkStrength);\n  #ifdef USE_UV\n    vec2 cuv = vUv + vec2(uCloudsShift, 0.0);\n    float cloudA = ${tfn}(cloudsMap, cuv).a;\n    diffuseColor.rgb *= 1.0 - (cloudA * dayL * uShadowStrength);\n  #endif\n}`);
    earthMesh.userData.shader = shader;
  };

  earthMesh.material.emissive = new THREE.Color(1.0, 0.88, 0.65);
  earthMesh.material.emissiveMap = nightTex;
  earthMesh.material.emissiveIntensity = duskParams.nightIntensity;
  earthMesh.material.needsUpdate = true;
  earthMesh.material.onBeforeCompile = shaderHook;

  // Nubi: ricrea uno shell trasparente sopra la Terra usando la JPG
  const cloudsTex = await buildCloudsTexture(TEX_CLOUDS);
  const cloudsMat = new THREE.MeshLambertMaterial({ map: cloudsTex, transparent: true, depthWrite: false, alphaTest: 0.02, color: 0xffffff });
  cloudsMesh = new THREE.Mesh(earthMesh.geometry, cloudsMat);
  cloudsMesh.scale.setScalar(1.003);
  cloudsMesh.renderOrder = 2;
  earthMesh.add(cloudsMesh);
  // passa la mappa nubi allo shader Terra
  if (earthMesh.userData.shader) earthMesh.userData.shader.uniforms.cloudsMap.value = cloudsTex;

  // Atmosfera esterna tenue
  const atmosphere = makeAtmosphereOuter();
  earthMesh.parent.add(atmosphere);

  // Focus iniziale: Terra
  fitCameraToObject(earthMesh, 4.5, Math.PI/4, 0.9);

  // Ora che Terra è pronta, possiamo adattare la Luna (se già caricata)
  fitMoonToEarth();
});

/* =========================================================
   Luna: orbita semplice + tidal lock
   ========================================================= */
const moonPivot = new THREE.Group(); scene.add(moonPivot);
let moon = null;

new GLTFLoader().load(MODEL_MOON, (gltf) => {
  moon = gltf.scene; moonPivot.add(moon); fitMoonToEarth();
});

function fitMoonToEarth(){
  if (!moon || !earthMesh) return;
  const R = earthWorldRadius();
  // distanza ~8 raggi terrestri (scala scenica piacevole)
  moon.position.set(8.0 * R, 0, 0);
}

function alignMoonPivotToEarth(){
  if (!earthMesh) return; const p = new THREE.Vector3(); earthMesh.getWorldPosition(p); moonPivot.position.copy(p);
}

/* =========================================================
   Focus helpers
   ========================================================= */
function fitCameraToObject(obj, mult = 4.0, phi = Math.PI/4, theta = 0.9) {
  if (!obj) return;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());
  const dist = (size * mult) / Math.tan((Math.PI * camera.fov) / 360);
  const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(dist, phi, theta));
  camera.position.copy(center).add(offset);
  controls.target.copy(center);
  controls.update();
}

window.addEventListener('keydown', (e) => {
  if (e.key === '1') fitCameraToObject(sunGroup, 50, Math.PI/4, 0.8);
  if (e.key === '2') fitCameraToObject(earthMesh, 5, Math.PI/4, 0.9);
  if (e.key === '3') fitCameraToObject(moon, 8, Math.PI/3, 1.0);
});

/* =========================================================
   Loop animazione
   ========================================================= */
let last = performance.now();
const wSun = new THREE.Vector3(), wEarth = new THREE.Vector3(), dirWorld = new THREE.Vector3(), dirView = new THREE.Vector3();

(function animate(){
  requestAnimationFrame(animate);
  const now = performance.now(); let dt = now - last; last = now; dt = Math.min(dt, 50);

  // aggiorna parallax del cielo
  skyDome.position.copy(camera.position);
  starsGroup.position.copy(camera.position);
  const t = now * 0.001;
  starsGroup.children[0].material.opacity = 0.68 + 0.08 * Math.sin(t * 0.9);
  starsGroup.children[1].material.opacity = 0.78 + 0.08 * Math.sin(t * 1.1 + 1.7);
  starsGroup.children[2].material.opacity = 0.90 + 0.07 * Math.sin(t * 0.8 + 3.2);

  // Sole
  sunGroup.rotateOnAxis(UP, SUN_ROT * dt);
  sunGroup.getWorldPosition(wSun);
  sunLight.position.copy(wSun);
  sunDiscMat.uniforms.uTime.value = t;
  updateSunSprites();

  // Terra rotazione + shader (direzione Sole->Terra in view space)
  if (earthMesh) {
    earthRoot?.rotateOnAxis(UP, EARTH_ROT * dt);
    earthMesh.getWorldPosition(wEarth);
    // update uniform direzione luce in view space
    if (earthMesh.userData.shader) {
      dirWorld.subVectors(wSun, wEarth).normalize();
      dirView.copy(dirWorld).transformDirection(camera.matrixWorldInverse);
      earthMesh.userData.shader.uniforms.lightDirView.value.copy(dirView);
      const u = earthMesh.userData.shader.uniforms;
      // drift nubi (UV shift)
      u.uCloudsShift.value = (u.uCloudsShift.value + (CLOUDS_DRIFT * dt) / (Math.PI * 2)) % 1.0;
    }
  }
  // nubi (shell)
  if (cloudsMesh) cloudsMesh.rotateOnAxis(UP, CLOUDS_DRIFT * dt);

  // Luna: orbita semplice + tidal lock
  if (moon && earthMesh) {
    alignMoonPivotToEarth();
    moonPivot.rotateOnAxis(UP, MOON_ORBIT * dt);
    if (TIDAL_LOCK) moon.lookAt(wEarth);
  }

  controls.update();
  composer.render();
})();

/* =========================================================
   Resize
   ========================================================= */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
