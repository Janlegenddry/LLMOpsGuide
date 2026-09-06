import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { CardSpec, HardwareStep } from "../lib/hardware-lab";

type Moving = { object: THREE.Object3D; base: number; lift: number; z: number; slide: number };
type Path = { curve: THREE.Curve<THREE.Vector3>; line: THREE.Mesh; dots: THREE.Mesh[]; key: string };
const C = { pcb: "#235249", edge: "#163b32", chip: "#253841", gold: "#b99a56", steel: "#b2bec5", dark: "#283b43", copper: "#ba8256", memory: "#525a66", request: "#157fab", data: "#e0a238", error: "#bc4240" };

/** Procedural teaching geometry; deliberately not a vendor CAD or sampled topology. */
export class HardwareScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 150);
  controls: OrbitControls;
  model = new THREE.Group();
  labels = new THREE.Group();
  moving: Moving[] = [];
  paths: Path[] = [];
  pickables: THREE.Mesh[] = [];
  selection = new THREE.Group();
  raycaster = new THREE.Raycaster();
  observer: ResizeObserver;
  visible = true;
  playing = false;
  labelsVisible = true;
  reduced = matchMedia("(prefers-reduced-motion: reduce)");
  extent = 5;
  explosion = .35;
  targetExplosion = .35;
  raf = 0;
  lastTime = 0;
  phase = 0;
  route = "";
  kind: HardwareStep["kind"] = "idle";
  stopped = false;
  needsRender = true;
  lastSelection = "";
  fill?: THREE.Mesh;
  warning?: THREE.Sprite;
  abort = new AbortController();

  constructor(public host: HTMLElement, public mode: "card" | "rfork", public onSelect: (id: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setClearColor("#dde7e7");
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "交互式硬件 3D 画布。拖动旋转，方向键调整视角，使用外部按钮缩放与选择部件。");
    canvas.setAttribute("role", "img");
    host.append(canvas);
    const hemi = new THREE.HemisphereLight("#f2fcff", "#71817d", 2.5);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight("#fff8e9", 3.3);
    key.position.set(-7, 16, 9); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, far: 60 });
    key.shadow.bias = -.001; this.scene.add(key);
    const rim = new THREE.DirectionalLight("#afcfff", 1.7); rim.position.set(10, 7, -8); this.scene.add(rim);
    this.scene.add(this.model, this.selection);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: "#dde7e7", roughness: .93 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.35; floor.receiveShadow = true; this.scene.add(floor);
    const grid = new THREE.GridHelper(60, 60, "#bccdcd", "#ccdad9"); grid.position.y = -.34; this.scene.add(grid);
    this.camera.position.set(12, 14, 16);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 1, 0);
    this.controls.enableDamping = false;
    this.controls.enableZoom = false; this.controls.enablePan = false;
    this.controls.minPolarAngle = .12; this.controls.maxPolarAngle = Math.PI * .48;
    this.controls.addEventListener("change", () => { this.needsRender = true; });
    this.controls.update();
    const signal = this.abort.signal;
    let pointer = { x: 0, y: 0 };
    canvas.addEventListener("pointerdown", e => { pointer = { x: e.clientX, y: e.clientY }; }, { signal });
    canvas.addEventListener("pointerup", e => {
      if (Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 5) return;
      const r = canvas.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.camera);
      const hit = this.raycaster.intersectObjects(this.pickables, false).find(h => {
        for (let o: THREE.Object3D | null = h.object; o; o = o.parent) if (!o.visible) return false;
        return true;
      });
      if (hit) this.onSelect(hit.object.userData.part);
    }, { signal });
    canvas.addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "="].includes(e.key)) return;
      e.preventDefault();
      if (["+", "-", "="].includes(e.key)) { this.zoom(e.key === "-" ? .85 : 1.15); return; }
      const offset = this.camera.position.clone().sub(this.controls.target);
      const sphere = new THREE.Spherical().setFromVector3(offset);
      if (e.key === "ArrowLeft") sphere.theta -= .15;
      if (e.key === "ArrowRight") sphere.theta += .15;
      if (e.key === "ArrowUp") sphere.phi = Math.max(.12, sphere.phi - .12);
      if (e.key === "ArrowDown") sphere.phi = Math.min(Math.PI * .48, sphere.phi + .12);
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(sphere)); this.controls.update();
    }, { signal });
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); this.stopped = true; this.host.dispatchEvent(new CustomEvent("hardware-context-lost")); }, { signal });
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host);
    this.reduced.addEventListener("change", () => { this.needsRender = true; }, { signal });
    this.resize(); this.raf = requestAnimationFrame(t => this.tick(t));
  }

  material(color: string, metalness = .1, roughness = .55) { return new THREE.MeshStandardMaterial({ color, metalness, roughness }); }
  box(parent: THREE.Object3D, size: number[], position: number[], color: string, part = "", round = false, metalness = .15) {
    const geometry = round ? new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(...size) * .12) : new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mesh = new THREE.Mesh(geometry, this.material(color, metalness));
    mesh.position.set(position[0], position[1], position[2]); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    if (part) { mesh.userData.part = part; this.pickables.push(mesh); }
    return mesh;
  }
  cylinder(parent: THREE.Object3D, radius: number, height: number, position: number[], color: string, part = "") {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), this.material(color, .65, .35));
    mesh.position.set(...position as [number, number, number]); mesh.castShadow = true; parent.add(mesh);
    if (part) { mesh.userData.part = part; this.pickables.push(mesh); } return mesh;
  }
  lift(object: THREE.Object3D, amount: number, slide = 0) { this.moving.push({ object, base: object.position.y, lift: amount, z: object.position.z, slide }); }
  label(text: string, pos: number[], width = 2.5, parent: THREE.Object3D = this.labels) {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 80;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "600 36px sans-serif";
    canvas.width = Math.max(132, Math.min(512, Math.ceil(ctx.measureText(text).width + 42)));
    ctx.fillStyle = "#213b43"; ctx.fillRect(0, 0, canvas.width, 80);
    ctx.strokeStyle = "#7da7a8"; ctx.lineWidth = 3; ctx.strokeRect(2, 2, canvas.width - 4, 76);
    ctx.fillStyle = "#f2faf9"; ctx.font = "600 36px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, canvas.width / 2, 40, canvas.width - 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, toneMapped: false }));
    const fittedWidth = Math.min(width, canvas.width * (this.mode === "card" ? .007 : .012));
    sprite.position.set(...pos as [number, number, number]); sprite.scale.set(fittedWidth, fittedWidth * 80 / canvas.width, 1); sprite.renderOrder = 10; parent.add(sprite); return sprite;
  }
  path(key: string, points: number[][], color: string, radius = .025) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number])), false, "centripetal");
    const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, radius, 6, false), this.material(color, .3, .5));
    this.model.add(line);
    const dots = Array.from({ length: 5 }, () => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(radius * 3.8, 10, 8), new THREE.MeshBasicMaterial({ color }));
      this.model.add(dot); dot.visible = false; return dot;
    });
    this.paths.push({ curve, line, dots, key });
  }
  clearModel() {
    this.disposeTree(this.model); this.disposeTree(this.selection);
    this.model.clear(); this.selection.clear(); this.labels = new THREE.Group(); this.model.add(this.labels);
    this.moving = []; this.paths = []; this.pickables = []; this.fill = undefined; this.warning = undefined; this.lastSelection = "";
  }
  buildCard(card: CardSpec) {
    this.clearModel(); this.extent = 6.8;
    const long = card.form === "pcie";
    const w = long ? 9 : card.dies === 2 ? 7.3 : 6.4;
    const d = long ? 4.2 : 5;
    const board = this.box(this.model, [w, .16, d], [0, 0, 0], card.color, "power", true);
    this.box(board, [w - .1, .04, d - .1], [0, -.11, 0], C.edge, "power");
    // Fine visible board traces and solder pads; schematic only.
    for (let i = 0; i < 22; i++) {
      const x = -w / 2 + .3 + i * (w - .6) / 22;
      this.box(board, [.018, .01, d - .65], [x, .088, 0], i % 3 ? "#719477" : "#b6a66e");
      for (const z of [-d / 2 + .15, d / 2 - .15]) this.box(board, [.055, .02, .08], [x, .105, z], C.gold);
    }
    for (const x of [-w / 2 + .24, w / 2 - .24]) for (const z of [-d / 2 + .24, d / 2 - .24]) {
      this.cylinder(this.model, .14, .11, [x, .15, z], C.steel, "power");
      this.box(this.model, [.17, .02, .025], [x, .212, z], C.dark);
    }
    // VRM inductors, capacitors, and small controller packages around the central package.
    for (const sign of [-1, 1]) for (let i = 0; i < 7; i++) {
      const x = (i - 3) * .65, z = sign * (d / 2 - .62);
      this.box(this.model, [.43, .3, .37], [x, .23, z], C.steel, "power", true, .55);
      this.cylinder(this.model, .08, .28, [x + .23, .2, z + sign * .3], C.dark, "power");
    }
    if (long) {
      this.box(this.model, [.16, 1.45, d + .18], [-w / 2 -.08, .48, 0], C.steel, "connector", true, .7);
      for (let i = 0; i < 26; i++) this.box(this.model, [.09, .09, .36], [-1.9 + i * .13, -.01, d / 2 + .12], C.gold, "connector");
      this.box(this.model, [.5, .5, .8], [w / 2 - .3, .3, -.9], C.dark, "power");
    } else {
      for (const x of [-1.9, 1.9]) {
        this.box(this.model, [.7, .28, 3.2], [x, -.25, 0], C.dark, "connector");
        for (let i = 0; i < 16; i++) this.box(this.model, [.74, .035, .07], [x, -.4, -1.4 + i * .18], C.gold, "connector");
      }
    }
    const pack = new THREE.Group(); pack.position.y = .17; this.model.add(pack); this.lift(pack, .5);
    const pw = card.dies === 2 ? 4.5 : 3.4;
    this.box(pack, [pw, .18, 2.6], [0, .1, 0], "#496957", "package", true);
    this.box(pack, [pw - .12, .06, 2.5], [0, .23, 0], "#b5b0a2", "package", true, .5);
    const inner = new THREE.Group(); inner.position.y = .45; this.model.add(inner); this.lift(inner, 1.1);
    const centers = card.dies === 2 ? [-.88, .88] : [0];
    for (const [dieIndex, cx] of centers.entries()) {
      this.box(inner, [1.15, .17, 1.35], [cx, 0, 0], C.chip, "die", true, .75);
      for (let a = 0; a < 4; a++) for (let b = 0; b < 5; b++) this.box(inner, [.2, .015, .21], [cx - .36 + a * .24, .1, -.5 + b * .25], (a + b) % 3 ? "#648c97" : "#8eb4b1", "die", false, .7);
      for (const side of [-1, 1]) for (const zz of [-.83, .83]) {
        const hx = card.dies === 2 ? cx + side * .48 : side * 1.15;
        const hz = card.dies === 2 ? zz * 1.16 : zz * .75;
        for (let layer = 0; layer < 5; layer++) this.box(inner, [.49, .048, .47], [hx, .04 + layer * .06, hz], layer % 2 ? "#9a9ca0" : C.memory, "hbm", false, .35);
      }
      this.label(card.dies === 2 ? `DIE ${dieIndex}` : "COMPUTE DIE", [cx, .65, -.05], card.dies === 2 ? 1.25 : 1.6, inner).userData.interior = true;
    }
    // Air-cooled assembly: copper contact plate, metal base, thin fins and mounting screws.
    const cooling = new THREE.Group(); cooling.position.y = .96; this.model.add(cooling); this.lift(cooling, 3.1, -1.7);
    const cw = long ? 7.8 : w - .55;
    this.box(cooling, [pw + .2, .13, 2.8], [0, -.22, 0], C.copper, "cooler", true, .72);
    this.box(cooling, [cw, .18, d - .25], [0, -.06, 0], C.steel, "cooler", true, .7);
    for (let i = 0; i < 33; i++) this.box(cooling, [.05, .72, d - .38], [-cw / 2 + .18 + i * (cw - .36) / 32, .38, 0], i % 2 ? "#b7c2c8" : "#8b9ca7", "cooler", false, .72);
    for (const x of [-cw / 2 + .15, cw / 2 - .15]) for (const z of [-d / 2 + .28, d / 2 - .28]) this.cylinder(cooling, .12, .14, [x, .82, z], C.dark, "cooler");
    this.label(card.name, [0, .93, .1], 2.8, cooling);
    this.label("HBM", [-pw / 2 - .25, .65, 1.2], 1, inner).userData.interior = true;
    this.label(long ? "PCIe EDGE" : "BOARD CONNECTOR", [1.25, -.2, d / 2 + .45], 2.2);
    this.path("memory", [[centers[0] - (card.dies === 2 ? .48 : 1.15), .45, .65], [centers[0] - .45, .55, .3], [centers[0], .3, 0]], C.data, .026);
    const memoryPath = this.paths[this.paths.length - 1];
    // Keep the flow anchored to the die/HBM assembly at every explosion position.
    inner.add(memoryPath.line, ...memoryPath.dots);
    this.labels.visible = this.labelsVisible;
    this.setExplosion(this.targetExplosion * 100, true); this.preset("iso"); this.needsRender = true;
  }

  buildRFork() {
    this.clearModel(); this.extent = 12.4;
    const server = (cx: number, target: boolean) => {
      const prefix = target ? "target" : "source";
      const group = new THREE.Group(); group.position.x = cx; this.model.add(group);
      this.box(group, [8.4, .22, 7.2], [0, 0, 0], "#85969f", "cpu", true, .7);
      this.box(group, [8, .12, 6.8], [0, .17, 0], "#31594f", "cpu");
      for (const x of [-4.13, 4.13]) this.box(group, [.14, 1.2, 7.2], [x, .55, 0], C.steel, "cpu", true, .6);
      this.box(group, [8.2, 1.2, .16], [0, .55, -3.52], C.steel, "cpu", true, .6);
      // Front fan wall: circular hubs, eight radial blades, square housings.
      for (let i = 0; i < 6; i++) {
        const x = -3.3 + i * 1.3;
        this.box(group, [1.1, 1, .45], [x, .62, 3.15], C.dark, "cpu", true);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.38, .035, 7, 20), this.material(C.steel, .6)); ring.position.set(x, .62, 3.4); group.add(ring);
        const hub = this.cylinder(group, .13, .12, [x, .62, 3.42], C.steel); hub.rotation.x = Math.PI / 2;
        for (let a = 0; a < 7; a++) {
          const blade = this.box(group, [.1, .3, .05], [x + Math.sin(a * 6.28 / 7) * .24, .62 + Math.cos(a * 6.28 / 7) * .24, 3.4], "#72858c"); blade.rotation.z = -a * 6.28 / 7 + .4;
        }
      }
      for (const x of [-1.2, 1.2]) {
        this.box(group, [1.3, .27, 1.25], [x, .45, -2.2], C.steel, "cpu", true, .6);
        for (let f = 0; f < 10; f++) this.box(group, [.05, .34, 1.15], [x - .5 + f * .11, .73, -2.2], "#7f949c", "cpu");
        for (const z of [-3.05, -1.4]) for (let j = 0; j < 3; j++) this.box(group, [1.45, .29, .065], [x, .37, z + j * .12], "#183f39", "cpu");
      }
      // Eight accelerator modules. One GPU is foregrounded, seven retained for machine context.
      for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
        const x = -2.85 + col * 1.85, z = -.6 + row * 1.5;
        const part = row === 1 && col === 1 ? `${prefix}-gpu` : "";
        this.box(group, [1.55, .13, 1.22], [x, .36, z], "#4d7758", part, true);
        this.box(group, [.56, .15, .58], [x, .5, z], row === 1 && col === 1 ? "#6092a4" : C.chip, part, true, .65);
        for (const s of [-1, 1]) for (const dz of [-.22, .22]) this.box(group, [.23, .16, .25], [x + s * .48, .5, z + dz], C.memory, part);
      }
      this.box(group, [1.08, .27, .62], [2.9, .5, -2.5], "#99855d", "switch", true, .55);
      const nic = this.box(group, [1.2, .16, .74], [3, .46, 2.05], "#325f66", `${prefix}-nic`, true);
      this.box(nic, [.5, .19, .5], [0, .16, 0], C.steel, `${prefix}-nic`, true, .7);
      this.box(group, [.7, .43, .32], [3.06, .58, 2.55], C.steel, `${prefix}-nic`, true, .8);
      this.box(group, [.48, .22, .08], [3.06, .58, 2.74], C.dark, `${prefix}-nic`);
      // Independent branches meet at a logical switch, not a fictitious shared downstream wire.
      this.path(`${prefix}-pcie`, [[cx - 1, .7, .9], [cx + 1.8, .7, .9], [cx + 2.9, .7, -2.5], [cx + 3, .7, 2.05]], "#8397a0", .022);
      const lid = new THREE.Group(); lid.position.set(0, 1.3, 0); group.add(lid); this.lift(lid, 3.2, -8);
      lid.userData.lid = true;
      this.box(lid, [8.4, .1, 7.2], [0, 0, 0], "#b7c4ca", "cpu", true, .72);
      for (let i = 0; i < 12; i++) this.box(lid, [2.8, .012, .045], [0, .06, -1.7 + i * .24], "#62747e");
      this.label(target ? "TARGET / NEW REPLICA" : "SOURCE / WEIGHTS", [cx, .55, 4.2], 5.5);
      this.label(target ? "GPU B / HBM" : "GPU A / HBM", [cx - 1, 1.7, .85], 2.5);
      this.label("HCA", [cx + 3.05, 1.35, 2.05], 1.1);
      this.label("PCIe SW", [cx + 2.9, 1.3, -2.5], 1.75);
      if (target) {
        this.box(group, [4, .12, .2], [-1, .29, 2.3], "#1b3d37");
        this.fill = this.box(group, [4, .14, .22], [-1, .31, 2.3], C.data); this.fill.scale.x = .001;
      }
    };
    server(-5.3, false); server(5.3, true);
    this.box(this.model, [4.4, .64, 1.6], [0, .15, 6.2], "#3e5967", "network", true, .6);
    for (let i = 0; i < 12; i++) {
      this.box(this.model, [.23, .2, .08], [-1.85 + i * .335, .25, 7.02], C.dark, "network");
      this.box(this.model, [.045, .04, .1], [-1.8 + i * .335, .44, 7.03], "#84ba9e");
    }
    this.label("RDMA FABRIC", [0, 1.35, 6.2], 3.3);
    // Physical cables curve out of the server front toward the network switch.
    const left = [[-2.24, .65, 2.78], [-2.3, 1.6, 4.7], [-2, .7, 6.6]];
    const right = [[2, .7, 6.6], [7.9, 1.7, 5.1], [8.36, .65, 2.78]];
    this.path("cable-left", left, "#4e7c80", .1); this.path("cable-right", right, "#4e7c80", .1);
    this.path("request", [[8.3, .85, 2.55], [8, 1.85, 5], [0, 1, 6.3], [-2.3, 1.85, 4.5], [-2.3, .85, 2]], C.request, .038);
    this.path("source", [[-6.3, .86, .9], [-3.5, .86, .9], [-2.4, .86, -2.5], [-2.3, .86, 2.05]], C.data, .038);
    this.path("network", [[-2.3, .92, 2.05], [-2.3, 1.85, 4.5], [0, 1, 6.3], [8, 1.85, 5], [8.3, .92, 2.05]], C.data, .038);
    this.path("target", [[8.3, .86, 2.05], [8.2, .86, -2.5], [7.1, .86, .9], [4.3, .86, .9]], C.data, .038);
    this.path("setup", [[4.1, 1.1, -2.2], [4, 1.3, -.5], [4.3, .86, .9]], C.request, .035);
    this.warning = this.label("!  MR LIFETIME", [8.2, 1.9, -1.7], 3.2);
    this.warning.material.color.set("#ffb4a7"); this.warning.visible = false;
    this.labels.visible = this.labelsVisible;
    this.setExplosion(65, true); this.preset("iso"); this.needsRender = true;
  }
  setExplosion(value: number, instant = false) {
    this.targetExplosion = THREE.MathUtils.clamp(value / 100, 0, 1);
    if (instant || this.reduced.matches) this.explosion = this.targetExplosion;
    this.needsRender = true;
  }
  setStep(step: HardwareStep) {
    this.route = step.route; this.kind = step.kind;
    this.setExplosion(step.explode);
    if (this.fill) { this.fill.scale.x = Math.max(.001, step.progress / 100); this.fill.position.x = -3 + 2 * step.progress / 100; }
    this.highlight(step.part); this.needsRender = true;
    if (this.warning) this.warning.visible = step.kind === "error";
  }
  highlight(part: string) {
    this.lastSelection = part;
    this.disposeTree(this.selection); this.selection.clear();
    // Emissive tint marks all matching components; a single bounding rectangle would imply false physical unity.
    for (const mesh of this.pickables) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.set(mesh.userData.part === part ? this.kind === "error" ? "#bc302b" : "#12646b" : "#000000"); mat.emissiveIntensity = this.kind === "error" ? .6 : .2;
    }
    this.needsRender = true;
  }
  showLabels(show: boolean) {
    this.labelsVisible = show;
    this.model.traverse(o => { if (o instanceof THREE.Sprite) o.visible = show; });
    this.labels.visible = show; this.needsRender = true;
  }
  zoom(factor: number) { this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * factor, .65, 2.8); this.camera.updateProjectionMatrix(); this.needsRender = true; }
  preset(view: string) {
    this.controls.target.set(0, this.mode === "card" ? 1.7 : 1.8, this.mode === "card" ? -.5 : .6);
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3(...(view === "top" ? [0, 24, .01] : view === "front" ? [0, 8, 24] : [12, 18, 20]) as [number, number, number]));
    this.camera.zoom = 1; this.controls.update(); this.resize(); this.needsRender = true;
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    const aspect = w / h, extent = Math.max(this.extent * .64, this.extent / aspect);
    Object.assign(this.camera, { left: -extent * aspect, right: extent * aspect, top: extent, bottom: -extent });
    this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h, false); this.needsRender = true;
  }
  tick(time: number) {
    if (this.stopped) return;
    const dt = Math.min((time - this.lastTime) / 1000, .05); this.lastTime = time;
    if (this.visible && !document.hidden) {
      const moving = Math.abs(this.targetExplosion - this.explosion) > .001;
      if (moving) this.explosion += (this.targetExplosion - this.explosion) * Math.min(1, dt * 8);
      if (this.playing && !this.reduced.matches) this.phase += dt * .24;
      if (moving || this.needsRender || (this.playing && !this.reduced.matches)) {
        for (const item of this.moving) {
          item.object.position.y = item.base + item.lift * this.explosion; item.object.position.z = item.z + item.slide * this.explosion;
          if (item.object.userData.lid) item.object.visible = this.explosion < .6;
        }
        this.model.traverse(o => {
          if (o instanceof THREE.Sprite && o !== this.warning) o.visible = this.labelsVisible && (!o.userData.interior || this.explosion > .22);
        });
        if (this.warning) this.warning.visible = this.kind === "error";
        for (const path of this.paths) {
          const active = path.key === this.route;
          const physical = path.key.startsWith("cable") || path.key.endsWith("pcie");
          path.line.visible = active || physical;
          path.dots.forEach((dot, i) => { dot.visible = active; dot.position.copy(path.curve.getPointAt((this.phase + i / path.dots.length) % 1)); });
        }
        this.renderer.render(this.scene, this.camera); this.needsRender = false;
      }
    }
    this.raf = requestAnimationFrame(t => this.tick(t));
  }
  disposeTree(root: THREE.Object3D) {
    root.traverse(o => {
      const mesh = o as THREE.Mesh; mesh.geometry?.dispose();
      if (!mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) { (mat as THREE.MeshStandardMaterial).map?.dispose(); mat.dispose(); }
    });
  }
  dispose() { this.stopped = true; cancelAnimationFrame(this.raf); this.abort.abort(); this.observer.disconnect(); this.controls.dispose(); this.disposeTree(this.scene); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
