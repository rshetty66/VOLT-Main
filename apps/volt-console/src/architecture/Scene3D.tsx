import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { REFERENCE } from "./data";

/**
 * Animated 3D view of the target architecture: the six layers stacked as floors, with accounting events climbing
 * from source systems to reports. US events fork into US GAAP and IFRS ledgers; about one in eight is a planted
 * defect that stops at the rule engine. Simulated flow, not bank data. Loaded lazily so three.js stays out of the
 * main bundle.
 */
const GAP = 3.2;
const SEG = { ca: "#4fb3e8", us: "#e8a14f", wm: "#b58cf0", cm: "#5ed39a", fail: "#ff7a6e", accent: "#5cc8ad" };
const ROUTES = [
  { seg: "ca", w: 4, path: ["Core banking CA", "Business events", "Rule engine", "CA-IFRS", "Consolidation", "OSFI returns"] },
  { seg: "ca", w: 2, path: ["Risk engines", "Measurement refs", "Rule engine", "CA-IFRS", "Consolidation", "IFRS statements"] },
  { seg: "wm", w: 2, path: ["Wealth platform", "Business events", "Rule engine", "CA-IFRS", "Segment and FTP", "Management"] },
  { seg: "cm", w: 2, path: ["Trading and risk", "Business events", "Rule engine", "CA-IFRS", "Consolidation", "IFRS statements"] },
  { seg: "us", w: 3, path: ["Core banking US", "Business events", "Multi-basis", "US-USGAAP", "US returns"], fork: ["Core banking US", "Business events", "Multi-basis", "US-IFRS", "Consolidation", "IFRS statements"] },
  { seg: "us", w: 2, path: ["Risk engines", "Measurement refs", "Multi-basis", "US-USGAAP", "US returns"], fork: ["Risk engines", "Measurement refs", "Multi-basis", "US-IFRS", "Consolidation", "OSFI returns"] },
] as const;
const DEFECTS = ["J_BALANCE: debits 450,000.00 != credits 449,000.00", "J_RULE_APPROVED: rule CM-FVTPL-V2 is DRAFT", "J_PERIOD_OPEN: period 2026-09 is closed"];

