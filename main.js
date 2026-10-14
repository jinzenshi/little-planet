import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const R=5, mobile=matchMedia('(pointer:coarse)').matches;
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x2a1840,0.008);
const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,0.1,500);

// toon gradient
const gt=new THREE.DataTexture(new Uint8Array([90,90,90,255,170,170,170,255,235,235,235,255,255,255,255,255]),4,1);
gt.minFilter=gt.magFilter=THREE.NearestFilter;gt.needsUpdate=true;
const toon=(c,o={})=>new THREE.MeshToonMaterial({color:c,gradientMap:gt,...o});

// sky
const sky=new THREE.Mesh(new THREE.SphereGeometry(200,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
 uniforms:{cu:{value:new THREE.Vector3(0,1,0)}},vertexShader:`varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform vec3 cu;varying vec3 v;void main(){float h=dot(v,cu);vec3 a=vec3(.95,.55,.38),b=vec3(.62,.28,.45),c=vec3(.16,.09,.30),d=vec3(.02,.015,.07);
 vec3 col=h<-.15?mix(b*.5,a,smoothstep(-.6,-.15,h)):h<.05?mix(a,b,smoothstep(-.15,.05,h)):h<.35?mix(b,c,smoothstep(.05,.35,h)):mix(c,d,smoothstep(.35,.9,h));
 float sun=pow(max(dot(v,normalize(vec3(-.6,.05,-.8))),0.),60.);col+=vec3(1.,.75,.5)*sun*.6+vec3(1.,.5,.4)*pow(max(dot(v,normalize(vec3(-.6,.05,-.8))),0.),6.)*.15;gl_FragColor=vec4(col,1.);}`}));
scene.add(sky);

// stars
{const n=2500,p=new Float32Array(n*3),s=new Float32Array(n),ph=new Float32Array(n);
 for(let i=0;i<n;i++){const v=new THREE.Vector3().randomDirection();if(v.y<-.1)v.y=-v.y;v.multiplyScalar(150+Math.random()*30);p.set([v.x,v.y,v.z],i*3);s[i]=Math.random()**3*3+.6;ph[i]=Math.random()*6.28;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('sz',new THREE.BufferAttribute(s,1));g.setAttribute('ph',new THREE.BufferAttribute(ph,1));
 var starMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,uniforms:{t:{value:0}},
 vertexShader:`attribute float sz,ph;uniform float t;varying float a;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);a=.5+.5*sin(t*1.7+ph*3.);a=a*a*smoothstep(.0,.3,normalize(position).y+.1);gl_PointSize=sz*(1.+a)*2.;gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`varying float a;void main(){float d=length(gl_PointCoord-.5);float g=smoothstep(.5,0.,d);gl_FragColor=vec4(vec3(1.,.93,.8)*g*(.3+a*1.4),g);}`});
 scene.add(new THREE.Points(g,starMat));}

// lights
scene.add(new THREE.HemisphereLight(0xffc9a8,0x3a2550,.8));
const sunL=new THREE.DirectionalLight(0xffd2a0,2.6);sunL.castShadow=true;sunL.shadow.mapSize.set(2048,2048);
Object.assign(sunL.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:40});sunL.shadow.bias=-0.0008;sunL.shadow.normalBias=.03;
scene.add(sunL,sunL.target);
const rim=new THREE.DirectionalLight(0x9a8cff,.9);rim.position.set(6,4,8);scene.add(rim);

// planet
const world=new THREE.Group();scene.add(world);
{const g=new THREE.IcosahedronGeometry(R,24),pos=g.attributes.position,col=[],v=new THREE.Vector3();
 for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);const n=Math.sin(v.x*1.3)*Math.sin(v.y*1.1+1)*Math.sin(v.z*1.4+2);
  v.multiplyScalar(1+n*.012);pos.setXYZ(i,v.x,v.y,v.z);const c=new THREE.Color(0x7fb77e).lerp(new THREE.Color(0xc9d87a),.5+n*1.5);col.push(c.r,c.g,c.b);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
 const m=new THREE.Mesh(g,toon(0xffffff,{vertexColors:true}));m.receiveShadow=true;world.add(m);
 // halo
 world.add(new THREE.Mesh(new THREE.SphereGeometry(R*1.12,48,24),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec3 n;varying vec3 vd;void main(){n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vd=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying vec3 n;varying vec3 vd;void main(){float f=pow(1.-abs(dot(n,vd)),3.);gl_FragColor=vec4(vec3(1.,.7,.55)*f*.35,f*.5);}`})));}

