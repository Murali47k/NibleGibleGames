import "@/styles/global.css";
import "@/styles/dino.css";
import { DinoGame } from "./dinoGame";

function mount(): void {
  const stage = document.querySelector<HTMLElement>("#stage");
  if (!stage) return;
  new DinoGame(stage);
}

document.addEventListener("DOMContentLoaded", mount);
