import * as THREE from "three";

function makeMilkyWayDome(path, radius=4000){
  const tex = new THREE.TextureLoader().load(path);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius,64,64),
    new THREE.MeshBasicMaterial({ map:tex, side:THREE.BackSide, depthWrite:false })
  );
}
function makeStarsLayer(n,radius,size,opacity){
  const pos = new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const z=Math.random()*2-1, phi=Math.random()*Math.PI*2, r=Math.sqrt(1-z*z);
    const x=r*Math.cos(phi), y=r*Math.sin(phi);
    pos[i*3]=x*radius; pos[i*3+1]=z*radius; pos[i*3+2]=y*radius;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({ color:0xffffff, size, opacity, transparent:true, sizeAttenuation:true, depthWrite:false });
  return new THREE.Points(geo,mat);
}

export function createSky({ scene, camera, textureUrl, radius=4000, twinkle=true }){
  const sky   = makeMilkyWayDome(textureUrl, radius);
  scene.add(sky);

  const stars = new THREE.Group();
  const s1 = makeStarsLayer(24000, radius-5, 0.6, 0.70);
  const s2 = makeStarsLayer(12000, radius-2, 1.1, 0.80);
  const s3 = makeStarsLayer( 3000, radius+2, 1.8, 0.95);
  stars.add(s1,s2,s3);
  scene.add(stars);

  function update(now){
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    if (!twinkle) return;
    const t = now * 0.001;
    s1.material.opacity = 0.68 + 0.08 * Math.sin(t * 0.9);
    s2.material.opacity = 0.78 + 0.08 * Math.sin(t * 1.1 + 1.7);
    s3.material.opacity = 0.90 + 0.07 * Math.sin(t * 0.8 + 3.2);
  }

  function dispose(){
    [sky, stars].forEach(obj=>{
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

  return { sky, stars, update, dispose };
}
