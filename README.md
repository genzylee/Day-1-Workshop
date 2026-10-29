# Snip Backend

A single-file, zero-dependency Bun URL shortener. Links live in an in-memory Map;
restarting the process clears them. Requires Bun 1.x.

## Run

```sh
bun start
bun test
```

| Method | Path | Result |
| --- | --- | --- |
| POST | /api/links | Send `{ "url": "https://example.com" }`; returns 201 with `{ code, url, shortUrl, hits, createdAt }`, or 400 for invalid JSON or a non-HTTP(S) URL. |
| GET | /api/links | Returns 200 with all links. |
| GET | /:code | Returns 302 to the original URL and increments hits, or 404 for an unknown code. |

Codes contain six random base62 characters. All responses allow cross-origin
requests; OPTIONS preflight returns 204.

## Configuration

Set environment variables in your shell or a local `.env` file (Bun loads it automatically):

| Variable | Default / behavior |
| --- | --- |
| PORT | 3000 |
| BASE_URL | Origin used in short URLs. Overrides the defaults below. |
| RAILWAY_PUBLIC_DOMAIN | When BASE_URL is unset, uses `https://<domain>`. Otherwise uses `http://localhost:<port>`. |
| PUBLIC_DIR | Optional static directory, relative to the working directory. `/` serves index.html; existing files take priority over short codes. API routes remain reserved. |

Static files are restricted to PUBLIC_DIR, including resolved symlink targets.
This is a demo, not a production service: there is no persistence, authentication,
or rate limiting, and CORS is intentionally open.