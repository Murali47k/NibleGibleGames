import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

type BallState = "idle" | "held" | "flying" | "resting";

interface Vec2 {
  x: number;
  y: number;
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

const SCORE_TOASTS = ["SWISH!", "Bucket!", "Nothing but net!", "That's a bucket!", "Splash!"];
const RIM_TOASTS = ["Clangs off the rim!", "So close!", "Rattles out!"];
const BACKBOARD_TOASTS = ["Off the glass!", "Bricked off the backboard!"];

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
    this.finalStatsEl.textContent = `${this.shotsAttempted} shot${this.shotsAttempted === 1 ? "" : "s"} taken · ${pct}% shooting`;
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
  }

  private showToast(text: string, tone: "score" | "miss" = "score"): void {
    window.clearTimeout(this.toastHideTimer);
    this.toastEl.textContent = text;
    this.toastEl.classList.remove("shot-toast--miss");
    if (tone === "miss") this.toastEl.classList.add("shot-toast--miss");
    this.toastEl.hidden = false;
    // Force reflow so the transition re-triggers on repeated toasts.
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add("shot-toast--visible");
    this.toastHideTimer = window.setTimeout(() => {
      this.toastEl.classList.remove("shot-toast--visible");
    }, 1400);
  }

  private loop = (time: number): void => {
    if (this.state !== "playing") return;
    const dt = Math.min((time - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = time;

    this.updateHandTracking(time, dt);
    this.updateBall(dt);
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
      this.announceOnce(pick(BACKBOARD_TOASTS), "miss");
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
        this.announceOnce(pick(RIM_TOASTS), "miss");
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
        this.scoredThisFlight = true;
        this.score += 1;
        this.scoreEl.textContent = String(this.score);
        this.netFlashUntil = performance.now() + 350;
        this.showToast(pick(SCORE_TOASTS), "score");
      }
    }

    // Floor.
    if (nextY + court.ballRadius >= court.floorY) {
      nextY = court.floorY - court.ballRadius;
      if (this.ballVel.y > 0) {
        this.ballVel.y = -this.ballVel.y * FLOOR_RESTITUTION;
        this.ballVel.x *= FLOOR_FRICTION;
      }
      const speed = Math.hypot(this.ballVel.x, this.ballVel.y);
      if (speed < REST_SPEED_EPSILON) {
        this.ballVel.x = 0;
        this.ballVel.y = 0;
        this.ballState = "resting";
        this.restingSince = performance.now();
      } else {
        // Rolling friction while it skids along the floor.
        this.ballVel.x *= Math.pow(ROLL_FRICTION_PER_SEC, dt * 60);
      }
    }

    // Out of bounds (thrown clean off the top or the sides at height) — send it home.
    if (nextY < -court.ballRadius * 4 || nextX < -200 || nextX > this.canvas.width + 200) {
      this.ballState = "resting";
      this.restingSince = performance.now() - RESPAWN_DELAY_MS; // respawn almost immediately
    }

    this.ballPos = { x: nextX, y: nextY };
  }

  private announceOnce(text: string, tone: "score" | "miss"): void {
    if (this.toastShownThisFlight || this.scoredThisFlight) return;
    this.toastShownThisFlight = true;
    this.showToast(text, tone);
  }

  private draw(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!this.court) return;
    const court = this.court;

    this.drawCourt(court);
    this.drawHoop(court);
    this.drawHand();
    this.drawBall(court);
  }

  private drawCourt(court: Court): void {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 183, 3, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, court.floorY);
    ctx.lineTo(canvas.width, court.floorY);
    ctx.stroke();
    ctx.restore();
  }

  private drawHoop(court: Court): void {
    const { ctx } = this;
    const flashing = performance.now() < this.netFlashUntil;

    ctx.save();

    // Backboard.
    ctx.fillStyle = "rgba(238, 241, 243, 0.85)";
    ctx.strokeStyle = "rgba(42, 47, 58, 0.9)";
    ctx.lineWidth = 2;
    const bbWidth = 10;
    ctx.fillRect(court.backboardX, court.backboardTopY, bbWidth, court.backboardBottomY - court.backboardTopY);
    ctx.strokeRect(court.backboardX, court.backboardTopY, bbWidth, court.backboardBottomY - court.backboardTopY);

    // Rim.
    ctx.strokeStyle = flashing ? "#06d6a0" : "#ff5d73";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(court.rimLeftX, court.rimY);
    ctx.lineTo(court.rimRightX, court.rimY);
    ctx.stroke();

    // Net — a simple tapered fan of lines.
    const netBottomY = court.rimY + (court.rimRightX - court.rimLeftX) * 0.55;
    const netColor = flashing ? "rgba(6, 214, 160, 0.9)" : "rgba(238, 241, 243, 0.55)";
    ctx.strokeStyle = netColor;
    ctx.lineWidth = 1.5;
    const netStrands = 6;
    for (let i = 0; i <= netStrands; i++) {
      const t = i / netStrands;
      const topX = court.rimLeftX + (court.rimRightX - court.rimLeftX) * t;
      const bottomX = court.rimCenterX + (topX - court.rimCenterX) * 0.35;
      ctx.beginPath();
      ctx.moveTo(topX, court.rimY);
      ctx.lineTo(bottomX, netBottomY);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawHand(): void {
    if (!this.handPos) return;
    const { ctx } = this;
    const holding = this.ballState === "held";
    ctx.save();
    ctx.strokeStyle = holding ? "rgba(6, 214, 160, 0.9)" : "rgba(255, 183, 3, 0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.handPos.x, this.handPos.y, holding ? 26 : 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawBall(court: Court): void {
    const { ctx } = this;
    const { x, y } = this.ballPos;
    const r = court.ballRadius;

    ctx.save();
    ctx.fillStyle = "#f57c1f";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#3b1d05";
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
