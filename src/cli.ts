#!/usr/bin/env node

function main(argv: string[]): number {
  const [poFilePath] = argv;

  if (!poFilePath) {
    console.error('Usage: msgai <file.po>');
    return 1;
  }

  console.log(`[MVP] msgai received file: ${poFilePath}`);
  return 0;
}

const exitCode = main(process.argv.slice(2));
process.exit(exitCode);
