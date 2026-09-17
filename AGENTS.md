# Repository Guidelines for AI Agents and Contributors

This document provides operational context, development commands, and design system guidelines for contributors and AI coding agents working on the Layer5 Recognition repository.

## Repository Overview

The **Layer5 Recognition Program** site ([badges.layer5.io](https://badges.layer5.io)) celebrates community member milestones, contributions, and certifications across Layer5 and Meshery projects through digital badges.

- **Framework**: Gatsby 5 / React 18
- **UI & Styling**: `@sistent/sistent` component library with `styled-components`
- **Data & State**: TanStack React Table, TanStack React Query, local JSON metadata

## Development Runbook

Use the repository's existing Make targets or npm scripts for local development:

| Task | Make Target | npm Script | Description |
| :--- | :--- | :--- | :--- |
| **Setup** | `make setup` | `npm install` | Installs project dependencies. |
| **Develop** | `make site-dev` | `npm start` / `npm run develop` | Starts the Gatsby development server at `http://localhost:8000`. |
| **Build** | `make build` | `npm run build` | Generates the static production build into `public/`. |
| **Clean** | `make clean` | `npm run clean` | `npm run clean` removes Gatsby cache/build artifacts; `make clean` also restarts the site. |

## Useful Repository Structure

Key directories and files for day-to-day work:

- `src/`
  - `src/pages/`: Route components and page templates.
  - `src/sitecomponents/`: Reusable presentation components (e.g., `BadgeGrid`, `Faq`).
  - `src/badgesInfo.json`: Badges metadata, slugs, criteria, and image paths.
- `static/`: Static assets, including badge images and icons.
- `gatsby-config.js`: Site metadata, Gatsby plugins, and source filesystem configuration.
- `package.json`: Node dependencies, build scripts, and engine specifications.
- `Makefile`: Standard development automation targets.

## UI and Sistent Guidance

This repository consumes the Layer5 design system via `@sistent/sistent` with `styled-components`.

- **Component Reuse:** Prefer existing `@sistent/sistent` UI primitives before creating custom components.
- **Design Tokens:** Prefer existing Sistent theme/token values over hardcoded brand colors.
- **Design Guidance Reference:** Consult `node_modules/@sistent/sistent/DESIGN.md` when available, or the Sistent release tag matching the resolved version in `package-lock.json` rather than `master`. Do not create or maintain a separate `DESIGN.md` in this repository.

## Contribution Guidelines

- **Commit Sign-Off (DCO)**: Every commit must include a Developer Certificate of Origin sign-off (`git commit -s -m "..."`).
- **Target Branch**: Submit pull requests against the `master` branch.
- **Verification**: Always verify that the project builds cleanly without errors before submitting changes:
  ```bash
  npm run build
  ```
