import { spawnSync } from 'node:child_process';
import { access, copyFile, cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const layers = ['backend', 'frontend', 'cli'];
const pointers = [...layers, 'bundle'];
const bundle = join(root, 'bundle');

function run(executable, args, cwd = root, capture = false) {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    shell: process.platform === 'win32' && executable === 'npm'
  });
  if (result.error) throw new Error(`Cannot run ${executable}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${executable} ${args.join(' ')} failed (${result.status}).${capture ? `\n${result.stderr}` : ''}`);
  }
  return capture ? result.stdout.trim() : '';
}

function git(args, cwd = root) {
  return run('git', args, cwd, true);
}

function stagedChanges(cwd) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd });
  if (result.error) throw result.error;
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new Error(`Cannot inspect staged changes in ${cwd}.`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertClean(cwd, label) {
  if (git(['status', '--porcelain', '--untracked-files=normal'], cwd)) {
    throw new Error(`${label} has local changes. Commit, stash, or remove them before building.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--push')) throw new Error('Usage: node scripts/build-bundle.mjs [--push]');
  const shouldPush = args.includes('--push');
  if (git(['branch', '--show-current']) !== 'main') throw new Error('Run this script from the main checkout.');
  if (git(['diff', '--cached', '--name-only'])) throw new Error('The superproject index must be empty before building.');
  if (git(['status', '--porcelain', '--untracked-files=no', '--ignore-submodules=all'])) {
    throw new Error('Commit tracked superproject changes before building.');
  }
  const author = git(['config', 'user.name']);
  const email = git(['config', 'user.email']);
  for (const layer of pointers) {
    const directory = join(root, layer);
    if (await exists(join(directory, '.git'))) assertClean(directory, layer);
  }

  run('git', ['submodule', 'update', '--init', '--remote', ...layers]);
  if (!(await exists(join(bundle, '.git')))) run('git', ['submodule', 'update', '--init', 'bundle']);
  run('git', ['fetch', 'origin', 'bundle'], bundle);
  run('git', ['merge', '--ff-only', 'origin/bundle'], bundle);

  const frontend = join(root, 'frontend');
  const output = join(frontend, 'dist', 'snip-frontend', 'browser');
  await rm(output, { recursive: true, force: true });
  run('npm', ['install'], frontend);
  run(process.execPath, [join(frontend, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'), 'build'], frontend);
  if (!(await exists(join(output, 'index.html')))) {
    throw new Error(`Angular build output is missing: ${join(output, 'index.html')}`);
  }
  for (const layer of layers) assertClean(join(root, layer), layer);

  await mkdir(bundle, { recursive: true });
  for (const entry of await readdir(bundle)) {
    if (entry !== '.git') await rm(join(bundle, entry), { recursive: true, force: true });
  }
  await copyFile(join(root, 'backend', 'server.js'), join(bundle, 'server.js'));
  await copyFile(join(root, 'cli', 'cli.js'), join(bundle, 'cli.js'));
  await cp(output, join(bundle, 'public'), { recursive: true });
  const files = {
    'README.md': '# Generated Snip Release\n\nThis branch is generated output. Do not hand-edit.\nRebuild from main with node scripts/build-bundle.mjs.\n',
    '.env': 'PUBLIC_DIR=./public\n',
    '.gitignore': 'node_modules/\n',
    'package.json': `${JSON.stringify({
      name: 'snip-bundle',
      version: '1.0.0',
      private: true,
      scripts: { start: 'bun server.js' }
    }, null, 2)}\n`,
    'Dockerfile': 'FROM oven/bun:1-alpine\nWORKDIR /app\nCOPY . .\nENV PORT=3000\nEXPOSE 3000\nCMD ["bun", "server.js"]\n',
    '.dockerignore': '.git\n.gitignore\nnode_modules\n*.log\n',
    'railway.json': `${JSON.stringify({
      $schema: 'https://railway.app/railway.schema.json',
      build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' }
    }, null, 2)}\n`
  };
  for (const [name, content] of Object.entries(files)) await writeFile(join(bundle, name), content);

  run('git', ['add', '-A'], bundle);
  run('git', ['add', '--force', '.env'], bundle);
  if (stagedChanges(bundle)) {
    run('git', ['-c', `user.name=${author}`, '-c', `user.email=${email}`, 'commit', '-m', 'Generate Snip release bundle'], bundle);
  } else {
    console.log('Bundle unchanged: nothing to commit.');
  }
  run('git', ['add', '--', ...pointers]);
  if (stagedChanges(root)) {
    run('git', ['commit', '-m', 'Bump source and bundle submodule pointers']);
  } else {
    console.log('Superproject unchanged: nothing to commit.');
  }

  if (shouldPush) {
    run('git', ['push', 'origin', 'HEAD:bundle'], bundle);
    run('git', ['push', 'origin', 'HEAD:main']);
  } else {
    console.log('Local build complete. Nothing pushed; rerun with --push to publish.');
  }
}

try {
  await main();
} catch (error) {
  console.error(`Bundle build failed: ${error.message}`);
  process.exitCode = 1;
}