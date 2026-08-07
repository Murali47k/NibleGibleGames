import {
  SHOT_ORDER,
  SHOT_LABELS,
  DELIVERY_ORDER,
  DELIVERY_LABELS,
  type ShotKind,
  type DeliveryKind,
  bowledOutLine,
  sixLine,
  fourLine,
  caughtOutLine,
  runLine,
  runOutLine,
  milestoneLine,
} from "./commentary";

export type Call = "odd" | "even";
export type Role = "batting" | "bowling";
export type InningsId = 1 | 2;

export interface InningsResult {
  runs: number;
  wickets: number;
  ballsFaced: number;
}

export type BallOutcome =
  | { kind: "bowled"; delivery: DeliveryKind }
  | { kind: "caught"; shot: ShotKind }
  | { kind: "six"; shot: ShotKind }
  | { kind: "four"; shot: ShotKind }
  | { kind: "runs"; amount: 1 | 2 | 3 }
  | { kind: "runout"; amount: 1 | 2 | 3 };

export interface BallEvent {
  outcome: BallOutcome;
  commentary: string;
  runsScored: number;
  isWicket: boolean;
}

export interface LogLine {
  text: string;
  tone: "info" | "commentary" | "wicket" | "boundary" | "result";
}

export const WICKETS_PER_INNINGS = 5;
export const MAX_BALLS_PER_INNINGS = 60; // ten brisk overs, keeps a round short

export type GamePhase =
  | "call-toss"
  | "toss-result"
  | "choose-role"
  | "innings"
  | "innings-break"
  | "game-over";

export interface GameSnapshot {
  phase: GamePhase;
  log: LogLine[];
  playerCall: Call | null;
  tossPlayerRoll: number | null;
  tossComRoll: number | null;
  tossWinner: "player" | "computer" | null;
  playerRole: Role | null; // role for innings 1
  currentInnings: InningsId;
  playerBatting: boolean; // true if the human is the batter in the CURRENT innings
  runs: number;
  wickets: number;
  balls: number;
  target: number | null;
  firstInnings: InningsResult | null;
  secondInnings: InningsResult | null;
  winner: "player" | "computer" | "tie" | null;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomShot(): ShotKind {
  return SHOT_ORDER[randInt(0, SHOT_ORDER.length - 1)];
}

function randomDelivery(): DeliveryKind {
  return DELIVERY_ORDER[randInt(0, DELIVERY_ORDER.length - 1)];
}

// Chance that a "runs" outcome instead becomes a run out while the
// batsmen are scampering between the wickets.
const RUN_OUT_CHANCE = 0.12;

/**
 * ODD or EVEN — a self-contained, text-only hand-cricket engine.
 *
 * Mirrors the mechanics of the original CricketV3.py prototype: a shot
 * (1-6) is matched against a delivery (1-6), with a random "power" roll
 * deciding the outcome. Ported here as a small state machine so a UI layer
 * can render whatever `getSnapshot()` returns without knowing the rules.
 */
export class OddOrEvenGame {
  private log: LogLine[] = [];
  private phase: GamePhase = "call-toss";

  private playerCall: Call | null = null;
  private tossPlayerRoll: number | null = null;
  private tossComRoll: number | null = null;
  private tossWinner: "player" | "computer" | null = null;

  private playerRoleInnings1: Role | null = null;
  private currentInnings: InningsId = 1;
  private playerBatting = false;

  private runs = 0;
  private wickets = 0;
  private balls = 0;

  private firstInnings: InningsResult | null = null;
  private secondInnings: InningsResult | null = null;
  private target: number | null = null;
  private winner: "player" | "computer" | "tie" | null = null;

  private push(text: string, tone: LogLine["tone"] = "info"): void {
    this.log.push({ text, tone });
  }

