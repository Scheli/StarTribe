import * as THREE from "three";

/* ------------------------- numerica / utilità base ------------------------- */
export const UP_AXIS = new THREE.Vector3(0, 1, 0);

export function wrap01(x){ x = x % 1; return x < 0 ? x + 1 : x; }

/** raggio “unitario” di un oggetto (boundingSphere * scala maggiore) */
export function unitRadius(obj){
  if (!obj?.isObject3D) return 1;
  const bs = obj.geometry?.boundingSphere || (obj.geometry && obj.geometry.computeBoundingSphere(), obj.geometry?.boundingSphere);
  const r  = bs?.radius || 1;
  const s  = obj.getWorldScale(new THREE.Vector3());
  return r * Math.max(s.x, s.y, s.z);
}

/** worldPosition rapido con out opzionale */
export function worldPosOf(obj, out = new THREE.Vector3()){
  obj.updateMatrixWorld(true);
  return obj.getWorldPosition(out);
}

/* -------------------------- texture & materiali --------------------------- */
export async function loadBitmap(path){
  const r = await fetch(path);
  const b = await r.blob();
  return await createImageBitmap(b, { colorSpaceConversion: "default" });
}

/** tuning sensato per texture sRGB + mipmap */
export function tuneTex(tex){
  tex.colorSpace = THREE.SRGBColorSpace; // (encoding sRGB per compat vecchie)
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
}

/** elimina la cucitura all’estremità X (taglio mezzo texel) */
export function cropHalfTexelX(tex){
  function go(t){
    if (!t.image || !t.image.width) return;
    const eps = 0.5 / t.image.width;
    t.offset.x = eps;
    t.repeat.x = 1 - 2 * eps;
    t.wrapS = THREE.RepeatWrapping;
    t.needsUpdate = true;
  }
  if (tex.image) go(tex); else tex.onUpdate = (t)=>{ go(t); t.onUpdate = null; };
}

/** rifinitura materiali “planetari” (no metal, più rough, normalScale uniforme) */
export function prepPlanetMaterials(root, {
  roughness = 0.96, metalness = 0.0, normalScale = 0.6, anisotropy = 8
} = {}){
  root.traverse((o)=>{
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats){
      if ('metalness' in m) m.metalness = metalness;
      if ('roughness' in m) m.roughness = roughness;
      if (m.normalScale)   m.normalScale.setScalar(normalScale);
      if (m.map){
        m.map.anisotropy = anisotropy;
        if ('colorSpace' in m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        if ('encoding' in m.map)   m.map.encoding   = THREE.sRGBEncoding; // three vecchie
        m.map.wrapS = THREE.RepeatWrapping;
        m.map.wrapT = THREE.ClampToEdgeWrapping;
        m.map.needsUpdate = true;
      }
      m.needsUpdate = true;
    }
  });
}

/**
 * “Fix” morbido dei poli: ammorbidisce normal/roughness verso nord/sud
 * usando uno shader hook su onBeforeCompile. Non tocca le UV.
 */
