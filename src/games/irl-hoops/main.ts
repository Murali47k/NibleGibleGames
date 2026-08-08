import "@/styles/global.css";
import "@/styles/irl-hoops.css";
import { HoopsGame } from "./hoopsGame";

function mount(): void {
  const stage = document.querySelector<HTMLElement>("#stage");
  if (!stage) return;
  new HoopsGame(stage);
}

document.addEventListener("DOMContentLoaded", mount);
