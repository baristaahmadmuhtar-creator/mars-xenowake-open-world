import * as THREE from 'three';
import AudioEngine from './AudioEngine';
import { InputController } from './InputController';
import type { Quality } from './storage';

const WORLD_SIZE = 190;
const WORLD_LIMIT = 88;
const FIXED_STEP = 1 / 60;
const PULSE_COOLDOWN = 2.35;
const DASH_COOLDOWN = 2.8;
const CYAN = 0x46f6e6;

const BEACON_LAYOUT = [
  { name: 'Menara Valles', x: -49, z: -37 },
  { name: 'Menara Eos', x: 52, z: -32 },
  { name: 'Menara Noctis', x: 17, z: 59 },
] as const;

const XENITE_LAYOUT = [
  { x: -35, z: -29 },
  { x: -57, z: -47 },
  { x: 39, z: -22 },
  { x: 59, z: -46 },
  { x: 7, z: 43 },
  { x: 29, z: 66 },
  { x: -17, z: 24 },
] as const;

const DRONE_LAYOUT = [
  { x: -30, z: -19 },
  { x: 34, z: -19 },
  { x: -2, z: 41 },
  { x: -58, z: -45 },
  { x: 54, z: 47 },
] as const;

export interface HudObjective {
  x: number;
  z: number;
  active: boolean;
}

export interface HudDrone {
  x: number;
  z: number;
  alert: boolean;
}

export interface HudState {
  health: number;
  xenite: number;
  beacons: number;
  objectiveLabel: string;
  elapsedMs: number;
  pulseRemaining: number;
  dashRemaining: number;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  objectives: HudObjective[];
  drones: HudDrone[];
  portalActive: boolean;
}

export interface WinStats {
  elapsedMs: number;
  collected: number;
  damageTaken: number;
}

export interface GameCallbacks {
  onHud: (state: HudState) => void;
  onToast: (message: string, tone?: 'normal' | 'warning' | 'success') => void;
  onInteract: (label: string | null, enabled: boolean) => void;
  onDamage: () => void;
  onRespawn: () => void;
  onWin: (stats: WinStats) => void;
  onPauseRequest: () => void;
  onAutoQuality: (fps: number) => void;
  onContextStatus: (status: 'lost' | 'restored') => void;
}

interface Beacon {
  name: string;
  group: THREE.Group;
  position: THREE.Vector3;
  coreMaterial: THREE.MeshStandardMaterial;
  beamMaterial: THREE.MeshBasicMaterial;
  haloMaterial: THREE.MeshBasicMaterial;
  active: boolean;
}

interface Xenite {
  group: THREE.Group;
  baseY: number;
  collected: boolean;
}

interface Drone {
  group: THREE.Group;
  home: THREE.Vector3;
  coreMaterial: THREE.MeshStandardMaterial;
  orbit: number;
  stunned: number;
  attackCooldown: number;
  chaseTimer: number;
  alert: boolean;
}

interface Portal {
  group: THREE.Group;
  ring: THREE.Mesh;
  ringMaterial: THREE.MeshStandardMaterial;
  disc: THREE.Mesh;
  discMaterial: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  active: boolean;
}

type Phase = 'menu' | 'playing' | 'paused' | 'won';

function terrainHeight(x: number, z: number): number {
  const broad = Math.sin(x * 0.049) * 1.15 + Math.cos(z * 0.043) * 0.9;
  const ridges = Math.sin((x + z) * 0.027) * 1.1 + Math.cos((x - z) * 0.034) * 0.55;
  const crater = -Math.exp(-(x * x + (z - 9) * (z - 9)) / 520) * 1.4;
  const edge = Math.max(0, Math.hypot(x, z) - 72) / 17;
  return broad + ridges + crater + edge * edge * 19;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function damp(current: number, target: number, lambda: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta));
}

function angleDamp(current: number, target: number, lambda: number, delta: number): number {
  let difference = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return current + difference * (1 - Math.exp(-lambda * delta));
}

