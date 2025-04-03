import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const getPackageVersion = () =>
  JSON.parse(readFileSync('./package.json', 'utf-8')).version;

const getConfig = (isMinified = false) => {
  const packageVersion = getPackageVersion();

  const fileName = isMinified
    ? 'mikroauth-client.min.js'
    : 'mikroauth-client.js';

  const message = isMinified
    ? `Bundling version ${packageVersion} (minified) of MikroAuth client to "${fileName}"...`
    : `Bundling version ${packageVersion} of MikroAuth client to "${fileName}"...`;

  console.log(message);

  return {
    entryPoints: ['./src/index.ts'],
    outfile: `lib/${fileName}`,
    target: ['chrome133', 'safari18', 'edge132'],
    format: 'iife',
    minify: isMinified,
    treeShaking: true,
    bundle: true,
    sourcemap: false
  };
};

// Build regular package
build(getConfig()).catch(() => process.exit(1));

// Build minified package
build(getConfig(true)).catch(() => process.exit(1));
