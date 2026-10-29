# Snip

One URL-shortening backend, two clients: an Angular web app and a Node terminal
client. Both use the same API and see the same in-memory links. Restarting the
backend clears all links by design.

## Repository Layout

Each application layer lives at the root of its own independent orphan branch
in this same GitHub repository. The `main` branch is the superproject: it mounts
those branches as submodules rather than duplicating their source files.

| Path on main | Tracked branch | Contents |
| --- | --- | --- |
| backend/ | backend | Single-file Bun server, zero npm dependencies |
| frontend/ | frontend | Angular 19 UI, one component and one HTTP service |
| cli/ | cli | Zero-dependency Node CLI and cross-platform launchers |
| .gitmodules | main | Submodule URLs, paths, and tracked branches |

Each submodule is a Git checkout with its own commits. Main records an exact
commit pointer (a gitlink) for each one; branch tracking does not automatically
advance those pointers. There is no generated release bundle at this step.

## Clone

Requires Git, Bun 1.x, and Node 20+ with npm. Node 22 LTS is a suitable choice
for the Angular 19 tooling.

```sh
git clone --recurse-submodules https://github.com/genzylee/Day-1-Workshop.git
cd Day-1-Workshop
```

A plain clone leaves the submodule folders empty. Populate them with:

```sh
git submodule update --init --recursive
```

If the remote's default branch is not main, add `--branch main` to the clone
command. To inspect the exact pinned versions, run `git submodule status`.

## Run

From the main checkout, use separate terminals for the backend and web app.

Backend, http://localhost:3000:

```sh
cd backend
bun start
```

If Bun is not on PATH, `npm exec --yes --package=bun -- bun start` also works
without adding a dependency to this project.

Frontend, http://localhost:4200:

```sh
cd frontend
npm install
npx ng serve
```

CLI, from a third terminal at the main checkout:

```sh
cd cli
node cli.js add https://example.com
node cli.js ls
node cli.js open Ab12Cd
```

Replace `Ab12Cd` with a returned code. The frontend and CLI both default to the
backend at http://localhost:3000. The CLI accepts another API base via `SNIP_API`;
its local `snip`, `snip.cmd`, and `snip.ps1` launchers forward arguments.

The backend accepts `PORT` (3000 by default), `BASE_URL` for generated short-link
origins, `RAILWAY_PUBLIC_DOMAIN` as a fallback HTTPS origin, and optional
`PUBLIC_DIR` to serve static files. API responses allow cross-origin requests.
See each submodule's README for details. Stop servers with Ctrl+C.

## API Contract

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | /api/links | `{ "url": "https://example.com" }` | 201 `{ code, url, shortUrl, hits, createdAt }`; 400 `{ error }` for invalid JSON or a non-HTTP(S) URL |
| GET | /api/links | None | 200 array of link objects |
| GET | /:code | None | 302 Location redirect to the original URL, incrementing hits; 404 if unknown |
| OPTIONS | Any path | None | 204 CORS preflight |

Codes are six random base62 characters, hits start at zero, and createdAt is an
ISO timestamp. Keep this contract consistent across all three layers.

## Update a Layer

Recursive clones usually check out submodules at detached HEADs. Switch to the
layer's named branch before editing; substitute frontend or cli below as needed.

```sh
cd backend
git switch backend
git pull --ff-only origin backend
```

Edit and test the layer, then commit and push it first:

```sh
git add server.js
git commit -m "Update backend"
git push origin backend
cd ..
```

Advance and commit the pointer on main separately:

```sh
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push origin main
```

Do not push a main pointer to a layer commit that has not been pushed: other
clones must be able to fetch it. After pulling someone else's main changes,
restore its pinned versions with:

```sh
git pull --ff-only
git submodule update --init --recursive
```

Use `--remote` only when intentionally advancing a pointer to a tracked branch
tip. Omit it when reproducing the exact versions recorded on main.