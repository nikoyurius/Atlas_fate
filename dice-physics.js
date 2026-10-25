import * as THREE from './vendor/three.module.js';
import * as CANNON from './vendor/cannon-es.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';

// Net order: front, back, right, left, top, bottom. Three material order: X, Y, Z.
export const FACE_NORMALS=[[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]];
const MATERIAL_FACES=[2,3,4,5,0,1];
export function upperFace(q){let index=0,alignment=-Infinity;FACE_NORMALS.forEach((a,i)=>{const n=q.vmult(new CANNON.Vec3(...a));if(n.y>alignment){alignment=n.y;index=i}});return {index,alignment};}
export function nudgeCocked(bodies){const cocked=bodies.filter(b=>upperFace(b.quaternion).alignment<.98);for(const b of cocked){const i=bodies.indexOf(b);b.wakeUp();b.position.set((i-1.5)*1.1,3.5+i*.3,0);b.velocity.set(0,-1,0);b.angularVelocity.set(5,-7,4);b.aabbNeedsUpdate=true}return cocked.length}
const random=()=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return n[0]/4294967296};
export function makeWorld(halfWidth=4.5,halfDepth=2.4,rng=random){
 const world=new CANNON.World({gravity:new CANNON.Vec3(0,-18,0),allowSleep:true});
 world.solver.iterations=24;world.solver.tolerance=.0001;
 world.defaultContactMaterial.friction=.45;world.defaultContactMaterial.restitution=.28;const dieMaterial=new CANNON.Material({friction:.65}),floorMaterial=new CANNON.Material({friction:.65}),wallMaterial=new CANNON.Material({friction:0});
 const plane=(x,y,z,rx,ry,rz)=>{const b=new CANNON.Body({mass:0,shape:new CANNON.Plane(),material:y===0&&rx===-Math.PI/2?floorMaterial:wallMaterial});b.position.set(x,y,z);b.quaternion.setFromEuler(rx,ry,rz);world.addBody(b)};
 plane(0,0,0,-Math.PI/2,0,0);plane(-halfWidth,0,0,0,Math.PI/2,0);plane(halfWidth,0,0,0,-Math.PI/2,0);plane(0,0,-halfDepth,0,0,0);plane(0,0,halfDepth,0,Math.PI,0);
 const bodies=Array.from({length:4},(_,i)=>{const b=new CANNON.Body({mass:1,material:dieMaterial,shape:new CANNON.Box(new CANNON.Vec3(.5,.5,.5)),linearDamping:.3,angularDamping:.4,allowSleep:true,sleepSpeedLimit:.25,sleepTimeLimit:.3});
 b.position.set((i-1.5)*1.1,4.5+rng()*1.7,-.5+rng());b.quaternion.setFromEuler(rng()*Math.PI*2,rng()*Math.PI*2,rng()*Math.PI*2);
 b.velocity.set((rng()-.5)*3,-1-rng(),(rng()-.5)*3);b.angularVelocity.set((rng()-.5)*18,(rng()-.5)*18,(rng()-.5)*18);world.addBody(b);return b});
 return {world,bodies};
}
function image(url){return new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>no(Error('Не удалось прочитать изображение грани'));im.src=url})}
function faceTexture(index,img){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,256,256);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#e3e4f1');x.fillStyle=g;x.fillRect(0,0,256,256);if(img)x.drawImage(img,0,0,256,256);else{x.fillStyle='#31314b';x.lineWidth=15;x.lineCap='round';if([0,3].includes(index)){x.beginPath();x.moveTo(80,128);x.lineTo(176,128);x.moveTo(128,80);x.lineTo(128,176);x.strokeStyle='#31314b';x.stroke()}else if([1,4].includes(index)){x.beginPath();x.moveTo(80,128);x.lineTo(176,128);x.strokeStyle='#31314b';x.stroke()}}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
export class DiceStage{
 constructor(){
  this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));this.renderer.setClearColor(0,0);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;
  this.canvas=this.renderer.domElement;this.canvas.id='physics-dice';this.canvas.setAttribute('aria-label','3D кубики с физикой');this.canvas.setAttribute('role','img');this.canvas.hidden=true;document.body.append(this.canvas);this.epoch=0;this.frame=0;this.resize=()=>this.fit();window.addEventListener('resize',this.resize);
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.clear(Error('Графический контекст потерян. Повторите бросок.'))});
 }
 fit(){if(!this.scene)return;const area=this.area();this.rect=area;Object.assign(this.canvas.style,{left:area.x+'px',top:area.y+'px',width:area.w+'px',height:area.h+'px'});this.renderer.setSize(area.w,area.h,false);const aspect=area.w/area.h,ww=Math.max(this.halfWidth*2+1.6,(this.halfDepth*1.6+2)*aspect,area.w/82);this.camera.left=-ww/2;this.camera.right=ww/2;this.camera.top=ww/aspect/2;this.camera.bottom=-ww/aspect/2;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera)}
 async roll({faces,area}){
  this.clear();const epoch=this.epoch;this.area=area;const rect=area();this.halfWidth=Math.max(2.45,Math.min(5,rect.w/165));this.halfDepth=2.1;
  const imgs=faces?await Promise.all(faces.map(image)):null;if(epoch!==this.epoch)throw Error('Бросок отменён');
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,100);this.camera.position.set(0,11,9);this.camera.lookAt(0,0,0);
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x8b91a8,2.7));const light=new THREE.DirectionalLight(0xfff7ee,3.4);light.position.set(-4,12,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});light.shadow.bias=-.0003;light.shadow.normalBias=.025;this.scene.add(light);
  this.textures=Array.from({length:6},(_,i)=>faceTexture(i,imgs?.[i]));this.materials=MATERIAL_FACES.map(i=>new THREE.MeshStandardMaterial({map:this.textures[i],roughness:.36,metalness:.03}));this.geometry=new RoundedBoxGeometry(1,1,1,3,.065);
  const shadowMat=new THREE.ShadowMaterial({opacity:.19}),shadowGeo=new THREE.PlaneGeometry(40,40),floor=new THREE.Mesh(shadowGeo,shadowMat);floor.rotation.x=-Math.PI/2;floor.position.y=-.008;floor.receiveShadow=true;this.scene.add(floor);this.extra=[shadowMat,shadowGeo];
  const {world,bodies}=makeWorld(this.halfWidth,this.halfDepth);this.world=world;this.bodies=bodies;this.meshes=bodies.map(()=>{const m=new THREE.Mesh(this.geometry,this.materials);m.castShadow=true;m.receiveShadow=true;this.scene.add(m);return m});this.canvas.hidden=false;this.fit();
  return new Promise((resolve,reject)=>{this.pending={reject};let previous=performance.now(),stable=0,elapsed=0,nudges=0;
   const tick=now=>{if(epoch!==this.epoch)return;const dt=Math.min(.05,Math.max(.001,(now-previous)/1000));previous=now;elapsed+=dt;world.step(1/120,dt,8);
    bodies.forEach((b,i)=>{this.meshes[i].position.copy(b.position);this.meshes[i].quaternion.copy(b.quaternion)});this.renderer.render(this.scene,this.camera);
    const quiet=bodies.every(b=>b.sleepState===CANNON.Body.SLEEPING||(b.velocity.length()<.2&&b.angularVelocity.length()<.2));stable=quiet?stable+dt:0;
    if(stable>.35){const result=bodies.map(b=>upperFace(b.quaternion));const cocked=result.map((r,i)=>r.alignment<.98?i:-1).filter(i=>i>=0);
     if(cocked.length&&nudges<3){nudges++;stable=0;nudgeCocked(bodies)}
     else if(!cocked.length){bodies.forEach(b=>b.sleep());this.pending=null;this.canvas.dataset.state='settled';this.canvas.dataset.faces=result.map(r=>r.index).join(',');resolve({indices:result.map(r=>r.index)});return}
    }
    if(elapsed>12){this.pending=null;this.clear();reject(Error('Кубики не остановились ровно. Повторите бросок.'));return}
    this.frame=requestAnimationFrame(tick);
   };this.canvas.dataset.state='falling';this.frame=requestAnimationFrame(tick);
  });
 }
 clear(error){this.epoch++;cancelAnimationFrame(this.frame);if(this.pending){this.pending.reject(error||Error('Бросок отменён'));this.pending=null}if(this.canvas)this.canvas.hidden=true;this.geometry?.dispose();this.materials?.forEach(m=>m.dispose());this.textures?.forEach(t=>t.dispose());this.extra?.forEach(x=>x.dispose());this.geometry=null;this.materials=[];this.textures=[];this.extra=[];this.scene=null;this.world=null;this.bodies=[];this.meshes=[];if(this.canvas){delete this.canvas.dataset.faces;delete this.canvas.dataset.state}this.renderer?.renderLists.dispose();}
}
