# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) to version **telegram-adapter-kit** and to generate `CHANGELOG.md` on release.

- Add a changeset after a user-facing change: `npm run changeset` (interactive).
- Apply versions and refresh the changelog: `npm run release:version` (run on `master` after changesets are merged).
- Publish to npm (maintainers, with registry auth): `npm run release:publish`.

See `RELEASING.md` for semver rules and the full maintainer flow. Release automation in CI is tracked as **TT-032** in `Documentacion/BACKLOG-telegram-runtime-sdk.md`.
