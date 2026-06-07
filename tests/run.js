import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const testFiles = [
  'bookmark.test.js',
  'unlock.test.js',
  'algorithm.test.js',
  'card-optimizer.test.js',
];

function runTest(file) {
  return new Promise((resolve) => {
    const child = fork(join(__dirname, file));
    child.on('exit', (code) => resolve(code));
  });
}

let totalFailed = 0;
for (const file of testFiles) {
  console.log(`\nRunning ${file}...`);
  const code = await runTest(file);
  if (code !== 0) totalFailed++;
}

console.log(`\n${totalFailed} test file(s) failed`);
process.exit(totalFailed > 0 ? 1 : 0);
