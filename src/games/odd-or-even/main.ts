import "@/styles/global.css";
import "@/styles/odd-or-even.css";
import { OddOrEvenUI } from "./oddOrEvenUI";

function mount(): void {
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return;
  new OddOrEvenUI(main);
}

document.addEventListener("DOMContentLoaded", mount);
