# Contributing

Issues and pull requests are welcome. For a bug, include the agent, your OS and
Node version, and what the session looked like (never the transcript itself if
it holds anything private).

## Running from source

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

To run it in Docker with the transcript directories mounted read-only:

```bash
pnpm deploy:docker
```

CI runs `pnpm lint` and `pnpm build` (which also type-checks) on every pull
request, so run both before opening one.

## Demo data

To try the UI without your own transcripts (or to retake the screenshots),
generate a fake home directory with a few synthetic sessions and point the app
at it:

```bash
node scripts/demo-data.mjs /tmp/asi-demo
HOME=/tmp/asi-demo pnpm dev
```

## Adding a provider

1. Write `src/lib/providers/<name>.ts` exporting a `SessionProvider`: `info`,
   `isAvailable`, `listSessions`, `getSession`, plus `listLogs`/`getLogContent`
   (return empty when the agent has no log directory).
2. Map its records onto the canonical event types; cap huge payloads before they
   reach the client, and set `resultChars` on tool results so the token review
   can size them. Attach `billedUsage` wherever the transcript reports usage so
   the session can be priced.
3. Register it in `src/lib/providers/index.ts` and add its id to
   `ProviderId` in `types.ts`.
4. Add its badge colours to `src/lib/provider-meta.ts`.

Routes are provider-scoped: `/sessions/<provider>/<id>` and
`/api/sessions/<provider>/<id>`.

## Releasing

Change `version` in `package.json` and push to `main`. The
[release workflow](.github/workflows/release.yml) builds the app, publishes it
to npm, and creates the `vX.Y.Z` tag and GitHub release with
`agent-session-inspector.tar.gz` and `install.sh`, which is what the install
command downloads. A push that leaves the version alone releases nothing.

The workflow signs in to npm by
[trusted publishing](https://docs.npmjs.com/trusted-publishers), so the
repository holds no npm token. The package's settings on npmjs.com must list
this repository and `release.yml` as its trusted publisher.

`pnpm package` runs the same build locally into `dist/`. To try the result
without publishing:

```bash
npx ./dist/agent-session-inspector
ASI_TARBALL_URL="file://$PWD/dist/agent-session-inspector.tar.gz" bash install.sh
```
