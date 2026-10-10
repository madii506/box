/* The hero: the box in 3D. One half solid, one half quantum glass, a qubit glowing inside.
   Every few seconds the lid lifts, the qubit is measured, and it shows a 0 or a 1. */
import * as THREE from 'three';
import { RoomEnvironment } from '/vendor/RoomEnvironment.js';

const cl = t => Math.min(1, Math.max(0, t));
const eio = t => { t = cl(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const R2 = Math.SQRT2;

// a triangular prism: the cube's square cross-section is a diamond (front, right, back, left); each half is a triangle
function prism(tri, y0, h) {
  const s = new THREE.Shape();
  tri.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); g.computeVertexNormals();
  return g;
}

export function hero3d(host, { reduced = false } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  const small = innerWidth < 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.85;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 2.3, 8.6); camera.lookAt(0, 0.12, 0);

  const F = [0, R2], Rt = [R2, 0], K = [0, -R2], Lt = [-R2, 0];
  const H = 2, LID = 0.52, GAP = 0.025;
  const solid = new THREE.MeshPhysicalMaterial({ color: 0xece8df, roughness: 0.42, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbaf8ff, roughness: 0.1, metalness: 0, transmission: 0.94, thickness: 0.7, ior: 1.32, attenuationColor: new THREE.Color(0x24bcd9), attenuationDistance: 2.6, transparent: true, opacity: 1, side: THREE.DoubleSide });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x8ff6ff, transparent: true, opacity: 0.95 });
  const glowMat = new THREE.LineBasicMaterial({ color: 0x7ff4ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending });
  const edged = (g, m) => { const grp = new THREE.Group(); grp.add(new THREE.Mesh(g, m)); const e = new THREE.EdgesGeometry(g, 30); grp.add(new THREE.LineSegments(e, edgeMat)); const e2 = new THREE.LineSegments(e, glowMat); e2.scale.setScalar(1.004); grp.add(e2); return grp; };

  const box = new THREE.Group();
  const bodyH = H - LID;
  box.add(new THREE.Mesh(prism([F, K, Lt], -1, bodyH), solid));
  box.add(edged(prism([F, Rt, K], -1, bodyH), glass));
  const lid = new THREE.Group();
  lid.add(new THREE.Mesh(prism([F, K, Lt], 0, LID), solid));
  lid.add(edged(prism([F, Rt, K], 0, LID), glass));
  const lidPivot = new THREE.Group(); lidPivot.position.set(-R2, -1 + bodyH + GAP, 0); lid.position.set(R2, 0, 0); lidPivot.add(lid); box.add(lidPivot);
  // the split: one bright edge where the two states meet
  const split = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, H, 8), new THREE.MeshBasicMaterial({ color: 0x9ff7ff }));
  split.position.set(0, 0, R2); box.add(split);
  // the qubit inside
  const qMat = new THREE.MeshBasicMaterial({ color: 0x7ff4ff });
  const qubit = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 16), qMat);
  qubit.position.set(0.35, -0.15, 0.1); box.add(qubit);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 16), new THREE.MeshBasicMaterial({ color: 0x7ff4ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  qubit.add(halo);
  const inner = new THREE.PointLight(0x7ff4ff, 6, 6, 2); inner.position.copy(qubit.position); box.add(inner);
  scene.add(box);

  scene.add(new THREE.AmbientLight(0xffffff, 0.14));
  const key = new THREE.DirectionalLight(0xfff6ea, 2.0); key.position.set(-4, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7ff4ff, 1.4); rim.position.set(4, 2, -3); scene.add(rim);
  const fill = new THREE.PointLight(0x7ff4ff, 3, 10, 2); fill.position.set(2.4, -0.4, 2.6); scene.add(fill);

  // quantum dust
  const N = small ? 160 : 360;
  const pp = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { pp.set([(Math.random() - 0.5) * 10, Math.random() * 5 - 1.8, -0.5 - Math.random() * 5], i * 3); ph[i] = Math.random() * 6.28; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x8ff6ff, size: 0.025, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  let w = 0, h = 0;
  const size = () => { const r = host.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, r.height); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size(); addEventListener('resize', size);
  let mx = 0, my = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);

  const t0 = performance.now();
  let bit = 1, lastCycle = -1;
  const CYC = 7.2;
  const frame = now => {
    const t = window.__heroT != null ? window.__heroT : (now - t0) / 1000;
    const c = t % CYC, n = Math.floor(t / CYC);
    if (n !== lastCycle) { lastCycle = n; }
    // open 4.0-5.0, hold, close 6.3-7.1
    const open = reduced ? 0.4 : eio((c - 4.0) / 1.0) * (1 - eio((c - 6.3) / 0.8));
    lidPivot.rotation.z = open * 0.34; lidPivot.position.y = -1 + bodyH + GAP + open * 0.72;
    // the measurement: at the top of the opening the qubit collapses to 0 (ivory) or 1 (cyan)
    if (c > 4.55 && c < 4.6 && !frame.m) { bit = Math.random() < 0.5 ? 0 : 1; frame.m = true; }
    if (c < 4.55) frame.m = false;
    const measured = c > 4.55 && c < 6.6;
    const target = measured ? (bit ? 0x7ff4ff : 0xf3f0e8) : 0x7ff4ff;
    qMat.color.lerp(new THREE.Color(target), 0.18);
    halo.material.color.copy(qMat.color);
    const pulse = measured ? 1.25 : 0.85 + Math.sin(t * 3.1) * 0.15;
    qubit.scale.setScalar(measured ? 1.15 : 1 + Math.sin(t * 2.3) * 0.06);
    inner.intensity = 4 + open * 10 * pulse; inner.color.copy(qMat.color);
    qubit.position.y = -0.15 + Math.sin(t * 1.4) * 0.05 + open * 1.08; qubit.position.x = 0.35 * (1 - open); inner.position.copy(qubit.position);
    box.rotation.y = -0.05 + Math.sin(t * 0.32) * 0.22 + mx * 0.35;
    box.rotation.x = my * 0.08;
    box.position.y = Math.sin(t * 0.9) * 0.04;
    const pa = pg.attributes.position.array;
    for (let i = 0; i < N; i++) { pa[i * 3 + 1] += 0.0016; if (pa[i * 3 + 1] > 3.2) pa[i * 3 + 1] = -1.8; pa[i * 3] += Math.sin(t * 0.6 + ph[i]) * 0.0008; }
    pg.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  };
  if (reduced) { frame(t0 + 5200); return true; }
  frame(performance.now()); // first frame right away, even before the tab is visible
  const loop = now => { if (visible && !document.hidden) frame(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return true;
}
