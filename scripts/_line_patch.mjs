// TEMP helper: delete an inclusive 1-based line range from a file.
// Usage: node scripts/_line_patch.mjs <file> <startLine> <endLine>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , file, startArg, endArg] = process.argv;
const start = Number(startArg);
const end = Number(endArg);
if (!file || !Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
  console.error('usage: node scripts/_line_patch.mjs <file> <startLine> <endLine>');
  process.exit(1);
}
const lines = readFileSync(file, 'utf8').split(/\r?\n/);
if (end > lines.length) {
  console.error(`range ${start}-${end} exceeds file length ${lines.length}`);
  process.exit(1);
}
const removed = lines.splice(start - 1, end - start + 1);
writeFileSync(file, lines.join('\n'), 'utf8');
console.log(`removed ${removed.length} lines (${start}-${end}) from ${file}`);
