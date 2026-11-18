import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const expo = fileURLToPath(import.meta.resolve('expo/bin/cli'));
const args = ['export', '--platform', 'android', '--platform', 'ios'];

if (process.platform === 'linux' && process.arch === 'arm64') {
  console.log('Linux ARM64: exporting JavaScript bundles without Hermes bytecode (the bundled compiler is x86-64).');
  args.push('--no-bytecode');
}

const result = spawnSync(process.execPath, [expo, ...args, ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
