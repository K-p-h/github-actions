# Complete GitHub Actions CI/CD Pipeline for a Next.js Application

This project is a complete, production-grade CI/CD pipeline built with GitHub
Actions for a Next.js application. It demonstrates a full software delivery
lifecycle: from a Pull Request all the way to a production deploy, with Docker,
security, releases, and rollback capability.

The `level-XX-*` folders in the repository root contain the incremental
learning exercises (`01-basics/` … `17-security/`). Everything in
`final-project/` is the full pipeline put together.

---

## Repository layout

```
final-project/
├── app/                        # Next.js application (App Router)
├── lib/                        # Shared helpers (pure functions, unit-tested)
├── test/                       # Node.js built-in test runner tests
├── public/                     # Static assets
├── Dockerfile                  # Multi-stage production image
├── .dockerignore
├── package.json
├── package-lock.json
├── next.config.mjs             # output: "standalone"
└── .github/workflows/
    ├── ci.yml                  # PR: lint -> matrix test -> build -> artifacts
    ├── cd.yml                  # main: docker -> GHCR -> staging -> approval -> production
    ├── docker.yml              # Docker image versioning (latest, semver, SHA)
    ├── release.yml             # version tags -> GitHub Release + build artifact
    └── security.yml            # scheduled npm audit + CodeQL + notifications
```

---

## Pipeline overview

```
Pull Request
    ↓
Lint                                (ci.yml)
    ↓
Test  (matrix: Node 18, 20, 22)     (ci.yml)
    ↓
Build + artifacts                   (ci.yml)
    ↓
Merge to main
    ↓
Docker Build                        (cd.yml / docker.yml)
    ↓
Push to GHCR (latest + SHA + semver)
    ↓
Deploy Staging  (environment: staging)
    ↓
[M A N U A L  A P P R O V A L]
    ↓
Deploy Production (environment: production)
    ↓
Health check / Rollback + notifications
```

Security runs in parallel on a schedule and on every PR.

---

## Workflows in detail

### `ci.yml` — Continuous Integration

- Triggered by **every Pull Request targeting `main`**.
- `lint` runs ESLint (`next lint`).
- `test` runs the unit tests on a **matrix** of Node.js `18`, `20`, `22`
  (with a **npm dependency cache** via `actions/setup-node`).
- `build` produces the production build and **uploads `.next` as an artifact**
  so it can be inspected/downloaded from the Actions run page.

### `cd.yml` — Continuous Deployment

- Triggered by **pushes to `main`** (i.e. after a merge).
- Steps:
  1. **Build** the Docker image with Buildx.
  2. **Push** to **GHCR** (`ghcr.io/<owner>/<repo>`) tagged with `latest` and the
     commit **SHA** (Docker image versioning).
  3. **Deploy Staging** using the `staging` GitHub Environment
     (secrets/variables resolved from `Settings > Environments > staging`).
  4. **Deploy Production** using the `production` GitHub Environment — this
     stage **blocks until a human approves** it (enable *Required reviewers* on
     the environment). Production secrets/variables come from the environment.
  5. **Rollback** job runs automatically if the production deploy fails, using
     the previously known-good image tag.
  6. **Failure notifications** fire whenever any pipeline stage fails.
- A **concurrency group** guarantees only one production deploy runs at a time.

### `docker.yml` — Docker image versioning

- Triggered by pushes to `main` **and** version tags (`v*`).
- Uses `docker/metadata-action` to generate tags:
  - `latest` on the default branch,
  - semver tags on version tags (`v1.2.3` → `1.2.3`, `1.2`, `1`),
  - short **SHA** tags on every run.
- Builds with BuildKit/GHA cache for fast rebuilds.

### `release.yml` — Automatic GitHub Releases

- Triggered on **version tags** (`v1.0.0`, `v1.2.3`, …).
- Verifies the tag (lint + test + build), packages the Next.js build output,
  then creates a **GitHub Release** and attaches the artefact via
  `softprops/action-gh-release`.

### `security.yml` — Scheduled security checks

- Runs **weekly (Mondays 03:00 UTC)**, on **every PR**, and manually.
- `npm audit --audit-level=high` fails the build on high/critical
  vulnerabilities and `npm audit signatures` verifies registry integrity.
- **CodeQL** static analysis scans the JavaScript.
- Notifies on any security failure.

---

## Dockerfile strategy

Multi-stage `node:20-alpine` image:

```
deps    → npm ci (only native deps for building)
builder → npm run build (produces .next)
runner  → copies .next/standalone, .next/static and runs as non-root
```

The runner uses the **standalone** output (`output: "standalone"`) so the image
contains only the files needed to serve the app and runs as the unprivileged
`nextjs` user. Exposes port `3000`.

---

## Setting up secrets and variables

Create these in `Settings > Secrets and variables` (use Environment scoped
secrets for staging/production where relevant):

| Name                    | Scope          | Purpose                              |
| ----------------------- | -------------- | ------------------------------------ |
| `STAGING_DEPLOY_TOKEN`  | env: staging   | Authenticate staging deployment      |
| `PROD_DEPLOY_TOKEN`     | env: production| Authenticate production deployment   |
| `SLACK_WEBHOOK_URL`     | repo (optional)| Send pipeline failure notifications  |
| `STAGING_URL`           | env: staging   | Staging URL variable                 |
| `PRODUCTION_URL`        | env: production| Production URL variable              |

The `GITHUB_TOKEN` is available automatically; the workflows use it to push
images to **GHCR** and create **GitHub Releases** (via `permissions:
packages: write` / `contents: write`).

## Required repository settings

- **Settings > Environments**: create `staging` and `production`.
  Enable *Required reviewers* on `production` for the manual-approval gate.
- **PR protection rule** on `main` requiring `ci.yml` checks to pass before merge.

## Local development

```bash
npm ci            # install from lockfile
npm run dev       # next dev
npm test          # unit tests (node --test)
npm run lint      # ESLint
npm run build     # production build
docker build -t nextjs-app . && docker run -p 3000:3000 nextjs-app  # run with Docker
```

## Release workflow example

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers `docker.yml` (semver image tags) and `release.yml` (GitHub Release
with build artifact).