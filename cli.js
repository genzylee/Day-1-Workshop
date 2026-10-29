#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');

const usage = `Snip - a tiny URL shortener

Usage:
  snip add <url>    Shorten an http or https URL
  snip ls           List codes, hit counts, and original URLs
  snip open <code>  Open the original URL in your browser
  snip help         Show this help

SNIP_API sets the backend URL (default: http://localhost:3000).`;

function httpUrl(value, label) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
    return url;
  } catch {
    throw new Error(`${label} must be a valid http or https URL.`);
  }
}

async function request(base, path, options = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, { ...options, redirect: 'manual', signal: AbortSignal.timeout(10000) });
  } catch {
    throw new Error(`Cannot reach backend at ${base}. Check SNIP_API and that the server is running.`);
  }
  if (response.status >= 400) {
    let message = response.status === 404 ? 'Unknown code or endpoint.' : `Backend returned HTTP ${response.status}.`;
    try {
      const body = await response.json();
      if (typeof body.error === 'string') message = body.error;
    } catch {}
    throw new Error(message);
  }
  return response;
}

async function openBrowser(url) {
  const options = { stdio: 'ignore' };
  let command;
  let args;
  if (process.platform === 'win32') {
    command = process.env.ComSpec || 'cmd.exe';
    args = ['/d', '/s', '/c', 'start "" "%SNIP_OPEN_URL%"'];
    options.windowsVerbatimArguments = true;
    options.env = { ...process.env, SNIP_OPEN_URL: url };
  } else {
    command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    args = [url];
  }
  await new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, options);
    child.once('error', () => reject(new Error('Cannot launch the system browser.')));
    child.once('close', code => code === 0 ? resolve() : reject(new Error('The system browser launcher failed.')));
  });
}

async function main(args = process.argv.slice(2)) {
  const [command, value] = args;
  if (!args.length || (['help', '--help', '-h'].includes(command) && args.length === 1)) {
    console.log(usage);
    return;
  }
  if (!['add', 'ls', 'open'].includes(command) || args.length !== (command === 'ls' ? 1 : 2)) {
    throw new Error('Invalid command or arguments. Run "snip help" for usage.');
  }
  if (command === 'add') httpUrl(value, 'URL');
  if (command === 'open' && !/^[A-Za-z0-9]{6}$/.test(value)) {
    throw new Error('Code must contain exactly six letters or digits.');
  }
  const api = httpUrl(process.env.SNIP_API || 'http://localhost:3000', 'SNIP_API');
  if (api.search || api.hash) throw new Error('SNIP_API must not contain a query or fragment.');
  const base = api.href.replace(/\/+$/, '');

  if (command === 'add') {
    const response = await request(base, '/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: value })
    });
    const link = await response.json();
    if (response.status !== 201 || typeof link.shortUrl !== 'string') throw new Error('Invalid response from backend.');
    console.log(link.shortUrl);
  } else if (command === 'ls') {
    const response = await request(base, '/api/links');
    const links = await response.json();
    if (!Array.isArray(links)) throw new Error('Invalid response from backend.');
    if (!links.length) {
      console.log('No links yet.');
      return;
    }
    const codeWidth = Math.max(4, ...links.map(link => String(link.code).length));
    const hitsWidth = Math.max(4, ...links.map(link => String(link.hits).length));
    console.log(`${'CODE'.padEnd(codeWidth)}  ${'HITS'.padStart(hitsWidth)}  URL`);
    for (const link of links) {
      console.log(`${String(link.code).padEnd(codeWidth)}  ${String(link.hits).padStart(hitsWidth)}  ${link.url}`);
    }
  } else {
    const response = await request(base, `/${value}`);
    const location = response.headers.get('Location');
    if (response.status !== 302 || !location) throw new Error('Backend did not return a redirect target.');
    const target = httpUrl(new URL(location, base).href, 'Redirect target');
    await openBrowser(target.href);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`snip: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };