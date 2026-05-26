# Releasing telegram-adapter-kit

This document defines **semantic versioning**, **Changesets**, and the **maintainer release flow**. It satisfies backlog **TT-006** and aligns with future CI release work (**TT-032**).

## Semantic versioning (semver)

Given `MAJOR.MINOR.PATCH`:

| Bump      | When to use                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **MAJOR** | Breaking changes to the **public API** (exported types, runtime behavior contract, or supported Node/engine range in a breaking way). |
| **MINOR** | Backward-compatible **new features** or additive API surface.                                                                         |
| **PATCH** | Backward-compatible **bug fixes**, docs that do not change behavior, internal refactors with no API impact.                           |

Pre-1.0 (`0.x`): MINOR may include breaking changes; still prefer PATCH for fixes and reserve breaking batches for explicit MINOR bumps. After **1.0.0**, follow strict semver for consumers.

## Changelog policy

- **Source of truth:** `CHANGELOG.md` at the repo root.
- **Updates:** Running `npm run release:version` consumes `.changeset/*.md` files and merges summaries into `CHANGELOG.md` via `@changesets/cli/changelog`.
- **PR discipline:** Any PR that should appear in the changelog for the next release should include a **changeset** (or the maintainer adds one before versioning).

## Changesets workflow

1. **Add a changeset** (contributors or maintainers), typically on the PR branch before merge:

   ```bash
   npm run changeset
   ```

   Choose the semver bump for `telegram-adapter-kit` and write a concise summary for consumers.

2. **Merge to `master`** with the `.changeset/*.md` file included.

3. **Version** (maintainers, on an up-to-date `master`):

   ```bash
   npm ci
   npm run test && npm run lint && npm run typecheck && npm run build
   npm run verify:dist && npm run verify:consumers
   npm run release:version
   ```

   This updates `package.json` / `package-lock.json` versions and rewrites `CHANGELOG.md`. Review the diff, then commit (e.g. `chore: version packages`) with your usual signing policy.

4. **Publish** (maintainers, with npm login and publish rights):

   ```bash
   npm run release:publish
   ```

   `prepublishOnly` runs `npm run build` so `dist/` is fresh.

5. **Push** commits and **tags** created by the publish step as prompted by the CLI.

## Configuration

- `.changeset/config.json` — `baseBranch` is **`master`**, `access` is **`public`**, `commit` is **`false`** so versioning commits are explicit and GPG-signed by maintainers.
- Single-package repo: the only package is the root `telegram-adapter-kit`.

## Dry-run checklist (TT-006)

- [ ] `npm run changeset` opens the wizard and writes a file under `.changeset/`.
- [ ] `npm run release:version` with at least one pending changeset bumps `package.json` and updates `CHANGELOG.md`.
- [ ] `npm run release:publish` is only run when ready to ship; it requires registry credentials (documented in **TT-032** for CI).

## CI alignment (TT-032)

Future GitHub Actions should: install with `npm ci`, run `test` / `lint` / `typecheck` / `build`, then either run `changeset version` in a controlled job or rely on maintainers versioning locally before tag-based publish. This doc is the reference for that pipeline.
