# Contributing

Thanks for your interest in improving Athena Query Client! Bug reports, fixes and new features are welcome.

## Reporting bugs and requesting features

Open an [issue](https://github.com/yeremenkov/athena-query-client/issues) and include:

- the package version and Node.js version,
- the client configuration and the query you ran (remove anything sensitive),
- what you expected and what happened instead, including the error message if there is one.

## Development setup

Requirements: Node.js 20 or later and npm. The project uses `package-lock.json`, so please don't use yarn or pnpm.

```sh
git clone https://github.com/yeremenkov/athena-query-client.git
cd athena-query-client
npm ci
```

| Command | What it does |
|---|---|
| `npm test` | Run the Jest test suite |
| `npm run lint` | Lint and auto-fix formatting (ESLint + Prettier) |
| `npm run lint:check` | Lint without fixing, as CI does |
| `npm run build` | Build the CommonJS and ES module output into `dist/` |

The tests mock the AWS SDK with [aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock), so you don't need AWS credentials.

## Making changes

1. Create a branch from `main`.
2. Make your change in `src/athena-query-client.ts`.
   - Keep the public API backward compatible. New configuration options must be optional with defaults that keep the current behavior.
   - Configuration keys use PascalCase (`MaxWaitMs`, `NullAsNull`) to match the AWS SDK naming.
3. Add or update tests in `test/` for the new behavior.
4. Document new options or behavior in `README.md`.
5. Add a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md), in the matching group (`Added`, `Changed`, `Fixed`, `Breaking`, …).
6. Check that `npm run lint:check`, `npm test` and `npm run build` pass.
7. Open a pull request against `main`. CI runs the same checks on Node.js 20, 22 and 24 and must pass before merging.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `build:`, `ci:`, `chore:`.
Keep one logical change per commit, for example:

```
feat: add NullAsNull option

- When enabled, NULL values are returned as null instead of ''
```

## Releasing (maintainers)

1. Make sure `## [Unreleased]` in `CHANGELOG.md` lists everything going into the release.
2. Run `npm version patch`, `minor` or `major` on `main`. This bumps `package.json`, moves the Unreleased entries into a dated section for the new version, commits and creates the `vX.Y.Z` tag.
3. Run `git push --follow-tags`.

The release workflow then checks the tag against `package.json` and the changelog, runs the tests, publishes to npm through Trusted Publishing and creates a GitHub Release from the changelog entry.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
