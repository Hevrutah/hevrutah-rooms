/**
 * Simple dev startup script — starts API then Vite in sequence.
 * Usage: npm run dev:all
 */
import { spawn } from 'child_process';
import { createConnection } from 'net';

const API_PORT = 3001;
const isWindows = process.platform === 'win32';
const shell = isWindows ? 'cmd' : 'sh';
const shellFlag = isWindows ? '/c' : '-c';

function run(cmd, label) {
  const child = spawn(shell, [shellFlag, cmd], {
    stdio: 'inherit',
    shell: false,
  });
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`\n[${label}] exited with code ${code}`);
    }
  });
  return child;
}

function waitForPort(port, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      const sock = createConnection(port, '127.0.0.1');
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - start > timeout) return reject(new Error(`Port ${port} not ready after ${timeout}ms`));
        setTimeout(check, 200);
      });
    }
    check();
  });
}

console.log('\n  Starting Hevrutah dev servers...\n');

// 1. Start API
const api = run('npx tsx server/local-dev.ts', 'API');

// 2. Wait for API to be ready, then start Vite
waitForPort(API_PORT)
  .then(() => {
    console.log('  API ready — starting Vite...\n');
    const ui = run('npx vite', 'UI');

    // On Ctrl+C, kill both
    process.on('SIGINT', () => { api.kill(); ui.kill(); process.exit(0); });
    process.on('SIGTERM', () => { api.kill(); ui.kill(); process.exit(0); });

    ui.on('exit', () => { api.kill(); });
    api.on('exit', () => { ui.kill(); });
  })
  .catch((err) => {
    console.error('  ✗ API did not start:', err.message);
    api.kill();
    process.exit(1);
  });
