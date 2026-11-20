# Wildfield Survival Arena

**Wildfield Survival Arena** is a browser-based, single-player survival shooter prototype. Drop into a small 3D training field, take on six hostile bots, and try to clear the arena before your health runs out.

- **Play the game:** [wildfield-survival-arena.lovable.app](https://wildfield-survival-arena.lovable.app/)
- **Source code:** [github.com/malik-tanveer/wildfield-survival-arena](https://github.com/malik-tanveer/wildfield-survival-arena)
- **Build with Lovable:** [Open this project in Lovable](https://lovable.dev/projects/2120d514-67e0-43ad-88a9-7c39141a1bb5)

> This is a solo game prototype, not a finished online or multiplayer service. The match is played in the browser against computer-controlled opponents.

## How the game works

1. Open the live app and choose **Deploy to field**.
2. Move around the arena and use the rifle to fight the six bots. Bots pursue the player and attack when close enough.
3. Keep an eye on the HUD for health, ammunition, remaining enemies, and match time. Reload when needed.
4. Clear all six hostiles to win. If your health reaches zero first, the match ends in defeat.
5. Choose **Redeploy** to start a fresh match.

The arena is rendered in 3D with a third-person camera, character and weapon models, animated actors, environmental cover, lighting, and a heads-up display. The app supports keyboard/mouse controls and touch-friendly on-screen controls.

## Controls

| Action | Keyboard / mouse | Touch / on-screen |
| --- | --- | --- |
| Move | `W` `A` `S` `D` or arrow keys | Use the movement joystick |
| Sprint | Hold `Shift` while moving | Move with the joystick; sprint is keyboard-only |
| Aim / look | Move the mouse; hold the right mouse button to aim | Use the on-screen Aim control where available |
| Fire | Hold the left mouse button or `Space` | Hold **Fire** |
| Reload | `R` | Tap **Reload** |

Mouse movement for aiming uses pointer lock; click the game canvas to engage it. Release the fire or aim control to stop the action.

## What is included

- One compact, bounded 3D arena with terrain, trees, and cover props.
- One player character and six computer-controlled enemies.
- A rifle with a 30-round magazine, firing, aiming, and timed reloading.
- Player health, enemy count, match timer, hit feedback, and victory/defeat screens.
- Desktop input and touch-oriented movement/action controls.
- A local, repeatable match loop with redeployment.

## Technology

The project is written in TypeScript and uses React 19, TanStack Start/Router, Vite, and Three.js through React Three Fiber and Drei. Tailwind CSS and Radix UI components support the interface. Lovable is the project-generation and editing platform, and the repository is connected to its editor.

Gameplay rules are separated into `src/game/sim/` so core movement and combat behavior can be tested independently from the rendered scene. The main game screen and 3D scene are in `src/game/GameScreen.tsx`; the `/` route is defined in `src/routes/index.tsx`.

## Run locally

You need a current Node.js installation. Clone the repository and install dependencies:

```sh
git clone https://github.com/malik-tanveer/wildfield-survival-arena.git
cd wildfield-survival-arena
npm install
npm run dev
```

Open the local URL printed by Vite in your browser. The repository also includes a Bun lockfile, so Bun can be used if preferred:

```sh
bun install
bun run dev
```

### Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run build:dev` | Build using development mode |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest test suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run format` | Format files with Prettier |

## Project structure

```text
src/
├── game/
│   ├── GameScreen.tsx   # Game UI, input, 3D scene, and match loop
│   └── sim/             # Testable gameplay rules
├── routes/
│   ├── __root.tsx       # Application shell
│   └── index.tsx         # Main game route (/)
├── components/          # Reusable UI components
└── styles.css           # Global and game styling
public/
└── models/field-game/   # Player, enemy, and rifle 3D assets
```

## Built with Lovable

This project was created with [Lovable](https://lovable.dev) and is linked to GitHub. You can continue it in the [Lovable editor](https://lovable.dev/projects/2120d514-67e0-43ad-88a9-7c39141a1bb5), or work locally and push changes to the connected repository. Keep published history intact; commits on the connected branch synchronize back to Lovable.

## Why a product-focused prompt matters

A clear prompt helps Lovable build a coherent product rather than a collection of disconnected screens. It describes the intended player, core gameplay loop, controls, visual direction, accessibility expectations, and what should be tested. For a real-world release, it should also distinguish prototype features from production requirements such as performance, device support, privacy, security, and reliable state handling.

The current app is a playable solo prototype. Features such as online multiplayer, user accounts, cloud saves, leaderboards, and live operations should be treated as future work—not as existing capabilities.

### Example Lovable prompt for the next product-development phase

```text
Improve Wildfield Survival Arena into a polished, reliable browser-based single-player survival game while preserving its existing 3D arena, visual identity, and working controls.

Before making changes, inspect the existing code and keep the game rules in src/game/sim testable independently of the React Three Fiber scene. Do not claim or add online multiplayer, accounts, cloud saves, analytics, or other services unless they are explicitly implemented and documented.

Product goals:
- Make the first-time flow clear: explain the objective and controls before deployment, and provide a clear pause, victory, defeat, and redeploy experience.
- Ensure keyboard/mouse and touch controls work consistently across supported screen sizes. Add accessible labels, visible focus states, and a way to pause or exit a match.
- Make gameplay readable and fair: communicate damage, low health, ammunition, reload state, enemy count, and match completion with clear visual and accessible feedback.
- Handle loading, missing 3D assets, browser errors, and reduced-performance devices gracefully. Avoid trapping the user in a blank or unresponsive screen.
- Keep rendering and input responsive on desktop and mobile. Profile the 3D scene and use appropriate quality settings for lower-powered devices.
- Add or update automated tests for gameplay rules and important match outcomes. Run the existing test, lint, and production-build commands and report their results.

Deliverables:
1. Implement only improvements that fit the existing architecture and can be verified in this repository.
2. Update the README to match what is actually implemented; clearly label anything that remains a future idea.
3. Summarize changed files, behavior, tests run, known limitations, and any external setup required.
```

## Contributing

Bug reports and focused improvements are welcome. Please include steps to reproduce gameplay issues, the browser/device used, and whether the problem occurs with keyboard/mouse or touch controls. Avoid committing secrets or generated files.

## License

No license is currently specified in this repository. Unless a license is added, the code should not be assumed to be available for reuse, modification, or redistribution under an open-source license.
