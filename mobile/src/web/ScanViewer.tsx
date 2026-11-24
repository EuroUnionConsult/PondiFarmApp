import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { MeshFormat } from '../lib/api';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Mode = 'photo' | 'clay' | 'points';
const MODES: { id: Mode; label: string }[] = [{ id: 'photo', label: 'Photo' }, { id: 'clay', label: 'Clay' }, { id: 'points', label: 'LiDAR' }];

export type MeshSource = () => Promise<{ format: MeshFormat; data: ArrayBuffer }>;

/** Converte os bytes da malha num objeto 3D. O PLY do scanner traz a cor de cada vértice. */
async function toObject(format: MeshFormat, data: ArrayBuffer): Promise<THREE.Object3D> {
  if (format === 'glb') return new Promise((ok, fail) => new GLTFLoader().parse(data, '', (g) => ok(g.scene), fail));
  if (format === 'obj') {
    // O OBJ do scanner não traz cor nem material: mostra-se em argila, como na app.
    const obj = new OBJLoader().parse(new TextDecoder().decode(data));
    obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.9, side: THREE.DoubleSide }); });
    return obj;
  }
  const geo = new PLYLoader().parse(data);
  const colored = !!geo.getAttribute('color');
  const mat = new THREE.MeshStandardMaterial({ vertexColors: colored, color: colored ? 0xffffff : 0xd9d2c3, roughness: 0.85, side: THREE.DoubleSide });
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat)); return g;
}

/**
 * Visualizador do scan 3D na ficha do animal (PLY, OBJ ou GLB): roda devagar sozinho, arrasta-se
 * para girar e a roda do rato aproxima. Três modos: textura fotográfica, argila
 * (só a forma, como o modo «clay» da app) e pontos (o que o LiDAR mediu).
 */
export default function ScanViewer({ load, dark }: { load: MeshSource; dark: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setMode: (m: Mode) => void; reset: () => void } | null>(null);
  const [mode, setMode] = useState<Mode>('photo');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x223344 : 0xb9c4cf, dark ? 1.6 : 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = !reduced; controls.autoRotateSpeed = 1.1; controls.enablePan = false;

    let root: THREE.Object3D | null = null, photo: THREE.Material[] = [], clay: THREE.Material | null = null, pts: THREE.Points | null = null;
    let home = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    let born = 0, raf = 0, alive = true;

    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    load().then(({ format, data }) => toObject(format, data)).then((obj) => {
      if (!alive) return;
      root = obj;
      // Centra e assenta no chão; a câmara enquadra a caixa do animal.
      const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      root.position.sub(c);
      const r = Math.max(size.x, size.y, size.z);
      clay = new THREE.MeshStandardMaterial({ color: dark ? 0xaeb8c2 : 0xd9d2c3, roughness: 0.92, metalness: 0 });
      const positions: number[] = [];
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.computeVertexNormals();
        photo.push(m.material as THREE.Material);
        const p = m.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i += 2) positions.push(p.getX(i), p.getY(i), p.getZ(i));
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      // Mesmo tamanho nos dois temas; no claro, um verde vivo e opaco para se destacar no fundo claro.
      pts = new THREE.Points(g, new THREE.PointsMaterial({ color: dark ? 0x58d68d : 0x16a34a, size: r / 260, sizeAttenuation: true, transparent: dark, opacity: dark ? 0.85 : 1 }));
      pts.visible = false;
      const holder = new THREE.Group(); holder.add(root); root.add(pts);
      scene.add(holder);
      home = { pos: new THREE.Vector3(r * 0.78, r * 0.32, r * 0.78), target: new THREE.Vector3(0, -size.y * 0.08, 0) };
      camera.position.copy(home.pos); controls.target.copy(home.target); controls.minDistance = r * 0.5; controls.maxDistance = r * 4;
      born = performance.now(); setState('ready');
    }).catch(() => { if (alive) setState('error'); });

    api.current = {
      setMode: (m) => {
        if (!root) return;
        root.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.visible = m !== 'points'; } });
        let i = 0; root.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.material = m === 'clay' && clay ? clay : photo[i] ?? mesh.material; i++; } });
        if (pts) pts.visible = m === 'points';
      },
      reset: () => { camera.position.copy(home.pos); controls.target.copy(home.target); },
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (root && born) { const u = Math.min(1, (now - born) / 700), e = 1 - Math.pow(1 - u, 3); root.scale.setScalar(reduced ? 1 : 0.85 + 0.15 * e); }
      controls.update(); renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [load, dark]);

  useEffect(() => { api.current?.setMode(mode); }, [mode, state]);

  return (
    <div className="pf-3d">
      <div ref={host} className="cv" aria-label="3D scan of the animal. Drag to rotate, scroll to zoom" role="img" />
      {state === 'loading' && <div className="ov"><span className="pf-spin" />Loading the 3D scan…</div>}
      {state === 'error' && <div className="ov">The 3D scan could not be loaded.</div>}
      {state === 'ready' && (
        <div className="bar">
          <div className="pf-pills sm" role="tablist" aria-label="View" style={{ ['--n' as any]: MODES.length, ['--i' as any]: MODES.findIndex((m) => m.id === mode) }}>
            <span className="thumb" aria-hidden="true" />
            {MODES.map((m) => <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on w6' : 'w6'} onClick={() => setMode(m.id)}>{m.label}</button>)}
          </div>
          <button className="pf-link w6" onClick={() => api.current?.reset()}>Reset view</button>
        </div>)}
    </div>
  );
}