const up0=new THREE.Vector3(0,1,0);
function place(o,dir,h=0,spin=0){dir=dir.clone().normalize();o.position.copy(dir).multiplyScalar(R+h);o.quaternion.setFromUnitVectors(up0,dir);o.rotateY(spin);world.add(o);o.userData.dir=dir;return o;}
const sh=m=>{m.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});return m;};

// grass tufts & flowers
{const gg=new THREE.ConeGeometry(.05,.25,4),gm=toon(0x5f9a5c),fg=new THREE.IcosahedronGeometry(.06,0);
 const im=new THREE.InstancedMesh(gg,gm,500),fl=new THREE.InstancedMesh(fg,toon(0xffffff),80),d=new THREE.Object3D(),q=new THREE.Quaternion();
 for(let i=0;i<500;i++){const v=new THREE.Vector3().randomDirection();d.position.copy(v).multiplyScalar(R+.08);d.quaternion.setFromUnitVectors(up0,v);d.rotateZ((Math.random()-.5)*.5);d.scale.setScalar(.6+Math.random()*.8);d.updateMatrix();im.setMatrixAt(i,d.matrix);}
 const fc=[0xffe9a8,0xffb3c6,0xd9c9ff,0xffffff];
 for(let i=0;i<80;i++){const v=new THREE.Vector3().randomDirection();d.position.copy(v).multiplyScalar(R+.05);d.scale.setScalar(1);d.updateMatrix();fl.setMatrixAt(i,d.matrix);fl.setColorAt(i,new THREE.Color(fc[i%4]));}
 im.castShadow=true;world.add(im,fl);}

const obstacles=[];
// rose + dome
const roseDir=new THREE.Vector3(.35,1,.7);
const rose=new THREE.Group();
{const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,.7,6),toon(0x3f7a45));stem.position.y=.35;rose.add(stem);
 const leaf=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),toon(0x4f9a52));leaf.scale.set(1,.25,.5);leaf.position.set(.09,.3,0);leaf.rotation.z=.5;rose.add(leaf);
 const l2=leaf.clone();l2.position.set(-.09,.42,0);l2.rotation.z=-.5;rose.add(l2);
 const bloom=new THREE.Group();bloom.position.y=.75;rose.add(bloom);
 const pm=toon(0xe0334f,{emissive:0x5a0a18});
 for(let k=0;k<3;k++)for(let i=0;i<5;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.11-k*.025,10,8,0,Math.PI),pm);p.scale.set(1,1.2,.5);
  const a=i/5*Math.PI*2+k*.6;p.position.set(Math.cos(a)*(.07-k*.025),k*.03,Math.sin(a)*(.07-k*.025));p.rotation.y=-a+Math.PI/2;p.rotation.x=-.3+k*.25;bloom.add(p);}
 const glow=new THREE.PointLight(0xff6f88,2.5,3);glow.position.y=.8;rose.add(glow);
 const dome=new THREE.Mesh(new THREE.SphereGeometry(.5,32,20,0,Math.PI*2,0,Math.PI/2),new THREE.MeshPhysicalMaterial({color:0xffffff,transmission:.95,roughness:.05,thickness:.1,transparent:true,opacity:.35,ior:1.3,clearcoat:1}));
 dome.scale.y=2;dome.position.y=.05;rose.add(dome);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.5,.03,8,32),toon(0xd9b46a,{emissive:0x332200}));ring.rotation.x=Math.PI/2;ring.position.y=.05;rose.add(ring);
 const knob=new THREE.Mesh(new THREE.SphereGeometry(.05,8,8),toon(0xd9b46a));knob.position.y=1.08;rose.add(knob);
 sh(rose);dome.castShadow=false;rose.userData.bloom=bloom;}
place(rose,roseDir);obstacles.push([roseDir.clone().normalize(),.12]);

// volcanoes
const smokeSrc=[];
function volcano(dir,s,active){const g=new THREE.Group();
 const c=new THREE.Mesh(new THREE.CylinderGeometry(.22*s,.75*s,.7*s,10,1,true),toon(0x8a6a64));c.position.y=.3*s;g.add(c);
 const top=new THREE.Mesh(new THREE.CircleGeometry(.22*s,10),new THREE.MeshBasicMaterial({color:active?0xff7a30:0x3a2a2a}));top.rotation.x=-Math.PI/2;top.position.y=.65*s;g.add(top);
 sh(g);place(g,dir);obstacles.push([dir.clone().normalize(),.11*s]);if(active)smokeSrc.push(g);return g;}
