import * as THREE from "three"; 
import { loadBitmap, tuneTex, cropHalfTexelX, wrap01 } from "../utils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

function _easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

function sunsetPose(earthMesh, sunGroup, {
  distMul = 2.6, upMul = 0.22, sideMul = -0.75, dutchDeg = -6
} = {}){
  const wE = new THREE.Vector3(), wS = new THREE.Vector3();
  earthMesh.getWorldPosition(wE); sunGroup.getWorldPosition(wS);
  const toSun = new THREE.Vector3().subVectors(wS, wE).normalize();
  const right = new THREE.Vector3().crossVectors(toSun, new THREE.Vector3(0,1,0)).normalize();
  const up    = new THREE.Vector3().crossVectors(right, toSun).normalize();
  if (!earthMesh.geometry.boundingSphere) earthMesh.geometry.computeBoundingSphere();
  const r = earthMesh.geometry.boundingSphere.radius || 1;
  const s = earthMesh.getWorldScale(new THREE.Vector3());
  const R = r * Math.max(s.x,s.y,s.z);
  const pos = wE.clone().addScaledVector(toSun,-R*distMul).addScaledVector(up,R*upMul).addScaledVector(right,R*sideMul);
  return { pos, lookAt:wE, dutchRad:THREE.MathUtils.degToRad(dutchDeg) };
}

