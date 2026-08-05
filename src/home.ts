import "./styles/global.css";
import "./styles/home.css";
import { games } from "./lib/gameRegistry";

function renderCard(game: (typeof games)[number]): string {
  const cardClass = game.comingSoon ? "game-card game-card--soon" : "game-card";
  const cta = game.comingSoon ? "In progress" : "Play now";

  return `
    <a class="${cardClass}" href="${game.href}" aria-disabled="${Boolean(game.comingSoon)}">
      <div class="game-card__art">
        <span class="game-card__tag">${game.tag}</span>
        <img src="${game.thumbnail}" alt="" width="72" height="72" />
      </div>
      <div class="game-card__body">
        <h3>${game.title}</h3>
        <p>${game.description}</p>
        <span class="game-card__cta">${cta}</span>
      </div>
    </a>
  `;
}

function mount(): void {
  const grid = document.querySelector<HTMLDivElement>("#cabinet-grid");
  if (!grid) return;
  grid.innerHTML = games.map(renderCard).join("");
}

document.addEventListener("DOMContentLoaded", mount);
