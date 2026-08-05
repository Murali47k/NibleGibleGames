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
    id: "next",
    title: "???",
    tagline: "In the workshop",
    description: "Another weird one is being built. Check back later.",
    href: "#",
    thumbnail: "/images/cactus-tall.png",
    tag: "SOON",
    comingSoon: true,
  },
];