export class XenowakeGame {
  public readonly isSupported: boolean;

  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: GameCallbacks;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 520);
  private readonly input: InputController;
  private readonly audio: AudioEngine;
  private readonly renderer: THREE.WebGLRenderer | null;
  private readonly player = new THREE.Group();
  private readonly playerMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly playerLimbs: THREE.Object3D[] = [];
  private readonly beacons: Beacon[] = [];
  private readonly xenites: Xenite[] = [];
  private readonly drones: Drone[] = [];
  private dust: THREE.Points | null = null;
  private readonly velocity = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly targetCamera = new THREE.Vector3();
  private readonly cameraLook = new THREE.Vector3();
  private readonly spawn = new THREE.Vector3(0, 0, 16);
  private readonly pulseRing: THREE.Mesh;
  private readonly pulseMaterial: THREE.MeshBasicMaterial;
  private readonly portal: Portal;
  private readonly handleResize = (): void => this.resize();
  private readonly handleVisibility = (): void => {
    if (document.visibilityState !== 'visible' && this.phase === 'playing') {
      this.setPaused(true);
      this.callbacks.onPauseRequest();
    }
  };

  private phase: Phase = 'menu';
  private quality: Quality;
  private frameId = 0;
  private previousFrame = performance.now();
  private accumulator = 0;
  private elapsed = 0;
  private hudTimer = 0;
  private performanceWarmupSeconds = 0;
  private performanceSampleSeconds = 0;
  private performanceSampleFrames = 0;
  private autoQualityTriggered = false;
  private cameraYaw = 0;
  private cameraPitch = 0.34;
  private playerHeading = Math.PI;
  private walkCycle = 0;
  private health = 3;
  private xeniteCount = 0;
  private collectedCount = 0;
  private beaconsActive = 0;
  private damageTaken = 0;
  private pulseCooldown = 0;
  private dashCooldown = 0;
  private dashTimer = 0;
  private pulseTimer = 0;
  private invulnerability = 0;
  private respawnTimer = 0;
  private boundaryToastCooldown = 0;
  private contextLost = false;
  private currentInteraction: Beacon | 'portal' | null = null;
  private lastInteractionLabel = '';

  public constructor(
    canvas: HTMLCanvasElement,
    root: HTMLElement,
    callbacks: GameCallbacks,
    quality: Quality,
    muted: boolean,
  ) {
    this.canvas = canvas;
    this.root = root;
    this.callbacks = callbacks;
    this.quality = quality;
    this.input = new InputController(root, canvas);
    this.audio = new AudioEngine(muted);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      const context = canvas.getContext('webgl2', {
        alpha: false,
        antialias: quality === 'high',
        depth: true,
        powerPreference: 'high-performance',
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
      });
      if (context) {
        renderer = new THREE.WebGLRenderer({
          canvas,
          context,
          antialias: quality === 'high',
          alpha: false,
          powerPreference: 'high-performance',
        });
      }
    } catch {
      renderer = null;
    }

    this.renderer = renderer;
    this.isSupported = renderer !== null;

    this.pulseMaterial = new THREE.MeshBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.98, 48), this.pulseMaterial);
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.pulseRing.visible = false;

    this.portal = this.createPortal();

    if (renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
      renderer.shadowMap.enabled = quality === 'high';
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.setClearColor(0x160a08, 1);

      this.scene.background = new THREE.Color(0x160a08);
      this.scene.fog = new THREE.FogExp2(0x733326, quality === 'high' ? 0.0082 : 0.011);
      this.buildScene();
      this.setQuality(quality);
      this.resize();
      this.resetSession();

      window.addEventListener('resize', this.handleResize, { passive: true });
      window.visualViewport?.addEventListener('resize', this.handleResize, { passive: true });
      document.addEventListener('visibilitychange', this.handleVisibility);
      canvas.addEventListener('webglcontextlost', this.onContextLost, false);
      canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
      this.frameId = requestAnimationFrame(this.frame);
    }
  }

  public async start(): Promise<void> {
    if (!this.renderer) return;
    this.resetSession();
    this.phase = 'playing';
    this.previousFrame = performance.now();
    await this.audio.start();
    this.callbacks.onToast('Tiga menara. Satu jalan pulang.', 'normal');
  }

  public async resume(): Promise<void> {
    if (!this.renderer || this.contextLost || this.phase === 'won') return;
    this.phase = 'playing';
    this.previousFrame = performance.now();
    this.accumulator = 0;
    await this.audio.resume();
  }

  public setPaused(paused: boolean): void {
    if (paused && this.phase === 'playing') {
      this.phase = 'paused';
      void this.audio.pause();
      return;
    }
    if (!paused && this.phase === 'paused') void this.resume();
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public setQuality(quality: Quality, resetGovernor = true): void {
    this.quality = quality;
    if (resetGovernor) {
      this.performanceWarmupSeconds = 0;
      this.performanceSampleSeconds = 0;
      this.performanceSampleFrames = 0;
      this.autoQualityTriggered = false;
    }
    if (!this.renderer) return;
    const ratio = quality === 'high' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio));
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = quality === 'high' ? 0.0082 : 0.011;
    }
    this.renderer.shadowMap.enabled = quality === 'high';
    if (this.dust) this.dust.visible = quality === 'high';
    this.resize();
  }

  public dispose(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.input.dispose();
    this.audio.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.renderer?.dispose();
  }

  private buildScene(): void {
    this.createSky();

    const hemisphere = new THREE.HemisphereLight(0xffc09b, 0x210b16, 1.7);
    this.scene.add(hemisphere);
    const sunLight = new THREE.DirectionalLight(0xffd0a0, 2.45);
    sunLight.position.set(-55, 80, -38);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 180;
    sunLight.shadow.camera.left = -92;
    sunLight.shadow.camera.right = 92;
    sunLight.shadow.camera.top = 92;
    sunLight.shadow.camera.bottom = -92;
    sunLight.shadow.bias = -0.0007;
    this.scene.add(sunLight);
    const cyanFill = new THREE.DirectionalLight(0x5efbe9, 0.34);
    cyanFill.position.set(40, 18, 50);
    this.scene.add(cyanFill);

    this.createTerrain();
    this.createRocks();
    this.createDecorativeCrystals();
    this.createCrashSite();
    this.createBeacons();
    this.createXenites();
    this.createDrones();
    this.createPlayer();
    this.createDust();
    this.scene.add(this.pulseRing);
  }

  private createSky(): void {
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x05060d) },
        horizonColor: { value: new THREE.Color(0x82321f) },
        groundColor: { value: new THREE.Color(0xe06a32) },
        sunDirection: { value: new THREE.Vector3(0.55, 0.14, 0.82).normalize() },
      },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 groundColor;
        uniform vec3 sunDirection;
        varying vec3 vDirection;
        void main() {
          float h = vDirection.y;
          vec3 color = mix(groundColor, horizonColor, smoothstep(-0.16, 0.08, h));
          color = mix(color, topColor, smoothstep(0.02, 0.72, h));
          float sun = pow(max(dot(normalize(vDirection), sunDirection), 0.0), 260.0);
          float glow = pow(max(dot(normalize(vDirection), sunDirection), 0.0), 14.0);
          color += vec3(1.0, 0.43, 0.16) * glow * 0.42 + vec3(1.0, 0.86, 0.62) * sun * 1.8;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(360, 24, 16), skyMaterial);
    this.scene.add(sky);

    const random = mulberry32(9017);
    const stars = new Float32Array(270 * 3);
    for (let index = 0; index < 270; index += 1) {
      const theta = random() * Math.PI * 2;
      const height = 70 + random() * 210;
      const radius = 285;
      stars[index * 3] = Math.cos(theta) * radius;
      stars[index * 3 + 1] = height;
      stars[index * 3 + 2] = Math.sin(theta) * radius;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.scene.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({ color: 0xffe0cf, size: 0.52, transparent: true, opacity: 0.7 }),
      ),
    );

    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xf4b49a, fog: false });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 10), moonMaterial);
    moon.position.set(105, 72, -210);
    this.scene.add(moon);
    const moonTwo = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), moonMaterial.clone());
    moonTwo.position.set(84, 82, -205);
    this.scene.add(moonTwo);
  }

  private createTerrain(): void {
    const segments = this.quality === 'high' ? 64 : 44;
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);
    const low = new THREE.Color(0x481813);
    const mid = new THREE.Color(0x7f2d1e);
    const high = new THREE.Color(0xb95532);
    const color = new THREE.Color();
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const y = terrainHeight(x, z);
      positions.setY(index, y);
      const variation = Math.sin(x * 0.4 + z * 0.27) * 0.05;
      color.copy(mid).lerp(y > 3 ? high : low, Math.min(0.5, Math.abs(y) * 0.065 + 0.16 + variation));
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.98,
      metalness: 0.02,
      flatShading: true,
    });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    this.scene.add(terrain);
  }

  private createRocks(): void {
    const random = mulberry32(44192);
    const count = this.quality === 'high' ? 185 : 120;
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    geometry.scale(1, 1.3, 0.9);
    const material = new THREE.MeshStandardMaterial({
      color: 0x6c2b22,
      roughness: 0.96,
      metalness: 0.04,
      flatShading: true,
    });
    const rocks = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const tint = new THREE.Color();
    let placed = 0;
    while (placed < count) {
      const angle = random() * Math.PI * 2;
      const edgeRock = placed < Math.floor(count * 0.27);
      const radius = edgeRock ? 73 + random() * 18 : 12 + Math.sqrt(random()) * 72;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const blocked = BEACON_LAYOUT.some((point) => Math.hypot(point.x - x, point.z - z) < 6);
      if (blocked || Math.hypot(x, z - 10) < 12) continue;
      position.set(x, terrainHeight(x, z) + 0.3, z);
      quaternion.setFromEuler(new THREE.Euler(random() * 0.25, random() * Math.PI * 2, random() * 0.2));
      const size = edgeRock ? 2 + random() * 4.6 : 0.4 + random() * 1.9;
      scale.set(size * (0.7 + random() * 0.8), size * (0.7 + random() * 1.5), size);
      matrix.compose(position, quaternion, scale);
      rocks.setMatrixAt(placed, matrix);
      tint.set(edgeRock ? 0x55211d : random() > 0.5 ? 0x7d3325 : 0x963d29);
      rocks.setColorAt(placed, tint);
      placed += 1;
    }
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    this.scene.add(rocks);
  }

  private createDecorativeCrystals(): void {
    const random = mulberry32(8137);
    const count = this.quality === 'high' ? 76 : 42;
    const geometry = new THREE.OctahedronGeometry(0.42, 0);
    geometry.scale(0.72, 2.8, 0.72);
    const material = new THREE.MeshStandardMaterial({
      color: 0x2bd8ca,
      emissive: 0x18b9ae,
      emissiveIntensity: 1.15,
      roughness: 0.24,
      metalness: 0.18,
      flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < count; index += 1) {
      const anchor = BEACON_LAYOUT[index % BEACON_LAYOUT.length];
      const angle = random() * Math.PI * 2;
      const radius = 6 + random() * 17;
      const x = anchor.x + Math.cos(angle) * radius;
      const z = anchor.z + Math.sin(angle) * radius;
      position.set(x, terrainHeight(x, z) + 0.65, z);
      quaternion.setFromEuler(new THREE.Euler((random() - 0.5) * 0.3, random() * Math.PI, (random() - 0.5) * 0.3));
      const size = 0.55 + random() * 1.1;
      scale.setScalar(size);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
  }

  private createCrashSite(): void {
    const group = new THREE.Group();
    const crashX = -11;
    const crashZ = 1;
    const groundY = terrainHeight(crashX, crashZ);
    group.position.set(crashX, groundY, crashZ);
    group.scale.setScalar(0.82);

    const dark = new THREE.MeshStandardMaterial({ color: 0x19151b, roughness: 0.7, metalness: 0.7 });
    const hull = new THREE.Mesh(new THREE.ConeGeometry(2.4, 10, 5), dark);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = -0.25;
    hull.position.set(-5.5, 1.8, 2.7);
    group.add(hull);
    const wingGeometry = new THREE.BufferGeometry();
    wingGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, -7, 0.1, 3, -5, 0.25, -3], 3),
    );
    wingGeometry.computeVertexNormals();
    const wing = new THREE.Mesh(wingGeometry, dark);
    wing.position.set(-3, 1.1, 1.5);
    group.add(wing);

    const emberMaterial = new THREE.MeshBasicMaterial({ color: 0xff7b32 });
    for (let index = 0; index < 4; index += 1) {
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.12 + index * 0.03, 6, 4), emberMaterial);
      ember.position.set(-8 + index * 0.6, 0.8 + index * 0.25, 2.3 - index * 0.35);
      group.add(ember);
    }
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    this.portal.ring.castShadow = true;
    this.portal.ring.receiveShadow = true;
    this.scene.add(group);
    this.scene.add(this.portal.group);
  }

  private createPlayer(): void {
    const skin = new THREE.MeshStandardMaterial({
      color: 0x493657,
      roughness: 0.58,
      metalness: 0.08,
      flatShading: true,
    });
    const skinLight = new THREE.MeshStandardMaterial({
      color: 0x72547c,
      roughness: 0.5,
      flatShading: true,
    });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x17141c, roughness: 0.9, flatShading: true });
    this.playerMaterials.push(skin, skinLight, cloth);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.8, 4, 8), cloth);
    torso.position.y = 1.4;
    torso.scale.set(0.9, 1, 0.72);
    this.player.add(torso);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 1), skinLight);
    head.position.set(0, 2.45, -0.08);
    head.scale.set(0.9, 0.82, 1.16);
    this.player.add(head);

    const eyeMaterial = new THREE.MeshBasicMaterial({ color: CYAN });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 5), eyeMaterial);
      eye.position.set(side * 0.25, 2.5, -0.61);
      eye.scale.set(1.4, 0.65, 0.35);
      this.player.add(eye);
    }

    const crestMaterial = skin.clone();
    this.playerMaterials.push(crestMaterial);
    for (let index = 0; index < 4; index += 1) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.16 + index * 0.025, 0.72, 4), crestMaterial);
      crest.rotation.x = Math.PI / 2.45;
      crest.position.set(0, 2.55 - index * 0.08, 0.4 + index * 0.22);
      this.player.add(crest);
    }

    const limbGeometry = new THREE.CapsuleGeometry(0.12, 0.72, 3, 5);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(limbGeometry, skin);
      arm.position.set(side * 0.56, 1.42, 0);
      arm.rotation.z = side * 0.18;
      this.player.add(arm);
      this.playerLimbs.push(arm);
      const leg = new THREE.Mesh(limbGeometry, skin);
      leg.position.set(side * 0.25, 0.45, 0.02);
      this.player.add(leg);
      this.playerLimbs.push(leg);
    }

    const packMaterial = new THREE.MeshStandardMaterial({
      color: 0x233838,
      emissive: 0x0d5f59,
      emissiveIntensity: 1.2,
      roughness: 0.6,
      metalness: 0.45,
    });
    this.playerMaterials.push(packMaterial);
    const pack = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), packMaterial);
    pack.position.set(0, 1.62, 0.48);
    this.player.add(pack);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.82, 20),
      new THREE.MeshBasicMaterial({ color: 0x140708, transparent: true, opacity: 0.38, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    this.player.add(shadow);
    this.player.traverse((object) => {
      if (object instanceof THREE.Mesh && object !== shadow) object.castShadow = true;
    });
    this.scene.add(this.player);
  }

  private createBeacons(): void {
    for (const layout of BEACON_LAYOUT) {
      const group = new THREE.Group();
      const groundY = terrainHeight(layout.x, layout.z);
      group.position.set(layout.x, groundY, layout.z);
      const stone = new THREE.MeshStandardMaterial({
        color: 0x2d2226,
        roughness: 0.72,
        metalness: 0.38,
        flatShading: true,
      });
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: 0x355f5b,
        emissive: 0x163f3c,
        emissiveIntensity: 0.7,
        roughness: 0.25,
        metalness: 0.65,
      });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 5.2, 1.5, 6), stone);
      base.position.y = 0.75;
      group.add(base);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 13.5, 5), stone);
      spire.position.y = 7.7;
      group.add(spire);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0), coreMaterial);
      core.position.y = 14.55;
      group.add(core);
      const beamMaterial = new THREE.MeshBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.5, 75, 8, 1, true), beamMaterial);
      beam.position.y = 52;
      group.add(beam);
      const haloMaterial = new THREE.MeshBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.08, 6, 42), haloMaterial);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 14.5;
      group.add(halo);
      const position = new THREE.Vector3(layout.x, groundY, layout.z);
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      this.beacons.push({ name: layout.name, group, position, coreMaterial, beamMaterial, haloMaterial, active: false });
      this.scene.add(group);
    }
  }

  private createXenites(): void {
    for (const layout of XENITE_LAYOUT) {
      const group = new THREE.Group();
      const y = terrainHeight(layout.x, layout.z) + 1.3;
      group.position.set(layout.x, y, layout.z);
      const material = new THREE.MeshStandardMaterial({
        color: 0x76fff3,
        emissive: 0x26d9ca,
        emissiveIntensity: 2.1,
        roughness: 0.18,
        metalness: 0.25,
        flatShading: true,
      });
      const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0), material);
      main.scale.set(0.75, 1.55, 0.75);
      group.add(main);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 5, 28), ringMaterial);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      this.xenites.push({ group, baseY: y, collected: false });
      this.scene.add(group);
    }
  }

  private createPortal(): Portal {
    const group = new THREE.Group();
    const groundY = terrainHeight(0, 8);
    group.position.set(0, groundY + 7.1, 8);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x202328,
      emissive: 0x102825,
      emissiveIntensity: 0.35,
      roughness: 0.34,
      metalness: 0.82,
      flatShading: true,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.1, 0.62, 8, 36), ringMaterial);
    group.add(ring);
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(5.4, 0.12, 5, 32),
      new THREE.MeshBasicMaterial({ color: 0x245b55, transparent: true, opacity: 0.45 }),
    );
    group.add(inner);
    const discMaterial = new THREE.MeshBasicMaterial({
      color: 0x52f7e8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(5.25, 48), discMaterial);
    disc.position.z = 0.05;
    group.add(disc);
    const light = new THREE.PointLight(CYAN, 0, 24, 2);
    light.position.z = 1;
    group.add(light);
    return { group, ring, ringMaterial, disc, discMaterial, light, active: false };
  }

  private createDrones(): void {
    for (let index = 0; index < DRONE_LAYOUT.length; index += 1) {
      const layout = DRONE_LAYOUT[index];
      const group = new THREE.Group();
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: 0x2b252a,
        emissive: 0xc03224,
        emissiveIntensity: 2.6,
        metalness: 0.76,
        roughness: 0.3,
        flatShading: true,
      });
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), coreMaterial);
      group.add(core);
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x19191d,
        metalness: 0.8,
        roughness: 0.38,
      });
      const frame = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.12, 5, 18), frameMaterial);
      frame.rotation.x = Math.PI / 2;
      group.add(frame);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 5), new THREE.MeshBasicMaterial({ color: 0xff5038 }));
      eye.position.z = -0.56;
      group.add(eye);
      const y = terrainHeight(layout.x, layout.z) + 3.1;
      group.position.set(layout.x, y, layout.z);
      const home = new THREE.Vector3(layout.x, 0, layout.z);
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) object.castShadow = true;
      });
      this.drones.push({
        group,
        home,
        coreMaterial,
        orbit: index * 1.7,
        stunned: 0,
        attackCooldown: 0,
        chaseTimer: 0,
        alert: false,
      });
      this.scene.add(group);
    }
  }

  private createDust(): void {
    const random = mulberry32(301);
    const count = 360;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() - 0.5) * 150;
      positions[index * 3 + 1] = 0.5 + random() * 16;
      positions[index * 3 + 2] = (random() - 0.5) * 150;
    }
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    geometry.setAttribute('position', attribute);
    const material = new THREE.PointsMaterial({
      color: 0xf4a06a,
      size: 0.13,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    this.dust = points;
    this.scene.add(points);
  }

  private resetSession(): void {
    this.elapsed = 0;
    this.performanceWarmupSeconds = 0;
    this.performanceSampleSeconds = 0;
    this.performanceSampleFrames = 0;
    this.health = 3;
    this.xeniteCount = 0;
    this.collectedCount = 0;
    this.beaconsActive = 0;
    this.damageTaken = 0;
    this.pulseCooldown = 0;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.pulseTimer = 0;
    this.invulnerability = 0;
    this.respawnTimer = 0;
    this.boundaryToastCooldown = 0;
    this.velocity.set(0, 0, 0);
    this.spawn.y = terrainHeight(this.spawn.x, this.spawn.z);
    this.player.position.copy(this.spawn);
    this.player.rotation.y = 0;
    this.playerHeading = 0;
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.34;
    this.camera.position.set(0, this.spawn.y + 6.2, this.spawn.z - 9.5);

    for (const beacon of this.beacons) {
      beacon.active = false;
      beacon.coreMaterial.color.setHex(0x355f5b);
      beacon.coreMaterial.emissive.setHex(0x163f3c);
      beacon.coreMaterial.emissiveIntensity = 0.7;
      beacon.beamMaterial.opacity = 0.16;
      beacon.haloMaterial.opacity = 0.3;
    }
    for (const xenite of this.xenites) {
      xenite.collected = false;
      xenite.group.visible = true;
    }
    for (let index = 0; index < this.drones.length; index += 1) {
      const drone = this.drones[index];
      const layout = DRONE_LAYOUT[index];
      drone.group.position.set(layout.x, terrainHeight(layout.x, layout.z) + 3.1, layout.z);
      drone.stunned = 0;
      drone.attackCooldown = 0;
      drone.chaseTimer = 0;
      drone.alert = false;
      drone.coreMaterial.emissive.setHex(0xc03224);
      drone.group.visible = index < 2;
    }
    this.portal.active = false;
    this.portal.ringMaterial.color.setHex(0x202328);
    this.portal.ringMaterial.emissive.setHex(0x102825);
    this.portal.ringMaterial.emissiveIntensity = 0.35;
    this.portal.discMaterial.opacity = 0;
    this.portal.light.intensity = 0;
    this.pulseRing.visible = false;
    this.phase = 'menu';
    this.audio.setIntensity(0);
    this.updateInteraction(true);
    this.emitHud();
  }

  private readonly frame = (time: number): void => {
    this.frameId = requestAnimationFrame(this.frame);
    if (!this.renderer || this.contextLost) return;
    const rawDelta = Math.max(0, (time - this.previousFrame) / 1000);
    this.previousFrame = time;
    const delta = Math.min(rawDelta, 0.05);

    if (this.input.isPausePressed() && this.phase === 'playing') {
      this.setPaused(true);
      this.callbacks.onPauseRequest();
    }

    if (this.phase === 'playing') {
      this.updatePerformanceGovernor(rawDelta);
      this.cameraYaw -= this.input.look.x * 4.1;
      this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + this.input.look.y * 2.9, 0.17, 0.78);
      const pulsePressed = this.input.consumePulse();
      const dashPressed = this.input.consumeDash();
      const interactPressed = this.input.consumeInteract();
      if (pulsePressed) this.tryPulse();
      if (dashPressed) this.tryDash();
      if (interactPressed) this.tryInteract();
      this.accumulator = Math.min(this.accumulator + delta, FIXED_STEP * 3);
      while (this.accumulator >= FIXED_STEP) {
        this.updateFixed(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
      }
    } else {
      this.updateAmbient(delta, time / 1000);
    }

    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);
    this.input.resetFrame();
  };

  private updatePerformanceGovernor(rawDelta: number): void {
    if (
      this.quality !== 'high'
      || this.autoQualityTriggered
      || rawDelta <= 0
      || rawDelta > 0.5
    ) {
      return;
    }

    const measuredDelta = Math.min(rawDelta, 0.1);
    this.performanceWarmupSeconds += measuredDelta;
    if (this.performanceWarmupSeconds < 10) return;

    this.performanceSampleSeconds += measuredDelta;
    this.performanceSampleFrames += 1;
    if (this.performanceSampleSeconds < 5) return;

    const fps = this.performanceSampleFrames / this.performanceSampleSeconds;
    this.performanceSampleSeconds = 0;
    this.performanceSampleFrames = 0;
    if (fps >= 27) return;

    this.autoQualityTriggered = true;
    this.setQuality('low', false);
    this.callbacks.onAutoQuality(fps);
  }

  private updateFixed(delta: number): void {
    this.elapsed += delta;
    this.hudTimer += delta;
    this.pulseCooldown = Math.max(0, this.pulseCooldown - delta);
    this.dashCooldown = Math.max(0, this.dashCooldown - delta);
    this.dashTimer = Math.max(0, this.dashTimer - delta);
    this.pulseTimer = Math.max(0, this.pulseTimer - delta);
    this.invulnerability = Math.max(0, this.invulnerability - delta);
    this.boundaryToastCooldown = Math.max(0, this.boundaryToastCooldown - delta);

    if (this.respawnTimer > 0) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) this.finishRespawn();
    } else {
      this.updatePlayer(delta);
      this.collectNearbyXenite();
      this.updateDrones(delta);
      this.updateInteraction(false);
    }
    this.updateAmbient(delta, this.elapsed);
    this.updatePulseVisual();
    if (this.hudTimer >= 0.085) {
      this.hudTimer = 0;
      this.emitHud();
    }
  }

  private updatePlayer(delta: number): void {
    this.forward.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    this.right.set(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    this.movement
      .copy(this.right)
      .multiplyScalar(this.input.move.x)
      .addScaledVector(this.forward, this.input.move.y);
    if (this.movement.lengthSq() > 1) this.movement.normalize();
    const moving = this.movement.lengthSq() > 0.002;
    const speed = this.dashTimer > 0 ? 17.5 : 6.5;
    const targetX = moving ? this.movement.x * speed : 0;
    const targetZ = moving ? this.movement.z * speed : 0;
    this.velocity.x = damp(this.velocity.x, targetX, this.dashTimer > 0 ? 18 : 11, delta);
    this.velocity.z = damp(this.velocity.z, targetZ, this.dashTimer > 0 ? 18 : 11, delta);
    this.player.position.x += this.velocity.x * delta;
    this.player.position.z += this.velocity.z * delta;

    const radius = Math.hypot(this.player.position.x, this.player.position.z);
    if (radius > WORLD_LIMIT) {
      const scale = WORLD_LIMIT / radius;
      this.player.position.x *= scale;
      this.player.position.z *= scale;
      this.velocity.multiplyScalar(0.25);
      if (this.boundaryToastCooldown <= 0) {
        this.boundaryToastCooldown = 4;
        this.callbacks.onToast('Badai terlalu pekat. Kembali ke lembah.', 'warning');
      }
    }
    this.player.position.y = terrainHeight(this.player.position.x, this.player.position.z);

    if (moving) {
      const targetHeading = Math.atan2(this.movement.x, this.movement.z);
      this.playerHeading = angleDamp(this.playerHeading, targetHeading, 13, delta);
      this.player.rotation.y = this.playerHeading;
      this.walkCycle += delta * (this.dashTimer > 0 ? 17 : 9.5);
    }
    const stride = moving ? Math.sin(this.walkCycle) * (this.dashTimer > 0 ? 0.82 : 0.52) : 0;
    for (let index = 0; index < this.playerLimbs.length; index += 1) {
      const direction = index % 2 === 0 ? 1 : -1;
      this.playerLimbs[index].rotation.x = damp(this.playerLimbs[index].rotation.x, stride * direction, 12, delta);
    }
  }

  private collectNearbyXenite(): void {
    for (const xenite of this.xenites) {
      if (xenite.collected) continue;
      const dx = xenite.group.position.x - this.player.position.x;
      const dz = xenite.group.position.z - this.player.position.z;
      if (dx * dx + dz * dz > 4.1) continue;
      xenite.collected = true;
      xenite.group.visible = false;
      this.xeniteCount += 1;
      this.collectedCount += 1;
      this.audio.play('pickup');
      this.callbacks.onToast('Xenite diserap  •  +1 energi', 'success');
      this.emitHud();
    }
  }

  private updateDrones(delta: number): void {
    const activeCount = Math.min(this.drones.length, 2 + this.beaconsActive);
    for (let index = 0; index < this.drones.length; index += 1) {
      const drone = this.drones[index];
      drone.group.visible = index < activeCount;
      if (!drone.group.visible) continue;
      drone.attackCooldown = Math.max(0, drone.attackCooldown - delta);
      const dx = this.player.position.x - drone.group.position.x;
      const dz = this.player.position.z - drone.group.position.z;
      const distanceSquared = dx * dx + dz * dz;

      if (drone.stunned > 0) {
        drone.stunned -= delta;
        drone.alert = false;
        drone.group.rotation.z = Math.sin(this.elapsed * 13) * 0.16;
        if (drone.stunned <= 0) {
          drone.coreMaterial.emissive.setHex(0xc03224);
          drone.group.rotation.z = 0;
        }
      } else {
        if (distanceSquared < 19 * 19) drone.chaseTimer = 4.2;
        else drone.chaseTimer = Math.max(0, drone.chaseTimer - delta);
        drone.alert = drone.chaseTimer > 0;

        if (drone.alert) {
          const inverse = 1 / Math.max(0.001, Math.sqrt(distanceSquared));
          drone.group.position.x += dx * inverse * 3.25 * delta;
          drone.group.position.z += dz * inverse * 3.25 * delta;
          drone.group.rotation.y = Math.atan2(dx, dz);
        } else {
          drone.orbit += delta * 0.42;
          const targetX = drone.home.x + Math.cos(drone.orbit) * 5.2;
          const targetZ = drone.home.z + Math.sin(drone.orbit) * 5.2;
          drone.group.position.x = damp(drone.group.position.x, targetX, 0.85, delta);
          drone.group.position.z = damp(drone.group.position.z, targetZ, 0.85, delta);
          drone.group.rotation.y += delta * 0.7;
        }

        if (distanceSquared < 2.5 * 2.5 && drone.attackCooldown <= 0 && this.invulnerability <= 0) {
          drone.attackCooldown = 1.5;
          this.takeDamage();
        }
      }
      const hover = 2.85 + Math.sin(this.elapsed * 2.4 + index) * 0.28;
      drone.group.position.y = terrainHeight(drone.group.position.x, drone.group.position.z) + hover;
      drone.group.rotation.x = Math.sin(this.elapsed * 2 + index) * 0.04;
    }
  }

  private takeDamage(): void {
    if (this.invulnerability > 0 || this.respawnTimer > 0) return;
    this.health -= 1;
    this.damageTaken += 1;
    this.invulnerability = 1.05;
    this.audio.play('hit');
    this.callbacks.onDamage();
    this.emitHud();
    if (navigator.vibrate) navigator.vibrate([28, 30, 45]);
    if (this.health <= 0) {
      this.respawnTimer = 1.25;
      this.velocity.set(0, 0, 0);
      this.callbacks.onRespawn();
    } else {
      this.callbacks.onToast('Cangkang rusak — jauhi penjaga', 'warning');
    }
  }

  private finishRespawn(): void {
    this.health = 3;
    this.player.position.copy(this.spawn);
    this.velocity.set(0, 0, 0);
    this.invulnerability = 1.8;
    for (let index = 0; index < this.drones.length; index += 1) {
      const drone = this.drones[index];
      const layout = DRONE_LAYOUT[index];
      drone.group.position.set(layout.x, terrainHeight(layout.x, layout.z) + 3.1, layout.z);
      drone.chaseTimer = 0;
      drone.alert = false;
    }
    this.callbacks.onToast('Tubuh diregenerasi. Sinyal tetap tersimpan.', 'normal');
    this.emitHud();
  }

  private tryPulse(): void {
    if (this.phase !== 'playing' || this.pulseCooldown > 0 || this.respawnTimer > 0) return;
    this.pulseCooldown = PULSE_COOLDOWN;
    this.pulseTimer = 0.52;
    this.pulseRing.visible = true;
    this.pulseMaterial.opacity = 0.85;
    this.pulseRing.scale.setScalar(0.5);
    this.audio.play('pulse');
    let hit = false;
    for (const drone of this.drones) {
      if (!drone.group.visible) continue;
      const dx = drone.group.position.x - this.player.position.x;
      const dz = drone.group.position.z - this.player.position.z;
      if (dx * dx + dz * dz > 8.3 * 8.3) continue;
      drone.stunned = 3.4;
      drone.chaseTimer = 0;
      drone.coreMaterial.emissive.setHex(CYAN);
      hit = true;
    }
    if (hit) this.callbacks.onToast('Penjaga dilumpuhkan sementara', 'success');
    if (navigator.vibrate) navigator.vibrate(24);
  }

  private tryDash(): void {
    if (this.phase !== 'playing' || this.dashCooldown > 0 || this.respawnTimer > 0) return;
    if (this.input.move.x * this.input.move.x + this.input.move.y * this.input.move.y < 0.04) return;
    this.dashCooldown = DASH_COOLDOWN;
    this.dashTimer = 0.28;
    this.invulnerability = Math.max(this.invulnerability, 0.38);
    this.audio.play('dash');
    if (navigator.vibrate) navigator.vibrate(14);
  }

  private tryInteract(): void {
    if (this.phase !== 'playing' || !this.currentInteraction || this.respawnTimer > 0) return;
    if (this.currentInteraction === 'portal') {
      if (this.portal.active) this.finishRun();
      return;
    }
    const beacon = this.currentInteraction;
    if (beacon.active) return;
    if (this.xeniteCount < 1) {
      this.callbacks.onToast('Menara membutuhkan 1 Xenite', 'warning');
      return;
    }
    this.xeniteCount -= 1;
    this.beaconsActive += 1;
    beacon.active = true;
    beacon.coreMaterial.color.setHex(0x9efff6);
    beacon.coreMaterial.emissive.setHex(CYAN);
    beacon.coreMaterial.emissiveIntensity = 4.2;
    beacon.beamMaterial.opacity = 0.42;
    beacon.haloMaterial.opacity = 0.75;
    this.audio.play('activate');
    this.audio.setIntensity(this.beaconsActive / 3);
    this.health = Math.min(3, this.health + 1);
    if (navigator.vibrate) navigator.vibrate([30, 25, 70]);
    if (this.beaconsActive === 3) {
      this.activatePortal();
      this.callbacks.onToast('Jaringan lengkap — portal terbuka di Crash Basin', 'success');
    } else {
      this.callbacks.onToast(`${beacon.name} aktif  •  ${this.beaconsActive}/3`, 'success');
    }
    this.updateInteraction(true);
    this.emitHud();
  }

  private activatePortal(): void {
    this.portal.active = true;
    this.portal.ringMaterial.color.setHex(0x69fff2);
    this.portal.ringMaterial.emissive.setHex(CYAN);
    this.portal.ringMaterial.emissiveIntensity = 3.2;
    this.portal.discMaterial.opacity = 0.38;
    this.portal.light.intensity = 9;
  }

  private finishRun(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'won';
    this.audio.play('win');
    this.callbacks.onInteract(null, false);
    this.callbacks.onWin({
      elapsedMs: Math.round(this.elapsed * 1000),
      collected: this.collectedCount,
      damageTaken: this.damageTaken,
    });
  }

  private updateInteraction(force: boolean): void {
    let interaction: Beacon | 'portal' | null = null;
    let label = '';
    let enabled = true;
    let closest = Number.POSITIVE_INFINITY;
    for (const beacon of this.beacons) {
      if (beacon.active) continue;
      const dx = beacon.position.x - this.player.position.x;
      const dz = beacon.position.z - this.player.position.z;
      const distance = dx * dx + dz * dz;
      if (distance < 5.2 * 5.2 && distance < closest) {
        closest = distance;
        interaction = beacon;
        label = this.xeniteCount > 0 ? `Aktifkan ${beacon.name}` : 'Butuh 1 Xenite';
        enabled = this.xeniteCount > 0;
      }
    }
    if (this.portal.active) {
      const dx = this.portal.group.position.x - this.player.position.x;
      const dz = this.portal.group.position.z - this.player.position.z;
      if (dx * dx + dz * dz < 7.3 * 7.3) {
        interaction = 'portal';
        label = 'Masuki portal';
        enabled = true;
      }
    }
    this.currentInteraction = interaction;
    if (force || label !== this.lastInteractionLabel) {
      this.lastInteractionLabel = label;
      this.callbacks.onInteract(label || null, enabled);
    }
  }

  private updatePulseVisual(): void {
    if (!this.pulseRing.visible) return;
    const progress = 1 - this.pulseTimer / 0.52;
    this.pulseRing.position.set(this.player.position.x, this.player.position.y + 0.08, this.player.position.z);
    this.pulseRing.scale.setScalar(0.6 + progress * 9.4);
    this.pulseMaterial.opacity = Math.max(0, (1 - progress) * 0.78);
    if (this.pulseTimer <= 0) this.pulseRing.visible = false;
  }

  private updateAmbient(delta: number, time: number): void {
    for (let index = 0; index < this.beacons.length; index += 1) {
      const beacon = this.beacons[index];
      beacon.group.rotation.y = Math.sin(time * 0.14 + index) * 0.012;
      beacon.haloMaterial.opacity = beacon.active
        ? 0.62 + Math.sin(time * 2.5 + index) * 0.16
        : 0.27 + Math.sin(time * 1.2 + index) * 0.07;
    }
    for (let index = 0; index < this.xenites.length; index += 1) {
      const xenite = this.xenites[index];
      if (xenite.collected) continue;
      xenite.group.position.y = xenite.baseY + Math.sin(time * 2.2 + index) * 0.24;
      xenite.group.rotation.y += delta * 0.85;
    }
    if (this.portal.active) {
      this.portal.ring.rotation.z += delta * 0.18;
      this.portal.disc.rotation.z -= delta * 0.28;
      this.portal.discMaterial.opacity = 0.34 + Math.sin(time * 2.1) * 0.08;
    }
    if (this.dust) this.dust.rotation.y += delta * 0.006;
  }

  private updateCamera(delta: number): void {
    const horizontal = Math.cos(this.cameraPitch) * 9.6;
    this.targetCamera.set(
      this.player.position.x + Math.sin(this.cameraYaw) * horizontal,
      this.player.position.y + 2.7 + Math.sin(this.cameraPitch) * 7.2,
      this.player.position.z + Math.cos(this.cameraYaw) * horizontal,
    );
    const cameraGround = terrainHeight(this.targetCamera.x, this.targetCamera.z) + 1.1;
    this.targetCamera.y = Math.max(this.targetCamera.y, cameraGround);
    const follow = this.phase === 'menu' ? 1.8 : 9;
    this.camera.position.lerp(this.targetCamera, 1 - Math.exp(-follow * Math.max(delta, 0.001)));
    this.cameraLook.set(this.player.position.x, this.player.position.y + 1.65, this.player.position.z);
    this.camera.lookAt(this.cameraLook);
  }

  private emitHud(): void {
    this.callbacks.onHud({
      health: this.health,
      xenite: this.xeniteCount,
      beacons: this.beaconsActive,
      objectiveLabel: this.getObjectiveLabel(),
      elapsedMs: Math.round(this.elapsed * 1000),
      pulseRemaining: this.pulseCooldown / PULSE_COOLDOWN,
      dashRemaining: this.dashCooldown / DASH_COOLDOWN,
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      playerHeading: this.playerHeading,
      objectives: this.beacons.map((beacon) => ({
        x: beacon.position.x,
        z: beacon.position.z,
        active: beacon.active,
      })),
      drones: this.drones
        .filter((drone) => drone.group.visible)
        .map((drone) => ({ x: drone.group.position.x, z: drone.group.position.z, alert: drone.alert })),
      portalActive: this.portal.active,
    });
  }

  private getObjectiveLabel(): string {
    const distanceFromPlayer = (position: THREE.Vector3): number => Math.hypot(
      position.x - this.player.position.x,
      position.z - this.player.position.z,
    );

    if (this.portal.active) {
      return `Kembali ke portal • ${Math.max(1, Math.round(distanceFromPlayer(this.portal.group.position)))} m`;
    }

    if (this.xeniteCount === 0) {
      let nearestXenite = Number.POSITIVE_INFINITY;
      for (const xenite of this.xenites) {
        if (xenite.collected) continue;
        nearestXenite = Math.min(nearestXenite, distanceFromPlayer(xenite.group.position));
      }
      if (Number.isFinite(nearestXenite)) {
        return `Cari Xenite • ${Math.max(1, Math.round(nearestXenite))} m`;
      }
    }

    let nearestBeacon: Beacon | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const beacon of this.beacons) {
      if (beacon.active) continue;
      const distance = distanceFromPlayer(beacon.position);
      if (distance >= nearestDistance) continue;
      nearestBeacon = beacon;
      nearestDistance = distance;
    }

    return nearestBeacon
      ? `${nearestBeacon.name} • ${Math.max(1, Math.round(nearestDistance))} m`
      : 'Jaringan lengkap • kembali ke Crash Basin';
  }

  private resize(): void {
    if (!this.renderer) return;
    const width = Math.max(1, this.root.clientWidth || window.innerWidth);
    const height = Math.max(1, this.root.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.setPaused(true);
    this.callbacks.onContextStatus('lost');
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.previousFrame = performance.now();
    this.accumulator = 0;
    this.setQuality(this.quality);
    this.callbacks.onContextStatus('restored');
  };
}
