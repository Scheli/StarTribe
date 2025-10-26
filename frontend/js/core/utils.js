import * as THREE from "three";

/* ----------------------------- base numerica ----------------------------- */
export const UP_AXIS = new THREE.Vector3(0, 1, 0);
export function wrap01(x){ x = x % 1; return x < 0 ? x + 1 : x; }

/* -------------------------- misure / posizionamento ---------------------- */
export function unitRadius(obj){
  if (!obj?.isObject3D) return 1;
  const g = obj.geometry;
  if (g && !g.boundingSphere) g.computeBoundingSphere?.();
  const r = g?.boundingSphere?.radius || 1;
  const s = obj.getWorldScale(new THREE.Vector3());
  return r * Math.max(s.x, s.y, s.z);
}

export function worldPosOf(obj, out = new THREE.Vector3()){
  obj.updateMatrixWorld(true);
  return obj.getWorldPosition(out);
}

/* --------------------------- texture & materiali ------------------------- */
export async function loadBitmap(path){
  const r = await fetch(path);
  const b = await r.blob();
  return await createImageBitmap(b, { colorSpaceConversion: "default" });
}

export function tuneTex(tex){
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
}

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
        if ('encoding' in m.map)   m.map.encoding   = THREE.sRGBEncoding; 
        m.map.wrapS = THREE.RepeatWrapping;
        m.map.wrapT = THREE.ClampToEdgeWrapping;
        m.map.needsUpdate = true;
      }
      m.needsUpdate = true;
    }
  });
}

export function polarFixPlanetMaterial(
  mat,
  { poleWidth=0.12, normalStrength=1.0, roughStrength=1.0, roughTarget=1.0 } = {}
){
  if (!mat || mat.userData?._polarFix) return;

  mat.onBeforeCompile = (shader)=>{
    shader.uniforms.uPoleW           = { value:poleWidth };
    shader.uniforms.uPoleNormal      = { value:normalStrength };
    shader.uniforms.uPoleRough       = { value:roughStrength };
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

    (mat.userData ||= {})._polarFix = {
      uPoleW: shader.uniforms.uPoleW,
      uPoleNormal: shader.uniforms.uPoleNormal,
      uPoleRough: shader.uniforms.uPoleRough,
      uPoleRoughTarget: shader.uniforms.uPoleRoughTarget
    };
  };
  mat.needsUpdate = true;
}

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

export function findCloudShellBySize(root, planetMeshLike){
  if (!root || !planetMeshLike?.geometry) return null;
  const g = planetMeshLike.geometry;
  if (g && !g.boundingSphere) g.computeBoundingSphere();
  const R = g?.boundingSphere?.radius || 1;
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
export function scaleToEarth(object3D, earthRadiusRatio=1){
  if (!object3D) return;
  object3D.scale.multiplyScalar(earthRadiusRatio);
}

/* ------------------------------ orbit rig camera --------------------------- */
export function createOrbitRig(engine){
  const { camera, controls, onTick } = engine;

  let enabled = false;
  let theta = 0;            // azimut (rad)
  let speed = 0.12;         // rad/sec
  let radius = 8;           // distanza
  let elev = 0.25;          // elevazione (rad, >0 = dall'alto)
  let targetObj = null;     // Object3D (opzionale)
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
    sph.phi    = Math.max(1e-3, Math.min(Math.PI-1e-3, Math.PI/2 - elev));
    const v = new THREE.Vector3().setFromSpherical(sph);
    camera.position.copy(target).add(v);
    camera.lookAt(target);
    controls.target.copy(target);
  }

  function start(opts={}){
    if (opts.speed  != null) speed  = opts.speed;
    if (opts.radius != null) radius = opts.radius;
    if (opts.elev   != null) elev   = opts.elev;
    if (opts.theta  != null) theta  = opts.theta;
    enabled = true;
    controls.enableRotate = false;
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
    const d = camera.position.distanceTo(target);
    if (isFinite(d) && d > 0.01) radius = d;
  }

  function matchCameraToCurrent(){
    _updateTarget();
    const v = new THREE.Vector3().copy(camera.position).sub(target);
    const sphNow = new THREE.Spherical().setFromVector3(v);
    radius = sphNow.radius;
    theta  = sphNow.theta;
    elev   = Math.PI/2 - sphNow.phi;
  }

  function getTarget(){ return target.clone(); }

  return {
    start, stop, setTarget,
    setRadius: (r)=>{ radius = r; },
    setSpeed:  (s)=>{ speed  = s; },
    setElevation: (e)=>{ elev = e; },
    setTheta: (t)=>{ theta = t; },
    isRunning: ()=>enabled,
    matchCameraToCurrent,
    getTarget,
  };
}

