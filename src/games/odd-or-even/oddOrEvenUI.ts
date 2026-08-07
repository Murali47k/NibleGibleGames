import { OddOrEvenGame, type GameSnapshot, type Role } from "./oddOrEvenGame";
import { SHOT_LABELS, SHOT_ORDER, DELIVERY_LABELS, DELIVERY_ORDER } from "./commentary";

export class OddOrEvenUI {
  private readonly game = new OddOrEvenGame();
  private readonly scoreboard: HTMLElement;
  private readonly sbRuns: HTMLElement;
  private readonly sbWickets: HTMLElement;
  private readonly sbBalls: HTMLElement;
  private readonly sbTarget: HTMLElement;
  private readonly sbRole: HTMLElement;
  private readonly commentaryBox: HTMLElement;
  private readonly controlPanel: HTMLElement;
  private renderedLogCount = 0;

  constructor(root: HTMLElement) {
    this.scoreboard = root.querySelector("#scoreboard") as HTMLElement;
    this.sbRuns = root.querySelector("#sb-runs") as HTMLElement;
    this.sbWickets = root.querySelector("#sb-wickets") as HTMLElement;
    this.sbBalls = root.querySelector("#sb-balls") as HTMLElement;
    this.sbTarget = root.querySelector("#sb-target") as HTMLElement;
    this.sbRole = root.querySelector("#sb-role") as HTMLElement;
    this.commentaryBox = root.querySelector("#commentary-box") as HTMLElement;
    this.controlPanel = root.querySelector("#control-panel") as HTMLElement;

    this.render();
  }

  private render(): void {
    const snap = this.game.getSnapshot();
    this.renderScoreboard(snap);
    this.renderLog(snap);
    this.renderControls(snap);
  }

  private renderScoreboard(snap: GameSnapshot): void {
    if (snap.phase === "call-toss" || snap.phase === "toss-result" || snap.phase === "choose-role") {
      this.scoreboard.hidden = true;
      return;
    }
    this.scoreboard.hidden = false;
    this.sbRuns.textContent = String(snap.runs);
    this.sbWickets.textContent = String(snap.wickets);
    this.sbBalls.textContent = `${snap.balls} ball${snap.balls === 1 ? "" : "s"}`;

    if (snap.currentInnings === 2 && snap.target !== null) {
      this.sbTarget.hidden = false;
      const remaining = Math.max(snap.target - snap.runs, 0);
      this.sbTarget.textContent =
        snap.phase === "game-over" ? `Target was ${snap.target}` : `Need ${remaining} to win`;
    } else {
      this.sbTarget.hidden = true;
    }

    this.sbRole.textContent = snap.playerBatting ? "YOU'RE BATTING" : "YOU'RE BOWLING";
  }

  private renderLog(snap: GameSnapshot): void {
    // Append only new lines so we don't reset scroll position every render.
    for (let i = this.renderedLogCount; i < snap.log.length; i++) {
      const line = snap.log[i];
      const el = document.createElement("p");
      el.className = `log-line log-line--${line.tone}`;
      el.textContent = line.text;
      this.commentaryBox.appendChild(el);
    }
    this.renderedLogCount = snap.log.length;
    this.commentaryBox.scrollTop = this.commentaryBox.scrollHeight;
  }

  private renderControls(snap: GameSnapshot): void {
    this.controlPanel.innerHTML = "";

    switch (snap.phase) {
      case "call-toss":
        this.renderTossCall();
        break;
      case "toss-result":
        this.renderTossResult();
        break;
      case "choose-role":
        this.renderRoleChoice();
        break;
      case "innings":
        this.renderShotChoices(snap);
        break;
      case "innings-break":
        this.renderInningsBreak(snap);
        break;
      case "game-over":
        this.renderGameOver(snap);
        break;
    }
  }

  private addLabel(text: string): void {
    const label = document.createElement("div");
    label.className = "control-panel__label";
    label.textContent = text;
    this.controlPanel.appendChild(label);
  }

  private renderTossCall(): void {
    this.addLabel("CALL THE TOSS");
    const grid = document.createElement("div");
    grid.className = "call-grid";

    const oddBtn = document.createElement("button");
    oddBtn.className = "call-btn call-btn--odd";
    oddBtn.textContent = "ODD";
    oddBtn.addEventListener("click", () => {
      this.game.callToss("odd");
      this.render();
    });

    const evenBtn = document.createElement("button");
    evenBtn.className = "call-btn call-btn--even";
    evenBtn.textContent = "EVEN";
    evenBtn.addEventListener("click", () => {
      this.game.callToss("even");
      this.render();
    });

    grid.append(oddBtn, evenBtn);
    this.controlPanel.appendChild(grid);
  }

  private renderTossResult(): void {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Continue";
    btn.addEventListener("click", () => {
      this.game.proceedFromToss();
      this.render();
    });
    this.controlPanel.appendChild(btn);
  }

  private renderRoleChoice(): void {
    this.addLabel("BAT OR BOWL FIRST?");
    const grid = document.createElement("div");
    grid.className = "call-grid";

    (["batting", "bowling"] as Role[]).forEach((role) => {
      const btn = document.createElement("button");
      btn.className = "call-btn";
      btn.textContent = role === "batting" ? "Bat first" : "Bowl first";
      btn.addEventListener("click", () => {
        this.game.chooseRole(role);
        this.render();
      });
      grid.appendChild(btn);
    });

    this.controlPanel.appendChild(grid);
  }

  private renderShotChoices(snap: GameSnapshot): void {
    this.addLabel(snap.playerBatting ? "CHOOSE YOUR SHOT" : "CHOOSE YOUR DELIVERY");
    const grid = document.createElement("div");
    grid.className = "control-grid";

    if (snap.playerBatting) {
      SHOT_ORDER.forEach((shot, idx) => {
        const btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.innerHTML = `<span class="choice-btn__index">${idx + 1}</span>${SHOT_LABELS[shot]}`;
        btn.addEventListener("click", () => {
          this.game.playBall(shot);
          this.render();
        });
        grid.appendChild(btn);
      });
    } else {
      DELIVERY_ORDER.forEach((delivery, idx) => {
        const btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.innerHTML = `<span class="choice-btn__index">${idx + 1}</span>${DELIVERY_LABELS[delivery]}`;
        btn.addEventListener("click", () => {
          this.game.playBall(delivery);
          this.render();
        });
        grid.appendChild(btn);
      });
    }

    this.controlPanel.appendChild(grid);
  }

  private renderInningsBreak(snap: GameSnapshot): void {
    if (snap.firstInnings) {
      this.addLabel(
        `INNINGS BREAK — ${snap.firstInnings.runs}/${snap.firstInnings.wickets} off ${snap.firstInnings.ballsFaced} balls`
      );
    }
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Start second innings";
    btn.addEventListener("click", () => {
      this.game.startSecondInnings();
      this.render();
    });
    this.controlPanel.appendChild(btn);
  }

  private renderGameOver(_snap: GameSnapshot): void {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Play again";
    btn.addEventListener("click", () => {
      window.location.reload();
    });
    this.controlPanel.appendChild(btn);
  }
}