export function polarFixPlanetMaterial(
  mat,
  { poleWidth=0.12, normalStrength=1.0, roughStrength=1.0, roughTarget=1.0 } = {}
){
  if (!mat || mat.userData?._polarFix) return;

  mat.onBeforeCompile = (shader)=>{
    shader.uniforms.uPoleW         = { value:poleWidth };
    shader.uniforms.uPoleNormal    = { value:normalStrength };
    shader.uniforms.uPoleRough     = { value:roughStrength };
    shader.uniforms.uPoleRoughTarget = { value:roughTarget };

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        #ifdef USE_UV
          float north = smoothstep(1.0 - uPoleW, 1.0, vUv.y);
          float south = 1.0 - smoothstep(0.0, uPoleW, vUv.y);
          float poleMaskN = max(north, south) * uPoleNormal;
          normal = normalize( mix(normal, geometryNormal, poleMaskN) );
        #endif
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        #ifdef USE_UV
          float southR = 1.0 - smoothstep(0.0, uPoleW, vUv.y);
          float northR = smoothstep(1.0 - uPoleW, 1.0, vUv.y);
          float poleMaskR = max(northR, southR) * uPoleRough;
          roughnessFactor = mix(roughnessFactor, uPoleRoughTarget, poleMaskR);
        #endif
      `);

    mat.userData = mat.userData || {};
    mat.userData._polarFix = {
      uPoleW: shader.uniforms.uPoleW,
      uPoleNormal: shader.uniforms.uPoleNormal,
      uPoleRough: shader.uniforms.uPoleRough,
      uPoleRoughTarget: shader.uniforms.uPoleRoughTarget
    };
  };
  mat.needsUpdate = true;
}

/* --------------------------- ricerca guscio nubi --------------------------- */
/** Trova un mesh “cloud shell” vicino alla superficie del pianeta */
export function findCloudShellAroundPlanet(planet){
  if (!planet) return null;
  planet.updateMatrixWorld(true);
  const R = unitRadius(planet);
  let best=null, bestScore=Infinity;
  const tmp = new THREE.Vector3();

  planet.traverse(o=>{
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.getWorldScale(tmp);
    const rw = (o.geometry.boundingSphere?.radius||0) * Math.max(tmp.x,tmp.y,tmp.z);
    if (!rw) return;
    const ratio = rw / R;
    if (ratio > 1.001 && ratio < 1.08) {
      const nameBonus = /cloud|atmos/i.test(o.name) ? -0.02 : 0.0;
      const score = Math.abs(ratio - 1.01) + nameBonus;
      if (score < bestScore) { bestScore = score; best = o; }
    }
  });
  return best;
}

/** Variante: usa solo la metrica di vicinanza in scala, partendo da un “root” noto */
export function findCloudShellBySize(root, planetMeshLike){
  if (!root || !planetMeshLike?.geometry) return null;
  const R = planetMeshLike.geometry.boundingSphere
      ? planetMeshLike.geometry.boundingSphere.radius
      : (planetMeshLike.geometry.computeBoundingSphere(), planetMeshLike.geometry.boundingSphere.radius);
  let best=null, bestScore=Infinity;
  root.traverse(o=>{
    if (!o.isMesh || !o.geometry || o===planetMeshLike) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const r = o.geometry.boundingSphere?.radius || 0;
    const ratio = r / R;
    if (ratio > 1.001 && ratio < 1.08){
      const score = Math.abs(ratio - 1.01);
      if (score < bestScore){ bestScore = score; best = o; }
    }
  });
  return best;
}

/* ---------------------------- scaling planetario --------------------------- */
/** scala un globo rispetto al raggio terrestre “unitario” del tuo setup */
export function scaleToEarth(object3D, earthRadiusRatio=1){
  if (!object3D) return;
  const s = earthRadiusRatio; // ratio già normalizzato rispetto alla Terra
  object3D.scale.multiplyScalar(s);
}

// Camera che orbita attorno a un target guardandolo sempre.
// Uso tipico:
//   const orbit = createOrbitRig(engine);
//   orbit.setTarget(planet);
//   orbit.setRadius(unitRadius(planet) * 8);
//   orbit.setSpeed(0.12);           // rad/sec
//   orbit.setElevation(0.2);        // rad (positivo = dall'alto)
//   orbit.start();
export function createOrbitRig(engine){
  const { camera, controls, onTick } = engine;

  let enabled = false;
  let theta = 0;            // angolo azimutale (rad)
  let speed = 0.12;         // rad/sec
  let radius = 8;           // distanza dal centro
  let elev = 0.25;          // rad (0 = piano orizzontale, >0 = vista dall'alto)
  let targetObj = null;     // Object3D opzionale
  const target = new THREE.Vector3();
  const sph = new THREE.Spherical(radius, Math.max(1e-3, Math.PI/2 - elev), theta);
  let unbind = null;

  function _updateTarget(){
    if (targetObj && targetObj.isObject3D) targetObj.getWorldPosition(target);
  }

  function _tick(dt){
    if (!enabled) return;
    _updateTarget();
    theta += speed * (dt / 1000);
    sph.radius = radius;
    sph.theta  = theta;
    sph.phi    = Math.max(1e-3, Math.min(Math.PI-1e-3, Math.PI/2 - elev)); // clamp
    const v = new THREE.Vector3().setFromSpherical(sph);
    camera.position.copy(target).add(v);
    camera.lookAt(target);
    controls.target.copy(target);
  }

  function start(opts={}){
    if (opts.speed   != null) speed  = opts.speed;
    if (opts.radius  != null) radius = opts.radius;
    if (opts.elev    != null) elev   = opts.elev;
    if (opts.theta   != null) theta  = opts.theta;
    enabled = true;
    controls.enableRotate = false;     // evita conflitti con l’utente
    if (!unbind) unbind = onTick(_tick);
  }

  function stop(){
    enabled = false;
    controls.enableRotate = true;
    if (unbind){ unbind(); unbind = null; }
  }

  function setTarget(objOrVec3){
    if (objOrVec3?.isObject3D){
      targetObj = objOrVec3;
      objOrVec3.getWorldPosition(target);
    } else if (objOrVec3 instanceof THREE.Vector3){
      targetObj = null;
      target.copy(objOrVec3);
    }
    // se non hai impostato il raggio, usa la distanza attuale camera->target
    const d = camera.position.distanceTo(target);
    if (isFinite(d) && d > 0.01) radius = d;
  }

  return {
    start, stop, setTarget,
    setRadius: (r)=>{ radius = r; },
    setSpeed:  (s)=>{ speed  = s; },
    setElevation: (e)=>{ elev = e; },
    setTheta: (t)=>{ theta = t; },
    isRunning: ()=>enabled
  };
}
