import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const processes = [
  spawn(process.execPath, ['server/index.mjs'], { cwd, stdio: 'inherit', shell: false, windowsHide: true }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { cwd, stdio: 'inherit', shell: false, windowsHide: true }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of processes) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === 'win32') {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
      killer.on('error', () => child.kill());
    } else child.kill();
  }
}
for (const child of processes) {
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('exit', (code) => stop(code || 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
