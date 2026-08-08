import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

type BallState = "idle" | "held" | "flying" | "resting";
type ShotTone = "score" | "miss" | "combo";

interface Vec2 {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  rotation: number;
  rotSpeed: number;
}

interface Court {
  ballRadius: number;
  floorY: number;
  spawnX: number;
  spawnY: number;
  rimY: number;
  rimLeftX: number;
  rimRightX: number;
  rimCenterX: number;
  rimPostRadius: number;
  backboardX: number;
  backboardTopY: number;
  backboardBottomY: number;
}

// -- Tunable physics constants (pixels / seconds) -----------------------
const GRAVITY = 1900;
const FLOOR_RESTITUTION = 0.58;
const FLOOR_FRICTION = 0.82; // velocity retained (x) on each floor bounce
const ROLL_FRICTION_PER_SEC = 0.94; // velocity retained per second while rolling
const WALL_RESTITUTION = 0.7;
const RIM_RESTITUTION = 0.55;
const BACKBOARD_RESTITUTION = 0.6;
const GRAB_RADIUS_FRAC = 0.075; // fraction of canvas width
const RELEASE_SPEED = 480; // px/s — hand speed that triggers a throw
const THROW_POWER = 2;
const MAX_THROW_SPEED = 3600;
const REST_SPEED_EPSILON = 40;
const RESPAWN_DELAY_MS = 900;
const SHOT_CLOCK_SECONDS = 60;
const HAND_VELOCITY_SMOOTHING = 0.35; // EMA factor, higher = more responsive

// -- Juice / presentation constants --------------------------------------
const BALL_IMAGE_SRC = "/images/basketball.png";
const TRAIL_MAX_LENGTH = 8;
const CONFETTI_COUNT = 20;
const STREAK_BONUS_THRESHOLD = 3; // makes in a row before bonus points kick in
const HOT_STREAK_THRESHOLD = 5; // makes in a row before the "on fire" aura shows
const BALL_ROTATION_FACTOR = 0.012;
const STRETCH_DECAY_PER_SEC = 6;
const SHAKE_DEFAULT_DURATION_MS = 160;
const NET_SPRING = 45;
const NET_DAMPING = 6;

