# Snip Frontend

Angular 19 client for Snip. One standalone component, one HttpClient service,
and signal-based state. The API server must be running at http://localhost:3000.

```sh
npm install
npx ng serve
```

Open http://localhost:4200. Paste an HTTP(S) URL to create a short link. Refresh
the table to fetch the latest hit counts. Validation, API, and connection errors
appear inline. The backend stores links in memory and clears them on restart.

```sh
npx ng build
npx ng test --watch=false --browsers=ChromeHeadless
```

Production output: `dist/snip-frontend/browser`. Keep the project name
`snip-frontend` and this output path unchanged: the later bundle step uses them.

This orphan branch contains only the frontend. The backend lives on the `backend`
branch; the later `main` superproject will mount both side by side as submodules.