volcano(new THREE.Vector3(-.8,.6,.3),1.2,true);volcano(new THREE.Vector3(-.95,.25,.6),.8,true);volcano(new THREE.Vector3(.2,-.2,-1),1,false);

// smoke particles
const smokeTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const puffs=[];for(const v of smokeSrc)for(let i=0;i<14;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,color:0xe8d8e0,transparent:true,depthWrite:false,opacity:0}));v.add(sp);puffs.push({sp,t:i/14,s:v===smokeSrc[0]?1:.7});}

// baobab sprouts
function baobab(dir,s){const g=new THREE.Group();const t=new THREE.Mesh(new THREE.CylinderGeometry(.04*s,.08*s,.5*s,6),toon(0x7a5a3a));t.position.y=.25*s;g.add(t);
 for(let i=0;i<3;i++){const l=new THREE.Mesh(new THREE.IcosahedronGeometry(.16*s,0),toon(0x3e8a4a));l.position.set(Math.cos(i*2.1)*.13*s,.52*s+i*.04*s,Math.sin(i*2.1)*.13*s);l.scale.y=.6;g.add(l);}
 sh(g);place(g,dir,0,Math.random()*6);obstacles.push([dir.clone().normalize(),.06*s]);}
baobab(new THREE.Vector3(.9,.4,-.4),1.4);baobab(new THREE.Vector3(.7,-.5,.6),.9);

// lamp post
const lamp=new THREE.Group();let lampLight;
{const m=toon(0x2d2a3a);const p=new THREE.Mesh(new THREE.CylinderGeometry(.04,.07,1.6,8),m);p.position.y=.8;lamp.add(p);
 const b=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,.08,8),m);b.position.y=.04;lamp.add(b);
 const cap=new THREE.Mesh(new THREE.ConeGeometry(.18,.16,6),m);cap.position.y=1.95;lamp.add(cap);
 const bulb=new THREE.Mesh(new THREE.SphereGeometry(.11,16,12),new THREE.MeshBasicMaterial({color:0xffd27a}));bulb.position.y=1.76;lamp.add(bulb);
 const cage=new THREE.Mesh(new THREE.CylinderGeometry(.15,.11,.28,6,1,true),new THREE.MeshBasicMaterial({color:0x2d2a3a,wireframe:true}));cage.position.y=1.76;lamp.add(cage);
 lampLight=new THREE.PointLight(0xffb85c,4,5,1.5);lampLight.position.y=1.76;lamp.add(lampLight);sh(lamp);bulb.castShadow=false;cage.castShadow=false;}
const lampDir=new THREE.Vector3(-.3,.9,-.7);place(lamp,lampDir);obstacles.push([lampDir.clone().normalize(),.05]);

// little prince
const prince=new THREE.Group(),body=new THREE.Group();prince.add(body);
let scarf=[],legs=[];
{const green=toon(0x4fa37a),skin=toon(0xffe0c4),gold=toon(0xf3c14b,{emissive:0x4a3000}),dark=toon(0x2b2340);
 const coat=new THREE.Mesh(new THREE.CylinderGeometry(.16,.3,.5,10),green);coat.position.y=.45;body.add(coat);
 const belt=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.05,10),toon(0xf2e6c8));belt.position.y=.42;body.add(belt);
 for(const x of[-.08,.08]){const l=new THREE.Mesh(new THREE.CylinderGeometry(.05,.045,.25,6),toon(0xd8cfe0));l.position.set(x,.13,0);body.add(l);
  const boot=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),dark);boot.scale.set(1,.6,1.4);boot.position.set(0,-.12,-.02);l.add(boot);legs.push(l);}
 const head=new THREE.Mesh(new THREE.SphereGeometry(.2,20,16),skin);head.position.y=.88;body.add(head);
 const hair=new THREE.Group();hair.position.y=.95;body.add(hair);
 for(let i=0;i<14;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(.06,.24,5),gold);const a=i/14*Math.PI*2;
  c.position.set(Math.cos(a)*.15,.05+Math.random()*.04,Math.sin(a)*.15);c.lookAt(Math.cos(a)*2,.9,Math.sin(a)*2);c.rotateX(Math.PI/2);hair.add(c);}
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.19,16,10,0,Math.PI*2,0,Math.PI/2),gold);cap.position.y=.0;hair.add(cap);
 for(const x of[-.07,.07]){const e=new THREE.Mesh(new THREE.SphereGeometry(.022,8,6),dark);e.position.set(x,.9,-.18);body.add(e);
  const ch=new THREE.Mesh(new THREE.SphereGeometry(.03,8,6),new THREE.MeshBasicMaterial({color:0xff9a9a,transparent:true,opacity:.6}));ch.position.set(x*1.5,.84,-.17);body.add(ch);}
 const sm=toon(0xfff3c4,{emissive:0x332a00});
 const knot=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),sm);knot.position.set(0,.7,-.12);body.add(knot);
 let parent=new THREE.Group();parent.position.set(.05,.72,.08);body.add(parent);
 for(let i=0;i<7;i++){const s=new THREE.Mesh(new THREE.BoxGeometry(.11-i*.008,.025,.13),sm);s.position.z=.065;const j=new THREE.Group();j.add(s);parent.add(j);scarf.push(j);
  const nxt=new THREE.Group();nxt.position.z=.13;j.add(nxt);parent=nxt;}
 sh(prince);}
