# NibleGibleGames

A small, static arcade of weird, replayable browser games. No login, no
database, no high-score table — just games you can refresh and play again.

First cartridge: **IRL-DINO** — a webcam dodging game where you duck and
lean with your real body (pose-tracked in the browser) instead of pressing
keys.

## Stack

- **TypeScript + Vite** — plain multi-page static site, no framework, no server.
- **@mediapipe/tasks-vision** — runs pose detection entirely client-side (WASM),
  so no video or image data ever leaves the browser.
- Deploys as pure static files — perfect fit for Render's "Static Site" service.

## Project structure

```
my-games/
├── index.html                  # Home page ("MyGames" — the cabinet grid)
├── games/
│   └── dino/
│       └── index.html          # IRL-DINO game page
├── public/
│   └── images/                 # Sprites + favicon, copied as-is to the build
│       ├── flying-dino.png
│       ├── cactus-small.png
│       ├── cactus-tall.png
│       └── favicon.png
├── src/
│   ├── home.ts                 # Renders the game cards on the home page
│   ├── lib/
│   │   ├── gameRegistry.ts     # Single source of truth for the game catalog
│   │   └── loadImage.ts
│   ├── games/
│   │   └── dino/
│   │       ├── main.ts         # Page bootstrap
│   │       └── dinoGame.ts     # Camera + pose tracking + game loop
│   └── styles/
│       ├── global.css          # Design tokens shared by every page
│       ├── home.css
│       └── dino.css
├── render.yaml                 # Render static-site deploy config
├── vite.config.ts
├── tsconfig.json
└── package.json
```

Every page is a real `.html` file (not a client-side route), so links are
shareable and refreshable, and Render can serve the whole thing as flat
static files with zero server code.

## Run it locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the printed `localhost` URL, allow camera access on the IRL-DINO page,
and play.

To produce the static build (the same thing Render runs):

```bash
npm run build   # outputs to ./dist
npm run preview # serve ./dist locally to sanity-check the production build
```

## Deploying to Render

1. Push this folder to a GitHub/GitLab repo.
2. In the Render dashboard, choose **New → Static Site** and point it at the repo.
3. Render will pick up `render.yaml` automatically, or you can set these manually:
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
4. Deploy. No environment variables, database, or backend service are needed —
   this is a static site end to end.

Because pose detection runs in the visitor's browser, camera access requires
HTTPS — which Render's static sites provide by default.

## Adding another game to the arcade

1. Build the game's page under `games/<your-game>/index.html` and its logic
   under `src/games/<your-game>/`.
2. Add an entry to `src/lib/gameRegistry.ts` — that's what renders the card
   on the home page. Nothing else on the home page needs to change.
3. Add the page's HTML file as a new entry point in `vite.config.ts`'s
   `build.rollupOptions.input`, the same way `dino` is wired up, so Vite
   includes it in the static build.

## Notes on IRL-DINO's design

- The camera feed and the game canvas share one mirrored wrapper element, so
  the pose skeleton drawn on the canvas always lines up with your reflection
  — they're mirrored together via CSS rather than mirrored independently.
- Obstacles alternate between a high "flyer" lane (checked against your
  shoulders) and a low "cactus" lane (checked against your hips), echoing
  the original Python/OpenCV prototype this was rewritten from.
- Difficulty ramps gently: obstacle speed increases a little with each point
  scored, so a run stays winnable without ever feeling static.
- Nothing is persisted between rounds or sessions — score resets to zero on
  every replay, by design.