export function radiusForFrameFill(camera, object, {
  fill = 0.6, padding = 1.05, minDist = 0.01, maxDist = 1e6
} = {}){
  const R = (typeof object === "number") ? object : unitRadius(object);
  const halfFov = THREE.MathUtils.degToRad(camera.fov || 50) * 0.5;
  const alpha = Math.atan( Math.max(0.01, Math.min(0.99, fill)) * Math.tan(halfFov) );
  let d = (R / Math.sin(alpha)) * padding;
  if (!Number.isFinite(d) || d <= 0) d = R * 4;
  return THREE.MathUtils.clamp(d, minDist, maxDist);
}

export const FocusBus = {
  _subs: new Set(),
  on(fn){ this._subs.add(fn); return () => this._subs.delete(fn); },
  emit(evt){ for (const fn of this._subs) { try { fn(evt); } catch {} } }
};


export function smoothFocusAuto(engine, object, {
  fill = 0.6,
  padding = 1.05,
  dur = 1.0,
  ease = (t)=> t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2,
  minDist = 0.01, maxDist = 1e6,
} = {}) {
  const { camera, controls, onTick } = engine;
  if (!object) return ()=>{};

  object.updateMatrixWorld(true);
  const center = object.getWorldPosition(new THREE.Vector3());
  const dist   = radiusForFrameFill(camera, object, { fill, padding, minDist, maxDist });

  let dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() < 1e-6) dir.set(0,0,1);
  dir.setLength(dist);

  const fromPos = camera.position.clone();
  const toPos   = center.clone().add(dir);
  const fromTgt = controls.target.clone();
  const toTgt   = center.clone();

  const startedAt = performance.now();
  let startedEventSent = false;
  function emitStartOnce(){
    if (startedEventSent) return;
    startedEventSent = true;
    FocusBus.emit({ type: "focusStart", dur, object, startedAt });
  }

  let t = 0;
  const unbind = onTick((dt) => {
    t += dt / 1000;
    const a = Math.min(1, t / dur);
    const k = ease(a);
    camera.position.lerpVectors(fromPos, toPos, k);
    controls.target.lerpVectors(fromTgt, toTgt, k);

    if (!startedEventSent) emitStartOnce();

    if (a >= 1) {
      unbind();
      FocusBus.emit({
        type: "focusEnd",
        dur,
        object,
        startedAt,
        endedAt: performance.now()
      });
    }
  });

  return unbind;
}

export function extendOrbitRigWithAuto(rig, engine){
  const { camera, controls } = engine;

  rig.matchCameraToCurrent = function(){
    const tgt = rig.getTarget?.() ?? controls.target;
    const v = new THREE.Vector3().copy(camera.position).sub(tgt);
    const sph = new THREE.Spherical().setFromVector3(v);
    rig.setRadius?.(sph.radius);
    rig.setTheta?.(sph.theta);
    rig.setElevation?.(Math.PI/2 - sph.phi);
  };

  rig.setRadiusAuto = function(object, opts={}){
    const dist = radiusForFrameFill(
      camera,
      object,
      { fill: opts.fill ?? 0.6, padding: opts.padding ?? 1.05,
        minDist: opts.minDist ?? 0.01, maxDist: opts.maxDist ?? 1e6 }
    );
    rig.setRadius?.(dist);
  };

  return rig;
}
