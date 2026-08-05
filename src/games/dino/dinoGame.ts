import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { loadImage } from "@/lib/loadImage";

/** Which body landmark pair an obstacle checks for a hit. Indices follow the
 *  standard 33-point BlazePose topology used by MediaPipe. */
type LandmarkPair = readonly [number, number];

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

type ObstacleKind = "flyer" | "cactus-small" | "cactus-tall";

interface ObstacleDef {
  kind: ObstacleKind;
  /** Vertical center of the obstacle's lane, as a fraction of stage height. */
  laneY: number;
  /** Sprite width/height as a fraction of stage width — kept square. */
  size: number;
  /** Landmark pair the player must keep clear of this obstacle. */
  hitZone: LandmarkPair;
  src: string;
}

const OBSTACLES: ObstacleDef[] = [
  {
    kind: "flyer",
    laneY: 0.26,
    size: 0.14,
    hitZone: [LEFT_SHOULDER, RIGHT_SHOULDER],
    src: "/images/flying-dino.png",
  },
  {
    kind: "cactus-small",
    laneY: 0.78,
    size: 0.12,
    hitZone: [LEFT_HIP, RIGHT_HIP],
    src: "/images/cactus-small.png",
  },
  {
    kind: "cactus-tall",
    laneY: 0.76,
    size: 0.16,
    hitZone: [LEFT_HIP, RIGHT_HIP],
    src: "/images/cactus-tall.png",
  },
];

// BlazePose connections we draw for player feedback — trimmed to torso/limbs,
// skipping the dense face mesh so the overlay reads clearly on a small stage.
const SKELETON_CONNECTIONS: LandmarkPair[] = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

type GameState = "idle" | "loading" | "playing" | "gameover";

interface Obstacle {
  def: ObstacleDef;
  x: number; // px, in canvas coordinate space
  y: number; // px
  size: number; // px
  passed: boolean;
}

const BASE_SPEED = 260; // px/sec at score 0
const SPEED_PER_POINT = 12; // gentle ramp so it stays fun, not frantic
const SPAWN_GAP_MS = 1400;
const HIT_TOLERANCE_PX = 14; // extra forgiveness added to sprite radius

export class DinoGame {
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scoreEl: HTMLElement;
  private readonly finalScoreEl: HTMLElement;
  private readonly overlayStart: HTMLElement;
  private readonly overlayGameOver: HTMLElement;
  private readonly statusEl: HTMLElement;

  private poseLandmarker: PoseLandmarker | null = null;
  private sprites = new Map<ObstacleKind, HTMLImageElement>();

  private state: GameState = "idle";
  private score = 0;
  private obstacle: Obstacle | null = null;
  private msSinceLastSpawn = 0;
  private lastFrameTime = 0;
  private rafId = 0;
  private lastLandmarks: NormalizedLandmark[] | null = null;

  constructor(root: HTMLElement) {
    this.video = root.querySelector("#camera") as HTMLVideoElement;
    this.canvas = root.querySelector("#game-canvas") as HTMLCanvasElement;
    this.scoreEl = root.querySelector("#score-value") as HTMLElement;
    this.finalScoreEl = root.querySelector("#final-score") as HTMLElement;
    this.overlayStart = root.querySelector("#overlay-start") as HTMLElement;
    this.overlayGameOver = root.querySelector("#overlay-gameover") as HTMLElement;
    this.statusEl = root.querySelector("#stage-status") as HTMLElement;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

    root.querySelector("#btn-start")?.addEventListener("click", () => void this.start());
    root.querySelector("#btn-restart")?.addEventListener("click", () => void this.restart());
  }

  private setStatus(message: string | null): void {
    if (!message) {
      this.statusEl.hidden = true;
      return;
    }
    this.statusEl.hidden = false;
    this.statusEl.textContent = message;
  }

  async start(): Promise<void> {
    if (this.state === "loading" || this.state === "playing") return;
    this.state = "loading";
    this.overlayStart.setAttribute("hidden", "");
    this.setStatus("Asking for camera access…");

    try {
      await this.setupCamera();
      this.setStatus("Loading pose model…");
      await this.ensureAssetsLoaded();
      this.setStatus(null);
      this.beginRound();
    } catch (err) {
      console.error(err);
      this.setStatus(
        err instanceof DOMException
          ? "Camera access was denied. Allow the camera and try again."
          : "Something went wrong loading the game. Refresh and try again."
      );
      this.overlayStart.removeAttribute("hidden");
      this.state = "idle";
    }
  }

