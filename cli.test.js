'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const childProcess = require('node:child_process');
const { promisify } = require('node:util');
const { join } = require('node:path');
const { EventEmitter } = require('node:events');
const { main } = require('./cli.js');

const execFile = promisify(childProcess.execFile);
const cli = join(__dirname, 'cli.js');
let server;
let base;
let links = [];
let redirectRequests = 0;
let lastBody;

function run(args, api = base) {
  return execFile(process.execPath, [cli, ...args], { env: { ...process.env, SNIP_API: api } });
}

before(async () => {
  server = http.createServer(async (request, response) => {
    if (request.url === '/api/links' && request.method === 'POST') {
      let body = '';
      for await (const chunk of request) body += chunk;
      lastBody = JSON.parse(body);
      const link = { code: 'Ab12Cd', url: lastBody.url, shortUrl: `${base}/Ab12Cd`, hits: 0, createdAt: new Date().toISOString() };
      links = [link];
      response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(link));
    } else if (request.url === '/api/links') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(links));
    } else if (request.url === '/Ab12Cd') {
      redirectRequests += 1;
      response.writeHead(302, { Location: 'https://example.com/path?first=1&second=2' });
      response.end();
    } else {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Unknown code.' }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('no arguments and help print usage without requiring a valid backend', async () => {
  for (const args of [[], ['help']]) {
    const result = await run(args, 'not-a-url');
    assert.match(result.stdout, /Usage:/);
    assert.equal(result.stderr, '');
  }
});

test('an empty list prints the exact empty-state text', async () => {
  links = [];
  assert.equal((await run(['ls'])).stdout.trim(), 'No links yet.');
});

test('add sends the URL and prints only the returned short URL', async () => {
  const url = 'https://example.com/a?first=1&second=2';
  const result = await run(['add', url]);
  assert.deepEqual(lastBody, { url });
  assert.equal(result.stdout.trim(), `${base}/Ab12Cd`);
  assert.equal(result.stderr, '');
});

test('ls aligns code, hit count, and original URL columns', async () => {
  links = [
    { code: 'Ab12Cd', hits: 2, url: 'https://example.com/first' },
    { code: 'Zy98Xw', hits: 12345, url: 'https://example.com/second' }
  ];
  const output = (await run(['ls'])).stdout.trimEnd().split('\n');
  assert.match(output[0], /^CODE\s+HITS\s+URL$/);
  assert.equal(output[1].indexOf('https://'), output[2].indexOf('https://'));
  assert.match(output[2], /12345/);
});

test('bad input, unknown codes, and unreachable backends use stderr and exit 1', async () => {
  for (const [args, api, message] of [
    [['add'], base, /Invalid command/],
    [['add', 'ftp://example.com'], base, /http or https/],
    [['ls', 'extra'], base, /Invalid command/],
    [['nope'], base, /Invalid command/],
    [['open', '../bad'], base, /six letters or digits/],
    [['open', 'Zz99Zz'], base, /Unknown code/],
    [['ls'], 'http://127.0.0.1:1', /Cannot reach backend/],
    [['ls'], 'invalid', /SNIP_API/]
  ]) {
    await assert.rejects(run(args, api), error => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, '');
      assert.match(error.stderr, message);
      return true;
    });
  }
});

test('open requests the code once and hands Location to the platform launcher', async context => {
  const previous = process.env.SNIP_API;
  process.env.SNIP_API = base;
  let launched;
  context.mock.method(childProcess, 'spawn', (command, args, options) => {
    launched = { command, args, options };
    const child = new EventEmitter();
    process.nextTick(() => child.emit('close', 0));
    return child;
  });
  try {
    await main(['open', 'Ab12Cd']);
    assert.equal(redirectRequests, 1);
    if (process.platform === 'win32') {
      assert.match(launched.command, /cmd\.exe$/i);
      assert.equal(launched.options.env.SNIP_OPEN_URL, 'https://example.com/path?first=1&second=2');
      assert.match(launched.args.at(-1), /start/);
    } else {
      assert.equal(launched.command, process.platform === 'darwin' ? 'open' : 'xdg-open');
      assert.deepEqual(launched.args, ['https://example.com/path?first=1&second=2']);
    }
  } finally {
    if (previous === undefined) delete process.env.SNIP_API;
    else process.env.SNIP_API = previous;
  }
});