world.add(prince);

// state
const P={pos:new THREE.Vector3(0,1,.25).normalize(),fwd:new THREE.Vector3(0,0,-1),vel:0};
P.fwd.sub(P.pos.clone().multiplyScalar(P.fwd.dot(P.pos))).normalize();
if(new URLSearchParams(location.search).has('turn'))P.fwd.applyAxisAngle(P.pos,+new URLSearchParams(location.search).get('turn'));
const keys={};addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=1;hideTitle();});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=0);
let drag=null,dragV={x:0,y:0};
renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,t:performance.now(),sx:e.clientX,sy:e.clientY};clickTest(e);});
addEventListener('pointermove',e=>{if(!drag)return;dragV.x=THREE.MathUtils.clamp((e.clientX-drag.sx)/80,-1,1);dragV.y=THREE.MathUtils.clamp((e.clientY-drag.sy)/80,-1,1);if(Math.hypot(dragV.x,dragV.y)>.2)hideTitle();});
addEventListener('pointerup',()=>{drag=null;dragV.x=dragV.y=0;});
let titleHidden=false;function hideTitle(){if(titleHidden)return;titleHidden=true;setTimeout(()=>document.getElementById('title').style.opacity=0,800);}

// dialogue
const lines=[['“你在你的玫瑰身上花费的时间，','使她变得如此重要。”'],['“只有用心才能看清，','真正重要的东西，眼睛是看不见的。”'],['“如果你爱上一朵花，她长在一颗星星上，','那么夜里仰望星空，满天的星星都会开花。”'],['“你永远要对你驯服的东西负责。','你要对你的玫瑰负责。”']];
let li=0,shown=false;const lineEl=document.getElementById('line');
function showLine(){lineEl.innerHTML=lines[li][0]+'<br>'+lines[li][1]+'<small>— 小王子</small>';lineEl.classList.add('show');shown=true;}
function hideLine(){if(shown){lineEl.classList.remove('show');shown=false;li=(li+1)%lines.length;}}
const ray=new THREE.Raycaster();
function clickTest(e){ray.setFromCamera({x:e.clientX/innerWidth*2-1,y:-e.clientY/innerHeight*2+1},camera);if(ray.intersectObject(rose,true).length){showLine();forced=performance.now();}}
let forced=0;

// sound (procedural pad)
let actx,gain;const sndBtn=document.getElementById('snd');
sndBtn.onclick=()=>{if(!actx){actx=new AudioContext();gain=actx.createGain();gain.gain.value=0;gain.connect(actx.destination);
 const f=actx.createBiquadFilter();f.type='lowpass';f.frequency.value=900;f.connect(gain);
 [220,277.18,329.63,415.3].forEach((fr,i)=>{const o=actx.createOscillator();o.type='sine';o.frequency.value=fr/2;const g=actx.createGain();g.gain.value=.06;
  const l=actx.createOscillator();l.frequency.value=.07+i*.03;const lg=actx.createGain();lg.gain.value=.05;l.connect(lg);lg.connect(g.gain);l.start();o.connect(g);g.connect(f);o.start();});}
 const on=gain.gain.value<.1;gain.gain.setTargetAtTime(on?.5:0,actx.currentTime,.8);sndBtn.textContent=on?'♪ 声音：开':'♪ 声音：关';};

// post
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloomP=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.45,.5,.9);composer.addPass(bloomP);composer.addPass(new OutputPass());
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});