export async function initBackground(engine){
  const { scene, camera, renderer, composer, onTick } = engine;
  if (engine.controls) engine.controls.enabled = false;
  if (engine.setInteractive) engine.setInteractive(false);

  // assets
  const MODEL_EARTH      = new URL("./models/Ter.glb", import.meta.url).href;
  const TEX_NIGHT        = new URL("./textures/earth-night.png", import.meta.url).href;
  const TEX_CLOUDS_JPG   = new URL("./textures/earth_clouds.jpg", import.meta.url).href;
  const TEX_CLOUDS_ALPHA = new URL("./textures/clouds-alpha.png", import.meta.url).href;
  const MODEL_MOON       = new URL("./models/Moon.glb", import.meta.url).href;
  const MODEL_SUN        = new URL("./models/dragon_ball.glb", import.meta.url).href;
  const TEX_SKY          = new URL("./textures/stars_milky_way.jpg", import.meta.url).href;

  // parametri
  const SUN_VISUAL_SCALE = 8.0, SUN_ROT=0.00005, SUN_ANG_DIAM = THREE.MathUtils.degToRad(0.53);
  const BLOOM = { strength:1.0, radius:0.25, threshold:0.72 };
  const AU_SCALE=14, EARTH_A_AU=1.0, EARTH_ECC=0.12, TIME_ACCEL_EARTH=14000;
  const EARTH_RAAN_DEG=-11.26064, EARTH_ARGPERI_DEG=102.94719, EARTH_INCL_DEG=0.0;
  const EARTH_MEAN_ORBIT = 0.00040*(88.0/365.25);
  const MOON_VISUAL_SCALE=1.6, MOON_R_RATIO=0.273, MOON_ORBIT_DAYS=27.321661, MOON_ECC=0.10, MOON_DIST_ER=3.6, MOON_INCL_DEG=5.145, TIME_ACCEL_MOON=14000;
  const EARTH_OBL_DEG=23.439281, TIDAL_LOCK=true;
  const duskParams={ nightCurve:1.6, nightIntensity:1.45, darkStrength:0.82 };
  const EARTH_ROT=0.00050, CLOUDS_A_DRIFT=-0.00010, CLOUDS_B_DRIFT=-0.00018, UP_AXIS=new THREE.Vector3(0,1,0);

  // cielo
  function makeMilkyWayDome(path,r=1600){
    const tex=new THREE.TextureLoader().load(path);
    tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.ClampToEdgeWrapping;
    return new THREE.Mesh(new THREE.SphereGeometry(r,64,64), new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,depthWrite:false}));
  }
  function makeStarsLayer(n,radius,size,opacity){
    const pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){ const z=Math.random()*2-1, phi=Math.random()*Math.PI*2, r=Math.sqrt(1-z*z);
      pos[i*3]=r*Math.cos(phi)*radius; pos[i*3+1]=z*radius; pos[i*3+2]=r*Math.sin(phi)*radius; }
    const geo=new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
    return new THREE.Points(geo,new THREE.PointsMaterial({color:0xffffff,size,opacity,transparent:true,depthWrite:false,sizeAttenuation:true}));
  }
  const skyDome=makeMilkyWayDome(TEX_SKY,1600); scene.add(skyDome);
  const starsGroup=new THREE.Group();
  const stars1=makeStarsLayer(12000,1595,0.6,0.58);
  const stars2=makeStarsLayer( 6000,1598,1.1,0.66);
  const stars3=makeStarsLayer( 1500,1602,1.8,0.82);
  starsGroup.add(stars1,stars2,stars3); scene.add(starsGroup);

  // sole
  const sunGroup=new THREE.Group(); scene.add(sunGroup);
  const sunLight=new THREE.PointLight(0xffffff,1.8,0,0); sunLight.color.setRGB(1.05,0.83,0.62); scene.add(sunLight);
  let bloomPass=null;
  if (composer){ bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), BLOOM.strength,BLOOM.radius,BLOOM.threshold); composer.addPass(bloomPass); renderer.toneMappingExposure=1.18; }
  const sunDiscMat=new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false,
    uniforms:{ uColor:{value:new THREE.Color(1.0,0.95,0.85)}, uIntensity:{value:1.25}, uSoft:{value:0.06}, uTime:{value:0.0} },
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`varying vec2 vUv; uniform vec3 uColor; uniform float uIntensity,uSoft,uTime;
    float limb(vec2 uv,float s){ vec2 p=uv*2.-1.; float r=length(p); float core=1.-smoothstep(1.-s,1.,r); float dark=pow(1.-clamp(r,0.,1.),.4); return clamp(core+.4*dark,0.,1.); }
    void main(){ float m=limb(vUv,uSoft); m*=0.95+0.05*sin(uTime*2.3); vec3 col=uColor*m*uIntensity; gl_FragColor=vec4(col,m); }`
  });
  const sunHaloMat=new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false,
    uniforms:{ uColor:{value:new THREE.Color(1.0,0.85,0.6)}, uIntensity:{value:0.75}, uFeather:{value:0.9} },
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`varying vec2 vUv; uniform vec3 uColor; uniform float uIntensity,uFeather;
    void main(){ vec2 p=vUv*2.-1.; float r=length(p); float a=1.-smoothstep(uFeather,1.,r); gl_FragColor=vec4(uColor*a*uIntensity,a); }`
  });
  const sunDisc=new THREE.Mesh(new THREE.PlaneGeometry(1,1),sunDiscMat); sunDisc.renderOrder=11; sunGroup.add(sunDisc);
  const sunHalo=new THREE.Mesh(new THREE.PlaneGeometry(1,1),sunHaloMat); sunHalo.renderOrder=10; sunGroup.add(sunHalo);
  new GLTFLoader().load(MODEL_SUN,(gltf)=>{ const m=gltf.scene; m.scale.setScalar(SUN_VISUAL_SCALE); m.traverse(o=>{ if(!o.isMesh)return; o.castShadow=o.receiveShadow=false; if(o.material){ if("emissiveIntensity" in o.material) o.material.emissiveIntensity=6.0; o.material.depthWrite=false; o.material.transparent=true; } o.renderOrder=9; o.frustumCulled=false; }); sunGroup.add(m); });

  // gerarchia orbite
  const earthOrbitPivot=new THREE.Group(), earthOrbitTilt=new THREE.Group(), earthOrbitPhase=new THREE.Group(), earthCarrier=new THREE.Group(), earthSeasonFix=new THREE.Group(), earthObliquity=new THREE.Group(), earthRotator=new THREE.Group();
  earthOrbitPivot.add(earthOrbitTilt); earthOrbitTilt.add(earthOrbitPhase); earthOrbitPhase.add(earthCarrier); earthCarrier.add(earthSeasonFix); earthSeasonFix.add(earthObliquity); earthObliquity.add(earthRotator); scene.add(earthOrbitPivot);
  const moonOrbitPivot=new THREE.Group(), moonIncl=new THREE.Group(), moonRadius=new THREE.Group(), moonSelf=new THREE.Group();
  moonOrbitPivot.add(moonIncl); moonIncl.add(moonRadius); moonRadius.add(moonSelf); earthCarrier.add(moonOrbitPivot);

  // atmosfera terra — morbida con feather controllabile
  function makeAtmosphereOuter({
    color = 0x5aa9ff, intensity = 0.11, power = 2.2, feather = 0.28
  } = {}){
    return new THREE.Mesh(
      new THREE.SphereGeometry(1.05,64,64),
      new THREE.ShaderMaterial({
        side:THREE.BackSide, transparent:true, depthWrite:false, blending:THREE.NormalBlending,
        uniforms:{
          glowColor:{value:new THREE.Color(color)},
          intensity:{value:intensity},
          power:{value:power},
          feather:{value:feather}
        },
        vertexShader:`
          varying vec3 vN;
          varying vec3 vViewDir;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            vN = normalize(normalMatrix * normal);
            vViewDir = normalize(-mv.xyz); // direzione verso camera in view space
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader:`
          uniform vec3  glowColor;
          uniform float intensity;
          uniform float power;
          uniform float feather; // 0..1 quanto è “larga” la sfumatura
          varying vec3 vN;
          varying vec3 vViewDir;
          void main(){
            float ndv = clamp(dot(normalize(vN), normalize(vViewDir)), 0.0, 1.0);
            float fres = pow(1.0 - ndv, power); // rim alto ai bordi
            float a = smoothstep(1.0 - feather, 1.0, fres); // controllo morbidezza
            gl_FragColor = vec4(glowColor, a * intensity);
          }`
      })
    );
  }

  // terra + nuvole
  let earthMesh=null, cloudsA=null, cloudsB=null, earthCamRig=null, camHome=null;
  const nightTex=new THREE.TextureLoader().load(TEX_NIGHT); nightTex.colorSpace=THREE.SRGBColorSpace; nightTex.anisotropy=8; nightTex.flipY=false;

  async function buildCloudsAlpha(path){
    const bmp=await loadBitmap(path), W=bmp.width,H=bmp.height;
    const can=document.createElement("canvas"); can.width=W; can.height=H;
    const ctx=can.getContext("2d",{willReadFrequently:true}); ctx.translate(0,H); ctx.scale(1,-1); ctx.drawImage(bmp,0,0,W,H);
    const img=ctx.getImageData(0,0,W,H), d=img.data;
    let hasA=false; for(let i=3;i<d.length;i+=4){ if(d[i]!==255){hasA=true;break;} }
    if(!hasA){ for(let i=0;i<d.length;i+=4){ const r=d[i],g=d[i+1],b=d[i+2]; const lum=(0.2126*r+0.7152*g+0.0722*b); d[i]=255; d[i+1]=255; d[i+2]=255; d[i+3]=Math.max(0,Math.min(255,lum)); } ctx.putImageData(img,0,0); }
    const tmp=document.createElement("canvas"); tmp.width=W; tmp.height=H; const tctx=tmp.getContext("2d");
    tctx.putImageData(img,0,0); tctx.filter="blur(0.6px)"; tctx.drawImage(tmp,0,0); const bl=tctx.getImageData(0,0,W,H).data;
    for(let i=0;i<d.length;i+=4){ d[i+3]=Math.max(d[i+3], bl[i+3]*0.55); }
    const bleed=Math.max(4,Math.floor(W/256)); const L=ctx.getImageData(0,0,bleed,H), R=ctx.getImageData(W-bleed,0,bleed,H);
    ctx.putImageData(R,0,0); ctx.putImageData(L,W-bleed,0);
    const tex=new THREE.CanvasTexture(can); tex.premultiplyAlpha=true; tuneTex(tex); cropHalfTexelX(tex); tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.ClampToEdgeWrapping; tex.anisotropy=8; return tex;
  }
  async function buildCloudsFromJPG(path){
    const bmp=await loadBitmap(path), W=bmp.width,H=bmp.height;
    const can=document.createElement("canvas"); can.width=W; can.height=H;
    const ctx=can.getContext("2d",{willReadFrequently:true}); ctx.drawImage(bmp,0,0,W,H);
    const img=ctx.getImageData(0,0,W,H), d=img.data; const L0=0.35,L1=0.80,GAM=0.90,PF=0.025;
    const st=(x,a,b)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
    const pole=new Float32Array(H); for(let y=0;y<H;y++){ const yn=y/(H-1); pole[y]=st(yn,0,PF)*st(1-yn,0,PF); }
    for(let y=0;y<H;y++){ const pm=pole[y]; for(let x=0;x<W;x++){ const i=(y*W+x)*4, r=d[i], g=d[i+1], b=d[i+2]; const l=(0.2126*r+0.7152*g+0.0722*b)/255; let a=(l-L0)/(L1-L0); a=Math.min(1,Math.max(0,a)); a=Math.pow(a,GAM)*pm; d[i]=255; d[i+1]=255; d[i+2]=255; d[i+3]=Math.round(a*255); } }
    const tmp=document.createElement("canvas"); tmp.width=W; tmp.height=H; const tctx=tmp.getContext("2d"); tctx.putImageData(img,0,0); tctx.filter="blur(0.6px)"; tctx.drawImage(tmp,0,0);
    const bl=tctx.getImageData(0,0,W,H).data; for(let i=0;i<d.length;i+=4){ const a0=d[i+3]/255, ab=bl[i+3]/255; d[i+3]=Math.round(Math.max(a0,ab*0.55)*255); }
    const colsum=new Float32Array(W); for(let x=0;x<W;x++){ let s=0; for(let y=0;y<H;y++) s+=d[(y*W+x)*4+3]; colsum[x]=s; }
    let best=0,cost=1e9; for(let s=0;s<W;s++){ const c=colsum[s]+colsum[(s-1+W)%W]; if(c<cost){cost=c;best=s;} }
    if(best!==0){ const c1=document.createElement("canvas"); c1.width=W; c1.height=H; c1.getContext("2d").putImageData(img,0,0);
      const c2=document.createElement("canvas"); c2.width=W; c2.height=H; const g=c2.getContext("2d");
      g.drawImage(c1,best,0,W-best,H,0,0,W-best,H); g.drawImage(c1,0,0,best,H,W-best,0,best,H); ctx.clearRect(0,0,W,H); ctx.drawImage(c2,0,0); }
    const bleed=Math.max(4,Math.floor(W/256)); const L=ctx.getImageData(0,0,bleed,H), R=ctx.getImageData(W-bleed,0,bleed,H);
    ctx.putImageData(R,0,0); ctx.putImageData(L,W-bleed,0);
    const tex=new THREE.CanvasTexture(can); tex.premultiplyAlpha=true; tuneTex(tex); cropHalfTexelX(tex);
    tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.ClampToEdgeWrapping; tex.anisotropy=8; return tex;
  }

  const loaderEarth=new GLTFLoader();
  loaderEarth.load(MODEL_EARTH, async (gltf)=>{
    const root=gltf.scene; earthRotator.add(root);
    root.traverse(o=>{ if (o.isMesh && (!earthMesh || /earth/i.test(o.name))) earthMesh=o; });
    if(!earthMesh){ root.traverse(o=>{ if(!earthMesh && o.isMesh) earthMesh=o; }); }
    if(!earthMesh){ console.error("Terra non trovata in Ter.glb"); return; }

    earthMesh.material.emissive = new THREE.Color(1.0,0.88,0.65);
    earthMesh.material.emissiveMap = nightTex;
    earthMesh.material.emissiveIntensity = duskParams.nightIntensity;
    earthMesh.material.needsUpdate = true;

    earthMesh.material.onBeforeCompile = (shader) => {
      shader.uniforms.lightDirView      = { value: new THREE.Vector3(1,0,0) };
      shader.uniforms.uNightCurve       = { value: duskParams.nightCurve };
      shader.uniforms.uDarkStrength     = { value: duskParams.darkStrength };
      shader.uniforms.cloudsMapA        = { value: null };
      shader.uniforms.cloudsMapB        = { value: null };
      shader.uniforms.uCloudsShiftA     = { value: 0.0 };
      shader.uniforms.uCloudsShiftB     = { value: 0.0 };
      shader.uniforms.uShadowStrengthA  = { value: 0.28 };
      shader.uniforms.uShadowStrengthB  = { value: 0.22 };
      shader.uniforms.uTerminatorBias   = { value: 0.10 }; // +10% giorno

      const sampleFn = (shader.glslVersion === THREE.GLSL3) ? 'texture' : 'texture2D';

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `
          #include <common>
          uniform vec3  lightDirView;
          uniform float uNightCurve;
          uniform float uDarkStrength;
          uniform sampler2D cloudsMapA;
          uniform sampler2D cloudsMapB;
          uniform float uCloudsShiftA;
          uniform float uCloudsShiftB;
          uniform float uShadowStrengthA;
          uniform float uShadowStrengthB;
          uniform float uTerminatorBias;
        `)
        .replace('#include <lights_fragment_end>', `
          #include <lights_fragment_end>
          {
            float ndl   = dot(normalize(normal), normalize(lightDirView));
            float dayL  = smoothstep(uTerminatorBias, uTerminatorBias + 0.2, ndl);
            float nightL= pow(1.0 - dayL, uNightCurve);

            totalEmissiveRadiance *= nightL;
            diffuseColor.rgb *= (1.0 - nightL * uDarkStrength);

            #ifdef USE_UV
              vec2 cuvA = vUv + vec2(uCloudsShiftA, 0.0);
              vec2 cuvB = vUv + vec2(uCloudsShiftB, 0.0);
              float aA  = ${sampleFn}(cloudsMapA, cuvA).a;
              float aB  = ${sampleFn}(cloudsMapB, cuvB).a;
              float a   = max(aA, aB);
              float s   = clamp(uShadowStrengthA + uShadowStrengthB, 0.0, 1.0);
              diffuseColor.rgb *= 1.0 - (a * dayL * s);
            #endif
          }
        `);

      earthMesh.userData.shader = shader;
      earthMesh.material.needsUpdate = true;
    };

    const texA=await buildCloudsAlpha(TEX_CLOUDS_ALPHA);
    const texB=await buildCloudsFromJPG(TEX_CLOUDS_JPG);

    cloudsA=new THREE.Mesh(earthMesh.geometry,new THREE.MeshLambertMaterial({map:texA,transparent:true,depthWrite:false,alphaTest:0.02,color:0xffffff,opacity:1.0}));
    cloudsA.scale.setScalar(1.004); cloudsA.renderOrder=2; earthMesh.add(cloudsA);
    cloudsB=new THREE.Mesh(earthMesh.geometry,new THREE.MeshLambertMaterial({map:texB,transparent:true,depthWrite:false,alphaTest:0.02,color:0xffffff,opacity:0.9}));
    cloudsB.scale.setScalar(1.006); cloudsB.renderOrder=3; earthMesh.add(cloudsB);

    if (earthMesh.userData.shader){ const U=earthMesh.userData.shader.uniforms; U.cloudsMapA.value=texA; U.cloudsMapB.value=texB; }

    const atmosphere=makeAtmosphereOuter({ intensity:0.11, power:2.2, feather:0.30 });
    earthMesh.parent.add(atmosphere);

    // Rig camera (tre quarti)
    const { pos, dutchRad } = sunsetPose(earthMesh, sunGroup);
    earthCamRig=new THREE.Group(); earthObliquity.add(earthCamRig);
    camHome=new THREE.Group(); earthCamRig.add(camHome);
    const posLocal=camHome.parent.worldToLocal(pos.clone()); camHome.position.copy(posLocal);
    camHome.add(camera); camera.position.set(0,0,0); camera.lookAt(earthCamRig.getWorldPosition(new THREE.Vector3()));
    camHome.rotation.z=dutchRad; camera.fov=35; camera.updateProjectionMatrix();
  });

  // Luna
  let moon=null;
  new GLTFLoader().load(MODEL_MOON,(gltf)=>{
    moon=gltf.scene; moon.name="Moon";
    moon.traverse(o=>{ if(!o.isMesh||!o.material) return; o.castShadow=false; o.receiveShadow=true; if('metalness' in o.material) o.material.metalness=0.0; if('roughness' in o.material) o.material.roughness=1.0; });
    moon.scale.setScalar(MOON_R_RATIO*MOON_VISUAL_SCALE);
    moonSelf.add(moon);
  });

  // inizializza orbite
  const RAAN=THREE.MathUtils.degToRad(EARTH_RAAN_DEG), INC=THREE.MathUtils.degToRad(EARTH_INCL_DEG), OMEGA=THREE.MathUtils.degToRad(EARTH_ARGPERI_DEG);
  earthOrbitPivot.rotation.y=RAAN; earthOrbitTilt.rotation.x=INC; earthObliquity.rotation.x=THREE.MathUtils.degToRad(EARTH_OBL_DEG);
  moonIncl.rotation.x=THREE.MathUtils.degToRad(MOON_INCL_DEG);

  // loop
  const normalMat=new THREE.Matrix3(); const tmp1=new THREE.Vector3(), tmp2=new THREE.Vector3();
  let tSec=0, M_earth=0, M_moon=1.1;

  function keplerSolve(M,e){ let E=M; for(let k=0;k<4;k++){ const f=E-e*Math.sin(E)-M, fp=1-e*Math.cos(E); E-=f/fp; }
    const cosE=Math.cos(E), sinE=Math.sin(E); return { r:1-e*cosE, nu:Math.atan2(Math.sqrt(1-e*e)*sinE, cosE-e), E }; }

  const offTick=onTick((dt)=>{
    tSec += dt/1000;

    skyDome.position.copy(camera.position);
    starsGroup.position.copy(camera.position);
    stars1.material.opacity = 0.52 + 0.06*Math.sin(tSec*0.9);
    stars2.material.opacity = 0.60 + 0.06*Math.sin(tSec*1.1+1.7);
    stars3.material.opacity = 0.78 + 0.05*Math.sin(tSec*0.8+3.2);

    sunGroup.rotateOnAxis(UP_AXIS, SUN_ROT*dt);
    const sunPosW=sunGroup.getWorldPosition(tmp1); sunLight.position.copy(sunPosW);
    camera.getWorldPosition(tmp2);
    const d=tmp2.distanceTo(sunPosW), size=2*d*Math.tan(SUN_ANG_DIAM*0.5);
    sunDisc.scale.setScalar(size); sunHalo.scale.setScalar(size*2.8);
    sunDisc.quaternion.copy(camera.quaternion); sunHalo.quaternion.copy(camera.quaternion);
    sunDiscMat.uniforms.uTime.value=tSec;

    const dtYearsE=(dt/1000)*(TIME_ACCEL_EARTH/(365.25*24*3600));
    const dtYearsM=(dt/1000)*(TIME_ACCEL_MOON /(365.25*24*3600));

    M_earth=(M_earth+EARTH_MEAN_ORBIT*dt)% (Math.PI*2);
    const { r:rE, nu:nuE }=keplerSolve(M_earth,EARTH_ECC);
    earthOrbitPhase.rotation.y=OMEGA+nuE;
    earthCarrier.position.set(EARTH_A_AU*AU_SCALE*rE,0,0);

    const nMoon=(2*Math.PI)/(MOON_ORBIT_DAYS/365.25);
    M_moon=(M_moon+nMoon*dtYearsM)% (Math.PI*2);
    const { r:rM, nu:nuM }=keplerSolve(M_moon,MOON_ECC);
    moonOrbitPivot.rotation.y=nuM;
    moonRadius.position.set(MOON_DIST_ER*rM,0,0);

    if (TIDAL_LOCK && moon){ const wE=earthRotator.getWorldPosition(tmp2); moon.lookAt(wE); }

    earthRotator.rotateOnAxis(UP_AXIS, EARTH_ROT*dt);
    if (cloudsA) cloudsA.rotateOnAxis(UP_AXIS, CLOUDS_A_DRIFT*dt);
    if (cloudsB) cloudsB.rotateOnAxis(UP_AXIS, CLOUDS_B_DRIFT*dt);

    if (earthMesh && earthMesh.userData?.shader){
      const wSun=sunGroup.getWorldPosition(tmp1), wEarth=earthMesh.getWorldPosition(tmp2);
      const dirWorld=wSun.clone().sub(wEarth).normalize();
      normalMat.getNormalMatrix(camera.matrixWorldInverse);
      const dirView=dirWorld.applyMatrix3(normalMat).normalize();
      const U=earthMesh.userData.shader.uniforms;
      U.lightDirView.value.copy(dirView);
      U.uCloudsShiftA.value=wrap01(U.uCloudsShiftA.value+(CLOUDS_A_DRIFT*dt)/(Math.PI*2));
      U.uCloudsShiftB.value=wrap01(U.uCloudsShiftB.value+(CLOUDS_B_DRIFT*dt)/(Math.PI*2));
    }

    if (earthCamRig){ const targetW=earthCamRig.getWorldPosition(tmp1); camera.lookAt(targetW); }
  });

  return {
    dispose(){
      offTick();
      if (bloomPass && composer) composer.removePass(bloomPass);
      scene.remove(skyDome, starsGroup, sunGroup);
      skyDome.geometry.dispose(); skyDome.material.dispose();
      starsGroup.traverse(o=>{ o.geometry?.dispose?.(); o.material?.dispose?.(); });
    }
  };
}
