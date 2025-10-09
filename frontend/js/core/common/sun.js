import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function makeRadialTexture({
  size = 512,
  innerColor = [255, 245, 230],
  innerAlpha = 1.0,
  outerColor = [255, 180, 120],
  outerAlpha = 0.0,
  feather = 0.9
} = {}) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  const inner = `rgba(${innerColor[0]},${innerColor[1]},${innerColor[2]},${innerAlpha})`;
  const midA  = Math.max(innerAlpha*0.6, outerAlpha);
  const mid   = `rgba(${outerColor[0]},${outerColor[1]},${outerColor[2]},${midA})`;
  const outer = `rgba(${outerColor[0]},${outerColor[1]},${outerColor[2]},${outerAlpha})`;
  g.addColorStop(0.0, inner);
  g.addColorStop(Math.min(0.999, feather), mid);
  g.addColorStop(1.0, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Crea il Sole condiviso (GLB + sprite disco/alone + luce + occluder).
 * Visivamente identico al tuo, con fix “anti-eclisse”.
 */
export async function createSun({
  scene, camera,                              // camera è usata come fallback
  position = new THREE.Vector3(),
  angularDiameter,                            // SUN.ANGULAR_DIAM
  modelUrl,                                   // URL GLB
  modelTargetSize = 20,                       // scala “20/max”, come prima
  spin = 0,                                   // rad/ms (es. SUN.ROT * TIME.SPEED)
  lightIntensity = 1.8,
  lightTint = [1.0, 0.95, 0.85],
  pulse = { enabled:true, amp:0.12, speed:0.6, haloAmp:0.10 },
}){
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);

  const light = new THREE.PointLight(0xffffff, lightIntensity, 0, 0);
  light.color.setRGB(lightTint[0], lightTint[1], lightTint[2]);
  light.position.copy(position);
  scene.add(light);

  // Sprite disco
  const discSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeRadialTexture({ size:512, innerColor:[255,245,230], innerAlpha:1.0, outerColor:[255,200,140], outerAlpha:0.0, feather:0.85 }),
    transparent: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  }));
  // FIX anti-eclisse: niente depth test/write e renderOrder alto
  discSprite.material.depthTest  = false;
  discSprite.material.depthWrite = false;
  discSprite.renderOrder = 1000;
  discSprite.position.z = 0.0001; // piccolo offset per sicurezza

  // Sprite alone
  const haloSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeRadialTexture({ size:1024, innerColor:[255,210,150], innerAlpha:0.6, outerColor:[255,180,120], outerAlpha:0.0, feather:0.98 }),
    transparent: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  }));
  haloSprite.material.depthTest  = false;
  haloSprite.material.depthWrite = false;
  haloSprite.material.opacity = 0.6;
  haloSprite.renderOrder = 999;

  group.add(discSprite, haloSprite);

  // Occluder: scrive solo nello z-buffer per tagliare le stelle dietro
  const occluder = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.MeshBasicMaterial({ colorWrite: false })
  );
  occluder.material.depthWrite = true;
  occluder.renderOrder = 8; // prima del GLB e molto prima degli sprite
  group.add(occluder);

  // GLB del Sole
  let model = null;
  const emissiveMats = [];
  await new Promise((resolve) => {
    new GLTFLoader().load(modelUrl, (g) => {
      model = g.scene;
      model.traverse(o => {
        if (!o.isMesh || !o.material) return;
        if ("emissiveIntensity" in o.material) {
          o.material.emissiveIntensity = 8.0;
          o.material.userData.baseEmissive = o.material.emissiveIntensity;
          emissiveMats.push(o.material);
        }
        o.material.depthWrite = false;
      });
      const box = new THREE.Box3().setFromObject(model);
      const max = box.getSize(new THREE.Vector3()).toArray().reduce((a,b)=>Math.max(a,b), 1);
      model.scale.multiplyScalar(modelTargetSize / max);
      model.renderOrder = 9;
      group.add(model);
      resolve();
    });
  });

  const _tmp = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function update(cameraNow, now, dt){
    // rotazione del gruppo (se richiesta)
    if (spin) group.rotateOnAxis(UP, spin * dt);

    // dimensione angolare costante per sprite + occluder
    group.getWorldPosition(_tmp);
    const cam = cameraNow || camera;
    const d = cam.position.distanceTo(_tmp);
    const size = 2 * d * Math.tan(angularDiameter * 0.5);

    discSprite.scale.set(size, size, 1);
    haloSprite.scale.set(size * 2.2, size * 2.2, 1);
    occluder.scale.setScalar(size * 0.55); // leggermente > del raggio disco (0.5*size)

    // pulsazione lieve (emissivo GLB + alone)
    if (pulse?.enabled){
      const t = now * 0.001;
      const k = 1.0 + pulse.amp * Math.sin(t * pulse.speed);
      emissiveMats.forEach(m => {
        const base = m.userData.baseEmissive ?? 1.0;
        m.emissiveIntensity = base * k;
      });
      const haloK = 1.0 + (pulse.haloAmp ?? 0.1) * Math.sin(t * (pulse.speed * 0.8));
      haloSprite.material.opacity = 0.6 * haloK;
    }
  }

  function setPosition(v3){
    group.position.copy(v3);
    light.position.copy(v3);
  }

  function dispose(){
    [group].forEach(obj => {
      if (!obj) return;
      obj.traverse?.(n => {
        if (n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach(m => m.map?.dispose?.());
          mats.forEach(m => m.dispose?.());
        }
        n.geometry?.dispose?.();
      });
      obj.parent && obj.parent.remove(obj);
    });
    light.parent && light.parent.remove(light);
  }

  return { group, light, model, discSprite, haloSprite, occluder, update, setPosition, dispose };
}