const camPos=new THREE.Vector3(),camUp=new THREE.Vector3(0,1,0),tmp=new THREE.Vector3(),m4=new THREE.Matrix4();
let walkT=0,first=true;const clock=new THREE.Clock();
window.__goRose=()=>{P.pos.copy(rose.userData.dir).applyAxisAngle(new THREE.Vector3(1,0,0),.22).normalize();P.fwd.copy(rose.userData.dir).sub(P.pos).normalize();first=true;};window.__sim=(n,w,a)=>{for(let i=0;i<n;i++)step(1/60,w,a);};
function step(dt,W,A){
 const up=P.pos;
 P.fwd.applyAxisAngle(up,A*2.2*dt);
 const target=W*2.4;P.vel+= (target-P.vel)*Math.min(1,dt*6);
 const axis=tmp.crossVectors(up,P.fwd).normalize(),ang=P.vel*dt/R;
 const np=up.clone().applyAxisAngle(axis,ang);
 let ok=true;for(const[d,r]of obstacles)if(np.angleTo(d)<r+.05&&np.angleTo(d)<up.angleTo(d))ok=false;
 if(ok){P.pos.copy(np);P.fwd.applyAxisAngle(axis,ang);}else P.vel*=.3;
 P.fwd.sub(tmp.copy(P.pos).multiplyScalar(P.fwd.dot(P.pos))).normalize();
 walkT+=Math.abs(P.vel)*dt*3.2;}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
 let W=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0)-dragV.y,A=(keys.a||keys.arrowleft?1:0)-(keys.d||keys.arrowright?1:0)-dragV.x;
 W=THREE.MathUtils.clamp(W,-1,1);A=THREE.MathUtils.clamp(A,-1,1);step(dt,W,A);
 const up=P.pos,back=P.fwd.clone().negate(),right=new THREE.Vector3().crossVectors(up,back);
 prince.position.copy(up).multiplyScalar(R+.02);prince.quaternion.setFromRotationMatrix(m4.makeBasis(right,up,back));
 const sp=Math.abs(P.vel)/2.4;body.position.y=Math.abs(Math.sin(walkT))*.06*sp;body.rotation.z=Math.sin(walkT)*.05*sp;
 legs[0].rotation.x=Math.sin(walkT)*.7*sp;legs[1].rotation.x=-Math.sin(walkT)*.7*sp;
 scarf.forEach((j,i)=>{j.rotation.x=(.22-sp*.1)+Math.sin(t*4-i*.8)*(.12+sp*.15);j.rotation.y=Math.sin(t*2.7-i*.6)*.15;j.rotation.z=Math.sin(t*3.3-i)*.12;});
 scarf[0].rotation.x=-.15-sp*.35+Math.sin(t*3)*.08;
 rose.userData.bloom.rotation.y=Math.sin(t*.8)*.15;
 for(const p of puffs){p.t+=dt*.18;if(p.t>1)p.t-=1;const k=p.t;p.sp.position.set(Math.sin(k*6+p.s*3)*.15*k,.7*p.s+k*1.6*p.s,Math.cos(k*5)*.1*k);p.sp.scale.setScalar((.15+k*.6)*p.s);p.sp.material.opacity=Math.sin(k*Math.PI)*.45;}
 lampLight.intensity=3.6+Math.sin(t*7)*.2+Math.sin(t*13)*.15;
 starMat.uniforms.t.value=t;world.rotation.y=0;
 // rose proximity
 const near=up.angleTo(rose.userData.dir)*R<1.5;
 if(near&&!shown)showLine();if(!near&&shown&&performance.now()-forced>4000)hideLine();
 // camera
 const desired=prince.position.clone().addScaledVector(up,4.2).addScaledVector(back,6.8);
 if(first){camPos.copy(desired);camUp.copy(up);first=false;}
 camPos.lerp(desired,1-Math.exp(-dt*2.5));camUp.lerp(up,1-Math.exp(-dt*2.5)).normalize();
 camera.position.copy(camPos);camera.up.copy(camUp);camera.lookAt(tmp.copy(prince.position).addScaledVector(up,1.2));
 // sun follows from behind-left in view space
 sunL.position.copy(prince.position).addScaledVector(up,8).addScaledVector(right,-6).addScaledVector(P.fwd,-3);sunL.target.position.copy(prince.position);
 sky.position.copy(camera.position);sky.material.uniforms.cu.value.copy(camUp);
 composer.render();}
animate();
