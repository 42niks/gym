import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const processes = [];
let shuttingDown = false;
let exitCode = 0;

function spawnManagedProcess(name, command, args, envOverrides = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    detached: true,
    env: { ...process.env, ...envOverrides },
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      console.log(`[dev] ${name} exited from ${signal}`);
    } else if (code && code !== 0) {
      console.log(`[dev] ${name} exited with code ${code}`);
      exitCode = code;
    } else {
      console.log(`[dev] ${name} exited`);
    }

    shutdown(code && code !== 0 ? code : exitCode || 0);
  });

  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }

    console.error(`[dev] Failed to start ${name}:`, error);
    exitCode = 1;
    shutdown(exitCode);
  });

  processes.push({ name, child });
}

function killProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    return false;
  }
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const { child } of processes) {
    if (!child.killed) {
      killProcessGroup(child.pid, 'SIGTERM');
    }
  }

  setTimeout(() => {
    for (const { child } of processes) {
      if (child.exitCode === null && child.signalCode === null) {
        killProcessGroup(child.pid, 'SIGKILL');
      }
    }
  }, 1500).unref();

  setTimeout(() => {
    process.exit(code);
  }, 1600).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

spawnManagedProcess(
  'server',
  process.execPath,
  [path.join(rootDir, 'node_modules/tsx/dist/cli.mjs'), 'watch', 'src/index.ts'],
  { PORT: process.env.SERVER_PORT ?? '8099' },
);

spawnManagedProcess('client', process.execPath, [
  path.join(rootDir, 'node_modules/vite/bin/vite.js'),
]);
