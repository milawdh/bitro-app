# BitroLearn

An interactive Persian programming education frontend built with Next.js App Router, React, strict TypeScript, Tailwind CSS, Zustand, Motion, Radix and Monaco Editor.

## Run with Docker

```sh
docker compose up --build -d
```

Open http://localhost:3000 for the introduction or http://localhost:3000/dashboard for the learning dashboard.

```sh
docker compose logs -f frontend
docker compose down
```

The Compose project is named `bitro-frontend` and runs independently of other BitroLearn services.

## Develop locally

```sh
npm ci
npm run dev
```

All fonts and Monaco assets are hosted locally. The postinstall script copies Monaco's assets into `public/monaco`.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run build
# With the app running on port 3000 and Chrome installed:
npm run test:e2e
```

## Product scope

This is a frontend-only MVP. Account sessions, progress, settings, lesson checkpoints and project files are stored in this browser's localStorage. No database or authentication service is required. The IDE runs explicitly labeled educational simulations, with supported deterministic C# fixtures. Editing an example outside the supported fixture returns a clear unsupported-code diagnostic rather than claiming actual compilation. Project terminal/API responses and challenge validation are deterministic local demonstrations.

The application includes a marketing page, local onboarding, dashboard, three curriculum paths, eight authored lessons, nine interactive concept labs, code playground, four structured challenges, a multi-file .NET project, progress, profile, and settings. Unauthored curriculum modules are labeled planned rather than presented as working lessons.

Providers and simulation logic live separately from React views so real services can replace them later.