  private async restart(): Promise<void> {
    this.overlayGameOver.setAttribute("hidden", "");
    this.beginRound();
  }

  private async setupCamera(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    this.video.srcObject = stream;
    await new Promise<void>((resolve) => {
      this.video.onloadedmetadata = () => {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        resolve();
      };
    });
    await this.video.play();
  }

  private async ensureAssetsLoaded(): Promise<void> {
    const tasks: Promise<unknown>[] = [];

    if (!this.poseLandmarker) {
      tasks.push(
        (async () => {
          const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
          );
          this.poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        })()
      );
    }

    if (this.sprites.size === 0) {
      tasks.push(
        (async () => {
          const uniqueDefs = OBSTACLES;
          for (const def of uniqueDefs) {
            const img = await loadImage(def.src);
            this.sprites.set(def.kind, img);
          }
        })()
      );
    }

    await Promise.all(tasks);
  }

  private beginRound(): void {
    this.score = 0;
    this.obstacle = null;
    this.msSinceLastSpawn = SPAWN_GAP_MS; // spawn almost immediately
    this.scoreEl.textContent = "0";
    this.state = "playing";
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private endRound(): void {
    this.state = "gameover";
    cancelAnimationFrame(this.rafId);
    this.finalScoreEl.textContent = String(this.score);
    this.overlayGameOver.removeAttribute("hidden");
  }

  private currentSpeed(): number {
    return BASE_SPEED + this.score * SPEED_PER_POINT;
  }

  private spawnObstacle(): void {
    const def = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
    const size = def.size * this.canvas.width;
    this.obstacle = {
      def,
      x: -size,
      y: def.laneY * this.canvas.height,
      size,
      passed: false,
    };
  }

  private loop = (time: number): void => {
    if (this.state !== "playing") return;
    const dt = Math.min(time - this.lastFrameTime, 50); // clamp so tab-switches don't jump
    this.lastFrameTime = time;

    if (this.poseLandmarker && this.video.readyState >= 2) {
      const result = this.poseLandmarker.detectForVideo(this.video, time);
      this.lastLandmarks = result.landmarks[0] ?? null;
    }

    this.updateObstacle(dt);
    this.draw();

    if (this.checkCollision()) {
      this.endRound();
      return;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private updateObstacle(dt: number): void {
    this.msSinceLastSpawn += dt;

    if (!this.obstacle) {
      if (this.msSinceLastSpawn >= SPAWN_GAP_MS) {
        this.spawnObstacle();
        this.msSinceLastSpawn = 0;
      }
      return;
    }

    this.obstacle.x += (this.currentSpeed() * dt) / 1000;

    if (this.obstacle.x > this.canvas.width + this.obstacle.size) {
      this.score += 1;
      this.scoreEl.textContent = String(this.score);
      this.obstacle = null;
    }
  }

  private checkCollision(): boolean {
    if (!this.obstacle || !this.lastLandmarks) return false;

    const [a, b] = this.obstacle.def.hitZone;
    const pointA = this.lastLandmarks[a];
    const pointB = this.lastLandmarks[b];
    if (!pointA || !pointB) return false;

    const centerX = ((pointA.x + pointB.x) / 2) * this.canvas.width;
    const centerY = ((pointA.y + pointB.y) / 2) * this.canvas.height;

    const obstacleCenterX = this.obstacle.x + this.obstacle.size / 2;
    const obstacleCenterY = this.obstacle.y;

    const dx = centerX - obstacleCenterX;
    const dy = centerY - obstacleCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const threshold = this.obstacle.size / 2 + HIT_TOLERANCE_PX;
    return distance <= threshold;
  }

  private draw(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.drawSkeleton();

    if (this.obstacle) {
      const sprite = this.sprites.get(this.obstacle.def.kind);
      if (sprite) {
        ctx.drawImage(
          sprite,
          this.obstacle.x,
          this.obstacle.y - this.obstacle.size / 2,
          this.obstacle.size,
          this.obstacle.size
        );
      }
    }
  }

  private drawSkeleton(): void {
    const landmarks = this.lastLandmarks;
    if (!landmarks) return;
    const { ctx, canvas } = this;

    ctx.save();
    ctx.strokeStyle = "rgba(6, 214, 160, 0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [a, b] of SKELETON_CONNECTIONS) {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (!pa || !pb) continue;
      ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
      ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 183, 3, 0.9)";
    for (const idx of [11, 12, 23, 24]) {
      const p = landmarks[idx];
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