  getSnapshot(): GameSnapshot {
    return {
      phase: this.phase,
      log: this.log,
      playerCall: this.playerCall,
      tossPlayerRoll: this.tossPlayerRoll,
      tossComRoll: this.tossComRoll,
      tossWinner: this.tossWinner,
      playerRole: this.playerRoleInnings1,
      currentInnings: this.currentInnings,
      playerBatting: this.playerBatting,
      runs: this.runs,
      wickets: this.wickets,
      balls: this.balls,
      target: this.target,
      firstInnings: this.firstInnings,
      secondInnings: this.secondInnings,
      winner: this.winner,
    };
  }

  /** Step 1: the player calls it in the air. */
  callToss(call: Call): void {
    if (this.phase !== "call-toss") return;
    this.playerCall = call;
    const p = randInt(1, 5);
    const c = randInt(1, 5);
    this.tossPlayerRoll = p;
    this.tossComRoll = c;
    const total = p + c;
    const isOdd = total % 2 === 1;
    const callMatched = (call === "odd" && isOdd) || (call === "even" && !isOdd);
    this.tossWinner = callMatched ? "player" : "computer";

    this.push(
      `You call ${call.toUpperCase()}. You throw ${p}, the computer throws ${c} — that's ${total}, ${
        isOdd ? "ODD" : "EVEN"
      }.`,
      "info"
    );
    this.push(
      this.tossWinner === "player"
        ? "Your call! You've won the toss."
        : "Not quite — the computer wins the toss.",
      "info"
    );

    this.phase = "toss-result";
  }

  /** Step 2: whoever won the toss picks a role (computer picks automatically). */
  proceedFromToss(): void {
    if (this.phase !== "toss-result") return;

    if (this.tossWinner === "computer") {
      const role: Role = Math.random() < 0.5 ? "batting" : "bowling";
      this.playerRoleInnings1 = role === "batting" ? "bowling" : "batting";
      this.push(
        `The computer elects to ${role === "batting" ? "bat" : "bowl"} first.`,
        "info"
      );
      this.startInnings(1);
    } else {
      this.phase = "choose-role";
    }
  }

  /** Used only when the player won the toss. */
  chooseRole(role: Role): void {
    if (this.phase !== "choose-role") return;
    this.playerRoleInnings1 = role;
    this.push(`You choose to ${role === "batting" ? "bat" : "bowl"} first.`, "info");
    this.startInnings(1);
  }

  private startInnings(innings: InningsId): void {
    this.currentInnings = innings;
    this.runs = 0;
    this.wickets = 0;
    this.balls = 0;

    const roleThisInnings: Role =
      innings === 1
        ? (this.playerRoleInnings1 as Role)
        : this.playerRoleInnings1 === "batting"
          ? "bowling"
          : "batting";
    this.playerBatting = roleThisInnings === "batting";

    this.push(
      innings === 1
        ? `First innings: ${this.playerBatting ? "you're" : "the computer is"} batting.`
        : `Second innings: ${this.playerBatting ? "you're" : "the computer is"} batting. Target: ${this.target}.`,
      "info"
    );
    this.phase = "innings";
  }

