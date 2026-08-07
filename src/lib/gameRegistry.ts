export interface GameEntry {
  id: string;
  title: string;
  tagline: string;
  description: string;
  href: string;
  thumbnail: string;
  tag: string;
  /** Games without a real page yet render as a disabled "soon" card. */
  comingSoon?: boolean;
}

/**
 * The full catalog of games in the arcade. To add a new game to the home
 * page, add an entry here and build its page under /games/<id>/.
 */
export const games: GameEntry[] = [
  {
    id: "dino",
    title: "IRL-DINO",
    tagline: "Dodge with your actual body",
    description:
      "Your webcam is the controller. Duck under flyers, lean past cactus spikes — no keyboard involved.",
    href: "/games/dino/index.html",
    thumbnail: "/images/flying-dino.png",
    tag: "WEBCAM",
  },
  {
    id: "odd-or-even",
    title: "ODD or EVEN",
    tagline: "Call the toss, chase the target",
    description:
      "A text-only hand-cricket duel. Call odd or even to win the toss, then bat or bowl your way through a 3-wicket dash with commentary for every ball.",
    href: "/games/odd-or-even/index.html",
    thumbnail: "/images/odd_or_even.png",
    tag: "TEXT",
  },
  {
    id: "ongoing-project",
    title: "Ongoing Project",
    tagline: "Stay tuned for updates",
    description:
      "We're working hard on this project. Check back soon for more information!",
    href: "/index.html",
    thumbnail: "/images/loading-spinner.png",
    tag: "COMING SOON",
    comingSoon: true,
  }
];
