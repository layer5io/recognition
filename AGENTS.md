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

This repository consumes the Layer5 design system via `@sistent/sistent`.

- **Component Reuse**: Prefer importing existing UI primitives from `@sistent/sistent` (e.g., `Accordion`, `AccordionSummary`, `AccordionDetails`, `CustomTooltip`) for UI elements rather than hand-rolling duplicate components or ad-hoc styles.
- **Design Contract Reference**:
  - Do **not** create or maintain a separate `DESIGN.md` in this repository.
  - Sistent is the source of truth for applicable design guidance for UI that uses Sistent.
  - When referencing the design contract:
    - **Local package**: Prefer reading `node_modules/@sistent/sistent/DESIGN.md` when it is present in the installed package.
    - **Version-matched upstream**: If it is not present, consult the Sistent release tag matching the version actually resolved in `package-lock.json` rather than `master`.
- **Styling**: When using `styled-components`, prefer existing Sistent tokens and theme values over introducing new hardcoded brand colors.

## Contribution Guidelines

- **Commit Sign-Off (DCO)**: Every commit must include a Developer Certificate of Origin sign-off (`git commit -s -m "..."`).
- **Target Branch**: Submit pull requests against the `master` branch.
- **Verification**: Always verify that the project builds cleanly without errors before submitting changes:
  ```bash
  npm run build
  ```