export default function Scene3D() {
  const host = useRef<HTMLDivElement>(null);
  const labelsHost = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({ ev: 0, jn: 0, bl: 0, rp: 0 });
  const [toast, setToast] = useState("");
  const [playing, setPlaying] = useState(() => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const el = host.current!;
    const labelsEl = labelsHost.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor("#0f172a");
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#0f172a", 40, 85);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    camera.position.set(27, 21, 31);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, GAP * 3.1, 0);
    controls.enableDamping = true;
    controls.autoRotate = playingRef.current;
    controls.autoRotateSpeed = 0.5;
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(10, 30, 15);
    scene.add(sun);

    // Floors and component blocks from the reference architecture's six columns.
    const nodes = new Map<string, THREE.Mesh>();
    const labels: { el: HTMLDivElement; pos: THREE.Vector3 }[] = [];
    const label = (text: string, pos: THREE.Vector3, cls = "") => {
      const d = document.createElement("div");
      d.className = `arch3d-label ${cls}`;
      d.textContent = text;
      labelsEl.appendChild(d);
      labels.push({ el: d, pos });
    };
    const accent = new THREE.Color(SEG.accent);
    REFERENCE[0].cols.forEach((col, li) => {
      const y = li * GAP;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(24, 0.12, 9), new THREE.MeshStandardMaterial({ color: accent, transparent: true, opacity: 0.06, depthWrite: false }));
      slab.position.set(0, y, 0);
      scene.add(slab);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.35 }));
      edges.position.copy(slab.position);
      scene.add(edges);
      label(col.title, new THREE.Vector3(-12.3, y, 4.5), "layer");
      const n = col.items.length;
      const span = n >= 5 ? 18 : n === 4 ? 15 : 12;
      col.items.forEach((it, i) => {
        const x = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 2.2), new THREE.MeshStandardMaterial({ color: "#1d3a33", emissive: accent, emissiveIntensity: 0.08, roughness: 0.55 }));
        mesh.position.set(x, y + 0.51, 0);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.7 })));
        mesh.userData = { glow: 0, color: accent.clone() };
        scene.add(mesh);
        nodes.set(it.t, mesh);
        label(it.t, new THREE.Vector3(x, y + 1.15, 0));
      });
    });

    const top = (name: string) => nodes.get(name)!.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    const curveFor = (ids: readonly string[]) => {
      const pts: THREE.Vector3[] = [];
      ids.forEach((id, i) => {
        const p = top(id);
        if (i) {
          const prev = pts[pts.length - 1];
          pts.push(new THREE.Vector3((prev.x + p.x) / 2, (prev.y + p.y) / 2 + 0.6, 0.8));
        }
        pts.push(p);
      });
      return new THREE.CatmullRomCurve3(pts, false, "centripetal");
    };
    ROUTES.forEach((r) => [r.path, "fork" in r ? r.fork : undefined].forEach((ids) => {
      if (!ids) return;
      const g = new THREE.BufferGeometry().setFromPoints(curveFor(ids).getPoints(80));
      scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: SEG[r.seg], transparent: true, opacity: 0.14 })));
    }));

    const ledgers = new Set(["CA-IFRS", "US-USGAAP", "US-IFRS"]);
    const reports = new Set(["IFRS statements", "OSFI returns", "US returns", "Management"]);
    const sphere = new THREE.SphereGeometry(0.26, 14, 10);
    interface Particle { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; ids: readonly string[]; stops: number[]; len: number; d: number; next: number; defect: boolean; fade: number; color: THREE.Color }
    const particles: Particle[] = [];
    const total = ROUTES.reduce((a, r) => a + r.w, 0);
    const counters = { ev: 0, jn: 0, bl: 0, rp: 0 };

    const spawn = (seg: string, ids: readonly string[], defect: boolean) => {
      const cut = ids.findIndex((x) => x === "Rule engine" || x === "Multi-basis");
      const path = defect ? ids.slice(0, cut + 1) : ids;
      const curve = curveFor(path);
      const len = curve.getLength();
      const samples = curve.getSpacedPoints(240);
      const stops = path.map((id) => {
        const t = top(id);
        let best = 0;
        samples.forEach((s, k) => s.distanceToSquared(t) < samples[best].distanceToSquared(t) && (best = k));
        return (best / 240) * len;
      });
      const color = new THREE.Color(SEG[seg as keyof typeof SEG]);
      const mesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color, transparent: true }));
      scene.add(mesh);
      particles.push({ mesh, curve, ids: path, stops, len, d: 0, next: 1, defect, fade: 0, color });
    };
    const emit = () => {
      let pick = Math.random() * total;
      const r = ROUTES.find((x) => (pick -= x.w) <= 0) ?? ROUTES[0];
      const defect = !("fork" in r) && Math.random() < 0.12;
      counters.ev++;
      spawn(r.seg, r.path, defect);
      if ("fork" in r && !defect) spawn(r.seg, r.fork, false);
    };
    const pulse = (name: string, color: THREE.Color) => {
      const n = nodes.get(name);
      if (n) {
        n.userData.glow = 1;
        (n.userData.color as THREE.Color).copy(color);
      }
    };
    for (let i = 0; i < 6; i++) emit();
    particles.forEach((p) => {
      p.d = Math.random() * p.len * 0.6;
      while (p.next < p.ids.length && p.stops[p.next] <= p.d) p.next++;
    });

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0, last = performance.now(), acc = 0, toastAt = 0;
    const tmp = new THREE.Vector3();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      controls.autoRotate = playingRef.current;
      if (playingRef.current) {
        acc += dt;
        if (acc > 0.55) { acc = 0; emit(); }
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          const mat = p.mesh.material as THREE.MeshBasicMaterial;
          if (p.fade > 0) {
            p.fade -= dt * 1.4;
            mat.opacity = Math.max(0, p.fade);
            if (p.fade <= 0) { scene.remove(p.mesh); mat.dispose(); particles.splice(i, 1); }
            continue;
          }
          p.d += dt * 5.2;
          p.curve.getPointAt(Math.min(1, p.d / p.len), p.mesh.position);
          const nid = p.ids[p.next];
          if (nid && p.d >= p.stops[p.next] - 0.01) {
            pulse(nid, p.color);
            if (ledgers.has(nid)) counters.jn++;
            if (reports.has(nid)) counters.rp++;
            p.next++;
          }
          if (p.d >= p.len) {
            if (p.defect) {
              mat.color.set(SEG.fail);
              pulse(p.ids[p.ids.length - 1], new THREE.Color(SEG.fail));
              counters.bl++;
              setToast(`Blocked at the rule engine: ${DEFECTS[counters.bl % DEFECTS.length]}`);
              toastAt = now;
            }
            p.fade = 1;
          }
        }
        setStats({ ...counters });
        if (toastAt && now - toastAt > 2600) { setToast(""); toastAt = 0; }
      }
      nodes.forEach((n) => {
        n.userData.glow = Math.max(0, n.userData.glow - dt * 1.6);
        const m = n.material as THREE.MeshStandardMaterial;
        m.emissive.copy(n.userData.glow > 0.02 ? n.userData.color : accent);
        m.emissiveIntensity = 0.08 + n.userData.glow * 0.9;
      });
      controls.update();
      renderer.render(scene, camera);
      const w = el.clientWidth, h = el.clientHeight;
      labels.forEach((lb) => {
        tmp.copy(lb.pos).project(camera);
        const visible = tmp.z < 1 && tmp.z > -1;
        lb.el.style.display = visible ? "" : "none";
        if (visible) { lb.el.style.left = `${((tmp.x + 1) / 2) * w}px`; lb.el.style.top = `${((1 - tmp.y) / 2) * h}px`; }
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((x) => x.dispose());
      });
      el.removeChild(renderer.domElement);
      labelsEl.replaceChildren();
    };
  }, []);

  return (
    <div className="arch3d">
      <div className="arch3d-stage" ref={host} aria-label="3D model of the finance architecture with animated accounting events" />
      <div className="arch3d-labels" ref={labelsHost} aria-hidden="true" />
      <div className="arch3d-stats" aria-live="polite">
        <span><b>{stats.ev}</b> events</span>
        <span><b>{stats.jn}</b> journals</span>
        <span className="fail"><b>{stats.bl}</b> blocked</span>
        <span><b>{stats.rp}</b> report feeds</span>
        <small>Simulated flow, not bank data.</small>
      </div>
      {toast && <div className="arch3d-toast" role="status">{toast}</div>}
      <div className="arch3d-controls">
        <button className="btn sm" onClick={() => setPlaying((x) => !x)}>{playing ? "Pause" : "Play"}</button>
        <span className="arch3d-legend">
          <i style={{ background: SEG.ca }} /> Canadian P&amp;C <i style={{ background: SEG.us }} /> US P&amp;C <i style={{ background: SEG.wm }} /> Wealth <i style={{ background: SEG.cm }} /> Capital Markets <i style={{ background: SEG.fail }} /> Blocked
        </span>
      </div>
    </div>
  );
}
