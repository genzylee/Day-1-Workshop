import { randomInt } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const links = new Map();
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const publicRoot = process.env.PUBLIC_DIR
  ? await realpath(resolve(process.env.PUBLIC_DIR))
  : null;
const configuredOrigin = process.env.BASE_URL
  ? new URL(process.env.BASE_URL).origin
  : process.env.RAILWAY_PUBLIC_DOMAIN
    ? new URL(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`).origin
    : null;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return Response.json(body, { status });
}

async function staticFile(pathname) {
  if (!publicRoot) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const candidate = resolve(publicRoot, `.${decoded === "/" ? "/index.html" : decoded}`);
  try {
    const actualPath = await realpath(candidate);
    const relativePath = relative(publicRoot, actualPath);
    if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
      return null;
    }
    if (!(await stat(actualPath)).isFile()) return null;
    return new Response(Bun.file(actualPath));
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "EINVAL"].includes(error.code)) return null;
    throw error;
  }
}

async function route(request, runtime) {
  const { pathname } = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  if (pathname === "/api/links") {
    if (request.method === "GET") return json([...links.values()]);
    if (request.method === "POST") {
      let original;
      try {
        const body = await request.json();
        if (typeof body?.url !== "string") throw new Error("Missing URL");
        original = new URL(body.url);
        if (!["http:", "https:"].includes(original.protocol)) throw new Error("Invalid protocol");
      } catch {
        return json({ error: "Provide a valid http or https URL." }, 400);
      }
      let code;
      do {
        code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
      } while (links.has(code));
      const link = {
        code,
        url: original.href,
        shortUrl: `${configuredOrigin ?? `http://localhost:${runtime.port}`}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return json(link, 201);
    }
    return json({ error: "Method not allowed." }, 405);
  }

  if (request.method === "GET") {
    const file = await staticFile(pathname);
    if (file) return file;
    const link = links.get(pathname.slice(1));
    if (link) {
      link.hits += 1;
      return new Response(null, { status: 302, headers: { Location: link.url } });
    }
  }
  return json({ error: "Not found." }, 404);
}

export const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(request, runtime) {
    let response;
    try {
      response = await route(request, runtime);
    } catch (error) {
      console.error(error);
      response = json({ error: "Internal server error." }, 500);
    }
    for (const [name, value] of Object.entries(corsHeaders)) response.headers.set(name, value);
    return response;
  },
});

console.log(`Snip backend listening on http://localhost:${server.port}`);