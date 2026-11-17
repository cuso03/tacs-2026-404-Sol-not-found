import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

try {
  const { report } = JSON.parse(await readFile(new URL('../../observability-results/latest.json', import.meta.url), 'utf8'));
  console.log(`Reporte: ${report}`);
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  const child = spawn(command, [pathToFileURL(report).href], { stdio: 'inherit' });
  child.once('error', error => { console.error(`Abrí el archivo en tu navegador: ${error.message}`); process.exitCode = 1; });
  child.once('exit', code => { if (code) process.exitCode = code; });
} catch {
  console.error('Todavía no hay reporte. Ejecutá npm run observability:run.');
  process.exitCode = 1;
}
