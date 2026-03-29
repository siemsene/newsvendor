import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);

const bindingsByTarget = {
  'darwin:arm64': '@rolldown/binding-darwin-arm64',
  'darwin:x64': '@rolldown/binding-darwin-x64',
  'linux:arm64': '@rolldown/binding-linux-arm64-gnu',
  'linux:x64': '@rolldown/binding-linux-x64-gnu',
  'win32:arm64': '@rolldown/binding-win32-arm64-msvc',
  'win32:x64': '@rolldown/binding-win32-x64-msvc',
};

const runtimeTarget = `${process.platform}:${process.arch}`;
const expectedBinding = bindingsByTarget[runtimeTarget];

if (!expectedBinding) {
  process.exit(0);
}

function hasPackage(packageName) {
  try {
    require.resolve(packageName);
    return true;
  } catch {
    return false;
  }
}

if (hasPackage(expectedBinding)) {
  process.exit(0);
}

const knownBindings = Object.values(bindingsByTarget).filter(hasPackage);
const mismatchHint =
  knownBindings.length > 0
    ? `Installed binding package(s): ${knownBindings.join(', ')}`
    : 'No supported @rolldown native binding package is currently installed.';

const reinstallCommand =
  process.platform === 'win32'
    ? 'Remove-Item -Recurse -Force node_modules; Remove-Item -Force package-lock.json; npm install'
    : 'rm -rf node_modules package-lock.json && npm install';

const runtimeLabel =
  process.platform === 'linux' ? 'Linux/WSL' : `${process.platform}/${process.arch}`;

console.error(
  [
    `Missing native rolldown binding for ${runtimeLabel}.`,
    `Expected package: ${expectedBinding}`,
    mismatchHint,
    '',
    'This usually means dependencies were installed from a different operating system than the one running npm right now.',
    'Install dependencies again from the same shell/environment you will use for development.',
    '',
    `Reinstall command for this environment: ${reinstallCommand}`,
  ].join('\n'),
);

process.exit(1);