  /**
   * Play one ball. `choice` is the shot (1-6) if the player is batting,
   * or the delivery (1-6) if the player is bowling. The opposing value is
   * simulated at random, exactly like the original prototype.
   */
  playBall(choice: ShotKind | DeliveryKind): BallEvent {
    if (this.phase !== "innings") {
      throw new Error("Not currently in an innings");
    }

    const shot: ShotKind = this.playerBatting ? (choice as ShotKind) : randomShot();
    const delivery: DeliveryKind = this.playerBatting ? randomDelivery() : (choice as DeliveryKind);
    const power = randInt(0, 5);

    // Shot and delivery are matched by index — same odds as the original
    // "shot === delivery" comparison, now across two separate enums.
    const isBeaten = SHOT_ORDER.indexOf(shot) === DELIVERY_ORDER.indexOf(delivery);

    let outcome: BallOutcome;
    let commentary: string;
    let runsScored = 0;
    let isWicket = false;

    if (power === 0) {
      outcome = { kind: "bowled", delivery };
      commentary = bowledOutLine(delivery);
      isWicket = true;
    } else if (power === 5) {
      outcome = { kind: "six", shot };
      commentary = sixLine(shot);
      runsScored = 6;
    } else if (isBeaten) {
      outcome = { kind: "caught", shot };
      commentary = caughtOutLine(shot);
      isWicket = true;
    } else if (power === 4) {
      outcome = { kind: "four", shot };
      commentary = fourLine(shot);
      runsScored = 4;
    } else {
      const amount = power as 1 | 2 | 3;
      if (Math.random() < RUN_OUT_CHANCE) {
        outcome = { kind: "runout", amount };
        commentary = runOutLine(amount);
        isWicket = true;
        // The run out is still attempted, so the run(s) already completed count.
        runsScored = amount;
      } else {
        outcome = { kind: "runs", amount };
        commentary = runLine(amount);
        runsScored = amount;
      }
    }

    const runsBeforeThisBall = this.runs;
    this.balls += 1;
    this.runs += runsScored;
    if (isWicket) this.wickets += 1;

    const who = this.playerBatting ? "You" : "The computer";
    const bowler = this.playerBatting ? "The computer" : "You";
    const shotLabel = SHOT_LABELS[shot];
    const deliveryLabel = DELIVERY_LABELS[delivery];

    this.push(
      `${bowler} bowl${this.playerBatting ? "s" : ""} a ${deliveryLabel}.`,
      "info"
    );
    this.push(
      `${who} play${this.playerBatting ? "" : "s"} the ${shotLabel}.`,
      "info"
    );
    this.push(commentary, isWicket ? "wicket" : runsScored >= 4 ? "boundary" : "commentary");

    if (isWicket) {
      const outWho = this.playerBatting ? "You're" : "The computer is";
      const dismissal = outcome.kind === "runout" ? "run out" : "out";
      this.push(`${outWho} ${dismissal}!`, "wicket");
    }

    this.push(
      `Score: ${this.runs}/${this.wickets} after ${this.balls} ball${this.balls === 1 ? "" : "s"}.`,
      "info"
    );

    // Score-based milestone commentary — fires every time the total crosses
    // a multiple of 50 (50, 100, 150, ...).
    const prevMilestone = Math.floor(runsBeforeThisBall / 50);
    const newMilestone = Math.floor(this.runs / 50);
    if (newMilestone > prevMilestone && newMilestone > 0) {
      const battingTeam = this.playerBatting ? "You" : "The computer";
      this.push(milestoneLine(newMilestone * 50, battingTeam), "result");
    }

    this.checkInningsEnd();

    return { outcome, commentary, runsScored, isWicket };
  }

  private checkInningsEnd(): void {
    const inningsOver =
      this.wickets >= WICKETS_PER_INNINGS ||
      this.balls >= MAX_BALLS_PER_INNINGS ||
      (this.currentInnings === 2 && this.target !== null && this.runs >= this.target);

    if (!inningsOver) return;

    const result: InningsResult = { runs: this.runs, wickets: this.wickets, ballsFaced: this.balls };

    if (this.currentInnings === 1) {
      this.firstInnings = result;
      this.target = result.runs + 1;
      this.push(
        `Innings closed: ${result.runs}/${result.wickets} off ${result.ballsFaced} balls. Target to win: ${this.target}.`,
        "result"
      );
      this.phase = "innings-break";
    } else {
      this.secondInnings = result;
      const chasedDown = this.target !== null && result.runs >= this.target;
      if (chasedDown) {
        this.winner = this.playerBatting ? "player" : "computer";
      } else if (this.firstInnings && result.runs === this.firstInnings.runs) {
        this.winner = "tie";
      } else {
        this.winner = this.playerBatting ? "computer" : "player";
      }
      this.push(this.buildResultLine(), "result");
      this.phase = "game-over";
    }
  }

  private buildResultLine(): string {
    if (this.winner === "tie") return "It's a TIE! What a way for this one to finish.";
    if (this.winner === "player") return "YOU WIN! Take a bow — that was a superb.";
    return "THE COMPUTER WINS. Better luck next time — call for a rematch!";
  }

  /** Advance from the innings break into the second innings. */
  startSecondInnings(): void {
    if (this.phase !== "innings-break") return;
    this.startInnings(2);
  }
}