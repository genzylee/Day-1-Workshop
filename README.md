# Snip CLI

Zero-dependency Node 20+ client for the Snip backend. Uses CommonJS and global
fetch; no installation is needed. Keep package.json free of `"type": "module"`:
the generated release bundle also runs this file as CommonJS.

```sh
node cli.js help
node cli.js add https://example.com
node cli.js ls
node cli.js open Ab12Cd
```

The API defaults to http://localhost:3000. Set `SNIP_API` to use another backend:

```sh
SNIP_API=https://snip.example node cli.js ls
```

In PowerShell: `$env:SNIP_API = 'https://snip.example'`.

Local launchers forward all arguments and preserve the exit code: `./snip` on
macOS/Linux, `snip.cmd` in cmd.exe, or `./snip.ps1` in PowerShell. Use `npm link`
optionally to install the `snip` command from the package's bin entry.

`add` prints only the returned short URL. `ls` prints an aligned code/hits/url
table, or `No links yet.`. `open` requests the short code without following its
redirect, then passes the HTTP(S) Location target to the OS browser launcher
(`start`, `open`, or `xdg-open`). Opening a code increments its backend hit count.

Bad arguments, unknown codes, backend errors, network failures, and browser
launcher failures print to stderr and exit 1. Run `npm test` for dependency-free
tests; browser launching is mocked. Backend storage is in-memory by design.