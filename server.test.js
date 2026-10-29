import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let server;
let publicDir;
let base;
const originalEnv = { ...process.env };

beforeAll(async () => {
  publicDir = await mkdtemp(join(tmpdir(), "snip-test-"));
  await writeFile(join(publicDir, "index.html"), "<h1>Snip</h1>");
  process.env.PORT = "0";
  process.env.BASE_URL = "https://snip.example/ignored-path";
  process.env.PUBLIC_DIR = publicDir;
  ({ server } = await import("./server.js"));
  base = `http://localhost:${server.port}`;
});

afterAll(async () => {
  server?.stop(true);
  await rm(publicDir, { recursive: true, force: true });
  for (const key of ["PORT", "BASE_URL", "PUBLIC_DIR"]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test("starts with an empty list and supports CORS preflight", async () => {
  const list = await fetch(`${base}/api/links`);
  expect(list.status).toBe(200);
  expect(await list.json()).toEqual([]);
  const response = await fetch(`${base}/api/links`, { method: "OPTIONS" });
  expect(response.status).toBe(204);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
});

test("rejects malformed JSON and invalid URLs", async () => {
  for (const body of ["{", "null", "{}", '{"url":42}', '{"url":"ftp://example.com"}', '{"url":"not a URL"}']) {
    const response = await fetch(`${base}/api/links`, { method: "POST", body });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeString();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  }
});

test("creates, lists, redirects, counts hits, and prioritizes static files", async () => {
  const response = await fetch(`${base}/api/links`, {
    method: "POST",
    body: JSON.stringify({ url: "https://example.com/tutorial" }),
  });
  expect(response.status).toBe(201);
  const link = await response.json();
  expect(Object.keys(link).sort()).toEqual(["code", "createdAt", "hits", "shortUrl", "url"]);
  expect(link.code).toMatch(/^[a-zA-Z0-9]{6}$/);
  expect(link.hits).toBe(0);
  expect(link.shortUrl).toBe(`https://snip.example/${link.code}`);
  expect(new Date(link.createdAt).toISOString()).toBe(link.createdAt);
  const redirect = await fetch(`${base}/${link.code}`, { redirect: "manual" });
  expect(redirect.status).toBe(302);
  expect(redirect.headers.get("Location")).toBe(link.url);
  expect(redirect.headers.get("Access-Control-Allow-Origin")).toBe("*");
  const listed = await (await fetch(`${base}/api/links`)).json();
  expect(listed).toEqual([{ ...link, hits: 1 }]);
  await writeFile(join(publicDir, link.code), "static wins");
  const file = await fetch(`${base}/${link.code}`, { redirect: "manual" });
  expect(file.status).toBe(200);
  expect(await file.text()).toBe("static wins");
  expect((await (await fetch(`${base}/api/links`)).json())[0].hits).toBe(1);
});

test("serves index.html and returns 404 for unknown paths and traversal", async () => {
  expect(await (await fetch(`${base}/`)).text()).toBe("<h1>Snip</h1>");
  for (const path of ["/unknown", "/%2e%2e%2fpackage.json", "/%E0%A4%A"]) {
    const response = await fetch(`${base}${path}`);
    expect(response.status).toBe(404);
  }
});