const SCORE_TOASTS = ["SWISH!", "Bucket!", "Nothing but net!", "That's a bucket!", "Splash!"];
const RIM_TOASTS = ["Clangs off the rim!", "So close!", "Rattles out!"];
const BACKBOARD_TOASTS = ["Off the glass!", "Bricked off the backboard!"];
const CONFETTI_COLORS = ["#ffb703", "#06d6a0", "#ff5d73", "#eef1f3", "#4cc9f0"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class HoopsGame {
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scoreEl: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly finalScoreEl: HTMLElement;
  private readonly finalStatsEl: HTMLElement;
  private readonly overlayStart: HTMLElement;
  private readonly overlayGameOver: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly statusTextEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly stageEl: HTMLElement | null;

  private handLandmarker: HandLandmarker | null = null;
  private court: Court | null = null;

  private state: "idle" | "loading" | "playing" | "gameover" = "idle";
  private rafId = 0;
  private lastFrameTime = 0;

  private score = 0;
  private shotsAttempted = 0;
  private timeRemaining = SHOT_CLOCK_SECONDS;
  private timeAccumulator = 0;

  private handPos: Vec2 | null = null;
  private handVel: Vec2 = { x: 0, y: 0 };
  private lastHandPos: Vec2 | null = null;

  private ballState: BallState = "idle";
  private ballPos: Vec2 = { x: 0, y: 0 };
  private ballVel: Vec2 = { x: 0, y: 0 };
  private restingSince: number | null = null;
  private toastShownThisFlight = false;
  private scoredThisFlight = false;
  private netFlashUntil = 0;
  private toastHideTimer = 0;
  // False for a moment right after a throw, so the ball — which starts a
  // release exactly at the hand's position — doesn't get instantly
  // re-grabbed on the very next frame. Re-armed once the ball has
  // actually separated from the hand.
  private armedForGrab = true;

  // -- Presentation state ------------------------------------------------
  private ballImage: HTMLImageElement | null = null;
  private ballImageLoaded = false;
  private ballRotation = 0;
  private ballStretch = 0; // 0..1, eases the ball's squash/stretch after an impact
  private trail: Vec2[] = [];
  private particles: Particle[] = [];
  private streak = 0;
  private bestStreak = 0;
  private shakeUntil = 0;
  private shakeMag = 0;
  private shakeDuration = SHAKE_DEFAULT_DURATION_MS;
  private netKick = 0;
  private netKickVel = 0;

  constructor(root: HTMLElement) {
    this.video = root.querySelector("#camera") as HTMLVideoElement;
    this.canvas = root.querySelector("#game-canvas") as HTMLCanvasElement;
    this.scoreEl = root.querySelector("#score-value") as HTMLElement;
    this.timeEl = root.querySelector("#time-value") as HTMLElement;
    this.finalScoreEl = root.querySelector("#final-score") as HTMLElement;
    this.finalStatsEl = root.querySelector("#final-stats") as HTMLElement;
    this.overlayStart = root.querySelector("#overlay-start") as HTMLElement;
    this.overlayGameOver = root.querySelector("#overlay-gameover") as HTMLElement;
    this.statusEl = root.querySelector("#stage-status") as HTMLElement;
    this.statusTextEl = root.querySelector("#stage-status-text") as HTMLElement;
    this.toastEl = root.querySelector("#shot-toast") as HTMLElement;
    this.stageEl = root.querySelector(".stage");
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

    root.querySelector("#btn-start")?.addEventListener("click", () => void this.start());
    root.querySelector("#btn-restart")?.addEventListener("click", () => void this.restart());

    // Kick off the ball texture load immediately — by the time the camera
    // and hand model finish loading this is almost always ready too, and
    // if it's slow we just fall back to the procedural ball until it is.
    this.loadBallImage();
  }

  private loadBallImage(): void {
    const img = new Image();
    img.onload = () => {
      this.ballImage = img;
      this.ballImageLoaded = true;
    };
    img.onerror = () => {
      // Silent fallback — the procedural ball drawing still works fine.
      this.ballImage = null;
      this.ballImageLoaded = false;
    };
    img.src = BALL_IMAGE_SRC;
  }

  private setStatus(message: string | null): void {
    if (!message) {
      this.statusEl.hidden = true;
      return;
    }
    this.statusEl.hidden = false;
    this.statusTextEl.textContent = message;
  }

  async start(): Promise<void> {
    if (this.state === "loading" || this.state === "playing") return;
    this.state = "loading";
    this.overlayStart.setAttribute("hidden", "");
    this.setStatus("Asking for camera access…");

    try {
      await this.setupCamera();
      this.setStatus("Loading hand model…");
      await this.ensureHandModel();
      this.setStatus(null);
      this.setupCourt();
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

  private async ensureHandModel(): Promise<void> {
    if (this.handLandmarker) return;
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    this.handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });
  }

  private setupCourt(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ballRadius = w * 0.045;
    const rimCenterX = w * 0.86;
    const rimHalfWidth = w * 0.085;

    this.court = {
      ballRadius,
      floorY: h * 0.92,
      spawnX: w * 0.2,
      spawnY: h * 0.92 - ballRadius,
      rimY: h * 0.26,
      rimLeftX: rimCenterX - rimHalfWidth,
      rimRightX: rimCenterX + rimHalfWidth,
      rimCenterX,
      rimPostRadius: Math.max(4, w * 0.009),
      backboardX: rimCenterX + rimHalfWidth + w * 0.025,
      backboardTopY: h * 0.26 - h * 0.14,
      backboardBottomY: h * 0.26 + h * 0.03,
    };
  }

  private beginRound(): void {
    this.score = 0;
    this.shotsAttempted = 0;
    this.timeRemaining = SHOT_CLOCK_SECONDS;
    this.timeAccumulator = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.particles = [];
    this.netKick = 0;
    this.netKickVel = 0;
    this.scoreEl.textContent = "0";
    this.timeEl.textContent = String(SHOT_CLOCK_SECONDS);
    this.resetBallToSpawn();
    this.state = "playing";
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private endRound(): void {
    this.state = "gameover";
    cancelAnimationFrame(this.rafId);
    this.finalScoreEl.textContent = String(this.score);
    const pct = this.shotsAttempted > 0 ? Math.round((this.score / this.shotsAttempted) * 100) : 0;
    const streakNote = this.bestStreak > 1 ? ` · best streak ${this.bestStreak}` : "";
    this.finalStatsEl.textContent = `${this.shotsAttempted} shot${this.shotsAttempted === 1 ? "" : "s"} taken · ${pct}% shooting${streakNote}`;
    this.overlayGameOver.removeAttribute("hidden");
  }

  private resetBallToSpawn(): void {
    if (!this.court) return;
    this.ballPos = { x: this.court.spawnX, y: this.court.spawnY };
    this.ballVel = { x: 0, y: 0 };
    this.ballState = "idle";
    this.restingSince = null;
    this.toastShownThisFlight = false;
    this.scoredThisFlight = false;
    this.armedForGrab = true;
    this.trail = [];
    this.ballRotation = 0;
    this.ballStretch = 0;
  }

  private showToast(text: string, tone: ShotTone = "score"): void {
    window.clearTimeout(this.toastHideTimer);
    this.toastEl.textContent = text;
    this.toastEl.classList.remove("shot-toast--miss", "shot-toast--combo");
    if (tone === "miss") this.toastEl.classList.add("shot-toast--miss");
    if (tone === "combo") this.toastEl.classList.add("shot-toast--combo");
    this.toastEl.hidden = false;
    // Force reflow so the transition re-triggers on repeated toasts.
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add("shot-toast--visible");
    this.toastHideTimer = window.setTimeout(() => {
      this.toastEl.classList.remove("shot-toast--visible");
    }, 1400);
  }

  private triggerShake(magnitude: number, durationMs: number): void {
    this.shakeMag = magnitude;
    this.shakeDuration = durationMs;
    this.shakeUntil = performance.now() + durationMs;
  }

  private flashStage(): void {
    if (!this.stageEl) return;
    this.stageEl.classList.remove("stage--flash");
    void this.stageEl.offsetWidth;
    this.stageEl.classList.add("stage--flash");
  }

  private popScore(): void {
    this.scoreEl.classList.remove("hud-pop");
    void this.scoreEl.offsetWidth;
    this.scoreEl.classList.add("hud-pop");
  }

  private spawnConfetti(x: number, y: number): void {
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed * 0.6,
        vy: Math.sin(angle) * speed - 220,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.4,
        color: pick(CONFETTI_COLORS),
        size: 3 + Math.random() * 3,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  private updateParticles(dt: number): void {
    if (this.particles.length === 0) return;
    for (const p of this.particles) {
      p.life += dt;
      p.vy += GRAVITY * 0.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotSpeed * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
  }

  private updateNet(dt: number): void {
    if (this.netKick === 0 && this.netKickVel === 0) return;
    const accel = -NET_SPRING * this.netKick - NET_DAMPING * this.netKickVel;
    this.netKickVel += accel * dt;
    this.netKick += this.netKickVel * dt;
  }

  /** Registers a made shot: score, streak/bonus, confetti, net kick, toast. */
  private registerScore(): void {
    this.scoredThisFlight = true;
    this.streak += 1;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const bonus = this.streak >= STREAK_BONUS_THRESHOLD ? 1 : 0;
    this.score += 1 + bonus;
    this.scoreEl.textContent = String(this.score);
    this.popScore();
    this.flashStage();

    this.netFlashUntil = performance.now() + 350;
    this.netKickVel += 900;
    if (this.court) this.spawnConfetti(this.ballPos.x, this.court.rimY);
    this.triggerShake(4, 160);

    if (this.streak >= HOT_STREAK_THRESHOLD) {
      this.showToast("🔥 ON FIRE!", "combo");
    } else if (this.streak >= STREAK_BONUS_THRESHOLD) {
      this.showToast(`${this.streak} STREAK! +${1 + bonus}`, "combo");
    } else {
      this.showToast(pick(SCORE_TOASTS), "score");
    }
  }

  /** Called once, the moment a flight resolves without going in. */
  private resolveMiss(): void {
    if (this.scoredThisFlight) return;
    this.streak = 0;
  }

  private showToastOnce(text: string, tone: ShotTone): void {
    if (this.toastShownThisFlight || this.scoredThisFlight) return;
    this.toastShownThisFlight = true;
    this.showToast(text, tone);
  }

  private loop = (time: number): void => {
    if (this.state !== "playing") return;
    const dt = Math.min((time - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = time;

    this.updateHandTracking(time, dt);
    this.updateBall(dt);
    this.updateNet(dt);
    this.updateParticles(dt);
    this.ballStretch = Math.max(0, this.ballStretch - dt * STRETCH_DECAY_PER_SEC);
    this.updateClock(dt);
    this.draw();

    if (this.state === "playing") {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private updateClock(dt: number): void {
    this.timeAccumulator += dt;
    if (this.timeAccumulator >= 1) {
      const ticks = Math.floor(this.timeAccumulator);
      this.timeAccumulator -= ticks;
      this.timeRemaining = Math.max(0, this.timeRemaining - ticks);
      this.timeEl.textContent = String(this.timeRemaining);
      if (this.timeRemaining <= 0) {
        this.endRound();
      }
    }
  }

  private updateHandTracking(time: number, dt: number): void {
    if (!this.handLandmarker || this.video.readyState < 2) return;
    const result = this.handLandmarker.detectForVideo(this.video, time);
    const landmarks: NormalizedLandmark[] | undefined = result.landmarks[0];

    if (!landmarks) {
      this.handPos = null;
      this.lastHandPos = null;
      return;
    }

    // Palm anchor: midpoint of the wrist (0) and middle-finger base (9) —
    // a stable point that stays put even as fingers move.
    const wrist = landmarks[0];
    const midBase = landmarks[9];
    const px = ((wrist.x + midBase.x) / 2) * this.canvas.width;
    const py = ((wrist.y + midBase.y) / 2) * this.canvas.height;
    this.handPos = { x: px, y: py };

    if (this.lastHandPos && dt > 0) {
      const instVx = (px - this.lastHandPos.x) / dt;
      const instVy = (py - this.lastHandPos.y) / dt;
      this.handVel = {
        x: this.handVel.x + (instVx - this.handVel.x) * HAND_VELOCITY_SMOOTHING,
        y: this.handVel.y + (instVy - this.handVel.y) * HAND_VELOCITY_SMOOTHING,
      };
    }
    this.lastHandPos = { x: px, y: py };
  }

  private tryGrab(): boolean {
    if (!this.handPos || !this.court) return false;
    const grabRadius = GRAB_RADIUS_FRAC * this.canvas.width;
    const d = Math.hypot(this.handPos.x - this.ballPos.x, this.handPos.y - this.ballPos.y);

    if (!this.armedForGrab) {
      // Re-arm once the ball has actually put some distance between itself
      // and the hand that threw it — otherwise it'd snap right back.
      if (d > grabRadius * 1.6) this.armedForGrab = true;
      return false;
    }

    if (d < grabRadius) {
      this.ballState = "held";
      this.restingSince = null;
      this.trail = [];
      return true;
    }
    return false;
  }

  private updateBall(dt: number): void {
    if (!this.court) return;
    const court = this.court;

    if (this.ballState !== "held" && this.tryGrab()) {
      // Caught it — fall through to the "held" branch below this frame.
    }

    if (this.ballState === "idle" || this.ballState === "resting") {
      if (this.ballState === "resting" && this.restingSince !== null) {
        if (performance.now() - this.restingSince > RESPAWN_DELAY_MS) {
          this.resetBallToSpawn();
        }
      }
      return;
    }

    if (this.ballState === "held") {
      if (!this.handPos) return; // freeze in place if tracking drops briefly
      this.ballPos = { x: this.handPos.x, y: this.handPos.y };
      this.ballRotation += this.handVel.x * dt * BALL_ROTATION_FACTOR;

      const handSpeed = Math.hypot(this.handVel.x, this.handVel.y);
      if (handSpeed > RELEASE_SPEED) {
        const speed = Math.min(handSpeed * THROW_POWER, MAX_THROW_SPEED);
        const angle = Math.atan2(this.handVel.y, this.handVel.x);
        this.ballVel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        this.ballState = "flying";
        this.shotsAttempted += 1;
        this.toastShownThisFlight = false;
        this.scoredThisFlight = false;
        this.armedForGrab = false;
      }
      return;
    }

    // Flying: full physics.
    this.trail.push({ x: this.ballPos.x, y: this.ballPos.y });
    if (this.trail.length > TRAIL_MAX_LENGTH) this.trail.shift();
    this.ballRotation += this.ballVel.x * dt * BALL_ROTATION_FACTOR;

    this.ballVel.y += GRAVITY * dt;
    let nextX = this.ballPos.x + this.ballVel.x * dt;
    let nextY = this.ballPos.y + this.ballVel.y * dt;

    // Side walls.
    if (nextX - court.ballRadius < 0) {
      nextX = court.ballRadius;
      this.ballVel.x = -this.ballVel.x * WALL_RESTITUTION;
    } else if (nextX + court.ballRadius > this.canvas.width) {
      nextX = this.canvas.width - court.ballRadius;
      this.ballVel.x = -this.ballVel.x * WALL_RESTITUTION;
    }

    // Backboard: a vertical wall the ball can hit from the left while moving right.
    if (
      this.ballVel.x > 0 &&
      nextX + court.ballRadius > court.backboardX &&
      nextY > court.backboardTopY &&
      nextY < court.backboardBottomY
    ) {
      nextX = court.backboardX - court.ballRadius;
      this.ballVel.x = -this.ballVel.x * BACKBOARD_RESTITUTION;
      this.ballStretch = 0.7;
      this.triggerShake(5, 150);
      this.showToastOnce(pick(BACKBOARD_TOASTS), "miss");
    }

    // Rim posts: small circular colliders at each end of the rim opening.
    for (const postX of [court.rimLeftX, court.rimRightX]) {
      const dx = nextX - postX;
      const dy = nextY - court.rimY;
      const dist = Math.hypot(dx, dy);
      const minDist = court.ballRadius + court.rimPostRadius;
      if (dist < minDist && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        const penetration = minDist - dist;
        nextX += nx * penetration;
        nextY += ny * penetration;
        const dot = this.ballVel.x * nx + this.ballVel.y * ny;
        this.ballVel.x = (this.ballVel.x - 2 * dot * nx) * RIM_RESTITUTION;
        this.ballVel.y = (this.ballVel.y - 2 * dot * ny) * RIM_RESTITUTION;
        this.ballStretch = 0.6;
        this.triggerShake(3, 120);
        this.showToastOnce(pick(RIM_TOASTS), "miss");
      }
    }

    // Score sensor: crossing rim height, inside the rim gap, heading down.
    if (
      !this.scoredThisFlight &&
      this.ballVel.y > 0 &&
      this.ballPos.y < court.rimY &&
      nextY >= court.rimY
    ) {
      const margin = court.ballRadius * 0.5;
      if (nextX > court.rimLeftX + margin && nextX < court.rimRightX - margin) {
        this.registerScore();
      }
    }

    // Floor.
    if (nextY + court.ballRadius >= court.floorY) {
      nextY = court.floorY - court.ballRadius;
      if (this.ballVel.y > 0) {
        this.ballVel.y = -this.ballVel.y * FLOOR_RESTITUTION;
        this.ballVel.x *= FLOOR_FRICTION;
        this.ballStretch = Math.max(this.ballStretch, 0.5);
      }
      const speed = Math.hypot(this.ballVel.x, this.ballVel.y);
      if (speed < REST_SPEED_EPSILON) {
        this.ballVel.x = 0;
        this.ballVel.y = 0;
        this.ballState = "resting";
        this.restingSince = performance.now();
        this.resolveMiss();
      } else {
        // Rolling friction while it skids along the floor.
        this.ballVel.x *= Math.pow(ROLL_FRICTION_PER_SEC, dt * 60);
      }
    }

    // Out of bounds (thrown clean off the top or the sides at height) — send it home.
    if (nextY < -court.ballRadius * 4 || nextX < -200 || nextX > this.canvas.width + 200) {
      this.ballState = "resting";
      this.restingSince = performance.now() - RESPAWN_DELAY_MS; // respawn almost immediately
      this.resolveMiss();
    }

    this.ballPos = { x: nextX, y: nextY };
  }

  private draw(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!this.court) return;
    const court = this.court;

    const now = performance.now();
    let shakeX = 0;
    let shakeY = 0;
    if (now < this.shakeUntil) {
      const remaining = (this.shakeUntil - now) / this.shakeDuration;
      shakeX = (Math.random() - 0.5) * 2 * this.shakeMag * remaining;
      shakeY = (Math.random() - 0.5) * 2 * this.shakeMag * remaining;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawCourt(court);
    this.drawBackboard(court);
    this.drawRimAndNet(court, "back");
    this.drawHand();
    this.drawBall(court);
    this.drawRimAndNet(court, "front");
    this.drawParticles();

    ctx.restore();
  }

  private drawCourt(court: Court): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    ctx.save();

    const floorGrad = ctx.createLinearGradient(0, court.floorY, 0, court.floorY + 50);
    floorGrad.addColorStop(0, "rgba(150, 96, 52, 0.22)");
    floorGrad.addColorStop(1, "rgba(150, 96, 52, 0)");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, court.floorY, w, 50);

    ctx.strokeStyle = "rgba(255, 183, 3, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, court.floorY);
    ctx.lineTo(w, court.floorY);
    ctx.stroke();

    // Faint "key" marking under the hoop for court flavor.
    const keyWidth = w * 0.24;
    const keyHeight = (court.floorY - court.rimY) * 0.72;
    ctx.strokeStyle = "rgba(255, 183, 3, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(court.rimCenterX - keyWidth / 2, court.floorY - keyHeight, keyWidth, keyHeight);

    ctx.restore();
  }

  private drawBackboard(court: Court): void {
    const { ctx, canvas } = this;
    const bbWidth = 10;
    const bbHeight = court.backboardBottomY - court.backboardTopY;

    ctx.save();

    // Support pole + arm, so the hoop reads as mounted rather than floating.
    ctx.strokeStyle = "rgba(120, 128, 140, 0.5)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(court.backboardX + bbWidth + 4, court.backboardTopY + bbHeight * 0.15);
    ctx.lineTo(canvas.width - 6, court.backboardTopY + bbHeight * 0.15);
    ctx.lineTo(canvas.width - 6, court.floorY);
    ctx.stroke();

    // Backboard panel with a soft gradient and a subtle shooter's-square hint.
    const grad = ctx.createLinearGradient(court.backboardX, court.backboardTopY, court.backboardX, court.backboardBottomY);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.92)");
    grad.addColorStop(1, "rgba(198, 205, 214, 0.8)");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "rgba(42, 47, 58, 0.9)";
    ctx.lineWidth = 2;
    ctx.fillRect(court.backboardX, court.backboardTopY, bbWidth, bbHeight);
    ctx.strokeRect(court.backboardX, court.backboardTopY, bbWidth, bbHeight);

    ctx.strokeStyle = "rgba(255, 93, 115, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(court.backboardX + 1.5, court.backboardTopY + bbHeight * 0.35, bbWidth - 3, bbHeight * 0.3);

    ctx.restore();
  }

  /**
   * Draws the rim + net as a shallow ellipse so the ball can visually pass
   * "through" it: the back half is drawn before the ball, the front half
   * after, which sells the depth without needing real 3D.
   */
  private drawRimAndNet(court: Court, part: "back" | "front"): void {
    const { ctx } = this;
    const flashing = performance.now() < this.netFlashUntil;
    const rx = (court.rimRightX - court.rimLeftX) / 2;
    const ry = Math.max(6, rx * 0.32);
    const cx = court.rimCenterX;
    const cy = court.rimY;
    const arcStart = part === "back" ? Math.PI : 0;
    const arcEnd = part === "back" ? Math.PI * 2 : Math.PI;

    // Net strands for this half.
    const netDepth = rx * 1.15;
    const netBottomY = cy + netDepth * (part === "front" ? 1 : 0.55);
    const sway = this.netKick * (part === "front" ? 1 : 0.4);
    const netColor = flashing ? "rgba(6, 214, 160, 0.95)" : "rgba(238, 241, 243, 0.5)";

    ctx.save();
    ctx.strokeStyle = netColor;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";

    const strands = 7;
    const strandTops: Vec2[] = [];
    const strandBottoms: Vec2[] = [];
    for (let i = 0; i <= strands; i++) {
      const t = i / strands;
      const angle = arcStart + (arcEnd - arcStart) * t;
      const topX = cx + Math.cos(angle) * rx;
      const topY = cy + Math.sin(angle) * ry;
      const bottomX = cx + (topX - cx) * 0.3 + sway;
      strandTops.push({ x: topX, y: topY });
      strandBottoms.push({ x: bottomX, y: netBottomY });
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo((topX + bottomX) / 2, (topY + netBottomY) / 2, bottomX, netBottomY);
      ctx.stroke();
    }

    // A horizontal cross-tie partway down gives the net a woven look.
    ctx.beginPath();
    for (let i = 0; i < strandTops.length; i++) {
      const top = strandTops[i];
      const bottom = strandBottoms[i];
      const x = top.x + (bottom.x - top.x) * 0.55;
      const y = top.y + (bottom.y - top.y) * 0.55;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // The rim itself.
    ctx.save();
    ctx.strokeStyle = flashing ? "#06d6a0" : "#ff5d73";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, arcStart, arcEnd);
    ctx.stroke();
    ctx.restore();

    // End caps on the front pass read as the rim's mounting brackets.
    if (part === "front") {
      ctx.save();
      ctx.fillStyle = flashing ? "#06d6a0" : "#ff5d73";
      for (const postX of [court.rimLeftX, court.rimRightX]) {
        ctx.beginPath();
        ctx.arc(postX, court.rimY, court.rimPostRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawHand(): void {
    if (!this.handPos) return;
    const { ctx } = this;
    const holding = this.ballState === "held";
    const pulse = 1 + Math.sin(performance.now() / 220) * 0.08;
    const baseR = (holding ? 26 : 18) * pulse;
    const color = holding ? "6, 214, 160" : "255, 183, 3";

    ctx.save();
    const glow = ctx.createRadialGradient(this.handPos.x, this.handPos.y, 0, this.handPos.x, this.handPos.y, baseR * 1.8);
    glow.addColorStop(0, `rgba(${color}, 0.25)`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.handPos.x, this.handPos.y, baseR * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${color}, 0.9)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.handPos.x, this.handPos.y, baseR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(${color}, 0.9)`;
    ctx.beginPath();
    ctx.arc(this.handPos.x, this.handPos.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBall(court: Court): void {
    const { ctx } = this;
    const { x, y } = this.ballPos;
    const r = court.ballRadius;

    // Contact shadow — shrinks and fades as the ball gets higher.
    const heightRatio = Math.max(0, Math.min(1, (court.floorY - y) / (court.floorY - court.rimY)));
    const shadowScale = 1 - heightRatio * 0.55;
    const shadowAlpha = Math.max(0.08, 0.35 - heightRatio * 0.2);
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(x, court.floorY + 2, r * 0.9 * shadowScale, r * 0.28 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Motion trail while flying.
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const t = i / this.trail.length;
      ctx.save();
      ctx.globalAlpha = t * 0.25;
      ctx.fillStyle = "#f57c1f";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * (0.5 + t * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Hot-streak aura, drawn beneath the ball so it reads as a glow.
    if (this.streak >= STREAK_BONUS_THRESHOLD) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 90) * 0.15;
      const flameGrad = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.7);
      flameGrad.addColorStop(0, "rgba(255, 183, 3, 0.35)");
      flameGrad.addColorStop(1, "rgba(255, 93, 115, 0)");
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const squash = 1 + this.ballStretch * 0.22;
    const stretch = 1 - this.ballStretch * 0.22;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.ballRotation);
    ctx.scale(squash, stretch);

    if (this.ballImage && this.ballImageLoaded) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.ballImage, -r, -r, r * 2, r * 2);
      ctx.restore();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Procedural fallback if the texture hasn't loaded yet.
      ctx.fillStyle = "#f57c1f";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#3b1d05";
      ctx.lineWidth = Math.max(1.5, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawParticles(): void {
    if (this.particles.length === 0) return;
    const { ctx } = this;
    for (const p of this.particles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
  }
}