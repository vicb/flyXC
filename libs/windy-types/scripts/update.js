import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const srcDir = path.join(packageRoot, 'src');
const typesDir = path.join(srcDir, 'types');

async function main() {
  const args = process.argv.slice(2);
  let localDir = null;
  let version = 'latest';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--local' && args[i + 1]) {
      localDir = path.resolve(process.cwd(), args[i + 1]);
      i++;
    } else if (!args[i].startsWith('-')) {
      version = args[i];
    }
  }

  const pkgJsonFile = path.join(packageRoot, 'package.json');
  const pkgData = JSON.parse(fs.readFileSync(pkgJsonFile, 'utf8'));

  // If local directory is not explicitly passed, check if a local source exists as fallback
  const fallbackLocalDir = fs.existsSync(typesDir) ? typesDir : path.resolve(packageRoot, '../windy-sounding/types');

  let extractedTypesPath;
  let tmpDir = null;
  let resolvedVersion = version !== 'latest' ? version : pkgData.version || '3.0.4';

  if (localDir && fs.existsSync(localDir)) {
    console.log(`Using local types from: ${localDir}`);
    extractedTypesPath = localDir;
    const localPkgPath = [path.join(localDir, 'package.json'), path.join(localDir, '../package.json')].find((p) =>
      fs.existsSync(p),
    );
    if (localPkgPath) {
      try {
        const localPkgData = JSON.parse(fs.readFileSync(localPkgPath, 'utf8'));
        if (localPkgData.version) {
          resolvedVersion = localPkgData.version;
        }
      } catch {
        // Ignore parse error
      }
    }
  } else {
    // Attempt npm pack
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'windy-types-'));
    try {
      console.log(`Downloading @windycom/plugin-devtools@${version} via npm pack (zero dependency install)...`);
      const packOutput = execSync(`npm pack @windycom/plugin-devtools@${version} --pack-destination "${tmpDir}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      const tarballName = packOutput.split('\n').pop()?.trim();
      if (!tarballName) {
        throw new Error('Could not determine tarball name from npm pack');
      }
      const tarballPath = path.join(tmpDir, tarballName);
      console.log(`Extracting types from ${tarballName}...`);
      execSync(`tar -xzf "${tarballPath}" -C "${tmpDir}" package/types package/package.json`, { stdio: 'pipe' });
      extractedTypesPath = path.join(tmpDir, 'package/types');

      const pkgJsonPath = path.join(tmpDir, 'package/package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgData = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        resolvedVersion = pkgData.version || version;
      }
    } catch (err) {
      if (fs.existsSync(fallbackLocalDir)) {
        console.warn(
          `Could not fetch from npm (${err.message}). Falling back to existing local types: ${fallbackLocalDir}`,
        );
        extractedTypesPath = fallbackLocalDir;
      } else {
        throw err;
      }
    }
  }

  if (!fs.existsSync(extractedTypesPath)) {
    throw new Error(`Types directory not found: ${extractedTypesPath}`);
  }

  // 1. Prepare target directory and copy files if not using existing typesDir
  if (extractedTypesPath !== typesDir) {
    if (fs.existsSync(typesDir)) {
      fs.rmSync(typesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(typesDir, { recursive: true });
    console.log(`Copying types into ${typesDir}...`);
    fs.cpSync(extractedTypesPath, typesDir, { recursive: true });
  }

  // 3. Generate windy-exports.d.ts from pristine types/client/commonExports.d.ts
  const commonExportsFile = path.join(typesDir, 'client/commonExports.d.ts');
  const windyExportsFile = path.join(srcDir, 'windy-exports.d.ts');
  if (fs.existsSync(commonExportsFile)) {
    console.log('Generating windy-exports.d.ts from pristine client/commonExports.d.ts...');
    const content = fs.readFileSync(commonExportsFile, 'utf8');
    const exportLines = content
      .split('\n')
      .map((line) => line.replace(/from\s+['"]\.\/[^'"]+\/([^'"]+)['"]/g, "from './types/client/$1'"))
      .filter((line) => line.startsWith('export '));

    exportLines.sort((a, b) => a.localeCompare(b));

    const transformed = [
      '// This file is auto-generated from types/client/commonExports.d.ts by update.js.',
      '// DO NOT EDIT DIRECTLY.',
      '',
      ...exportLines,
      '',
    ].join('\n');
    fs.writeFileSync(windyExportsFile, transformed, 'utf8');
  }

  // 4. Discover all .d.ts files and generate ambient module declarations
  console.log('Generating index.d.ts with ambient @windy/* and global W declarations...');
  const moduleDeclarations = [];
  const registeredModules = new Set();

  function registerModule(moduleName, relativeFilePath) {
    if (registeredModules.has(moduleName)) {
      return;
    }
    registeredModules.add(moduleName);

    const fullPath = path.join(srcDir, relativeFilePath);
    let hasDefault = false;
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf8');
      hasDefault = /export\s+default\s+|export\s*\{\s*default\s*\}|export\s*\{\s*[^}]*\bdefault\b[^}]*\}/.test(code);
    }

    const importTarget = './' + relativeFilePath.replace(/\.d\.ts$/, '');
    const lines = [`declare module '${moduleName}' {`, `  export * from '${importTarget}';`];
    if (hasDefault) {
      lines.push(`  export { default } from '${importTarget}';`);
    }
    lines.push('}');
    moduleDeclarations.push(lines.join('\n'));
  }

  // Level 1: types/*.d.ts
  for (const file of fs.readdirSync(typesDir)) {
    if (file.endsWith('.d.ts')) {
      const base = file.replace(/\.d\.ts$/, '');
      const relPath = `types/${file}`;
      registerModule(`@windy/${base}`, relPath);
      registerModule(`@windy/${base}.d`, relPath);
      if (base === 'leaflet-gl') {
        registerModule('@leafletGl', relPath);
      }
    }
  }

  // Level 2: types/client/*.d.ts
  const clientDir = path.join(typesDir, 'client');
  if (fs.existsSync(clientDir)) {
    for (const file of fs.readdirSync(clientDir)) {
      if (file.endsWith('.d.ts')) {
        const base = file.replace(/\.d\.ts$/, '');
        const relPath = `types/client/${file}`;
        registerModule(`@windy/${base}`, relPath);
        registerModule(`@windy/${base}.d`, relPath);
        registerModule(`@windy/client/${base}`, relPath);
        registerModule(`@windy/client/${base}.d`, relPath);
      }
    }
  }

  // Level 3: types/client/d.ts.files/*.d.ts
  const subClientDir = path.join(clientDir, 'd.ts.files');
  if (fs.existsSync(subClientDir)) {
    for (const file of fs.readdirSync(subClientDir)) {
      if (file.endsWith('.d.ts')) {
        const base = file.replace(/\.d\.ts$/, '');
        const relPath = `types/client/d.ts.files/${file}`;
        registerModule(`@windy/${base}`, relPath);
        registerModule(`@windy/${base}.d`, relPath);
        registerModule(`@windy/client/${base}`, relPath);
        registerModule(`@windy/client/${base}.d`, relPath);
        registerModule(`@windy/client/d.ts.files/${base}`, relPath);
        registerModule(`@windy/client/d.ts.files/${base}.d`, relPath);
      }
    }
  }

  const cleanVersion = resolvedVersion.replace(/^v/, '');

  const indexDtsContent = [
    '// This file is auto-generated by @flyxc/windy-types update script.',
    `// Source package: @windycom/plugin-devtools@${cleanVersion}`,
    '// DO NOT EDIT DIRECTLY.',
    '',
    "import type * as WindyExports from './windy-exports';",
    '',
    'declare const W: typeof WindyExports;',
    '',
    "declare module '@plugins/*';",
    "declare module '@capacitor/*';",
    "declare module '@windy-types/*';",
    '',
    moduleDeclarations.join('\n\n'),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(srcDir, 'index.d.ts'), indexDtsContent, 'utf8');

  // 5. Update package.json version
  pkgData.version = cleanVersion;
  pkgData.exports = {
    '.': './src/index.d.ts',
    './*': {
      types: './src/*.d.ts',
      default: './src/*',
    },
  };
  fs.writeFileSync(pkgJsonFile, JSON.stringify(pkgData, null, 2) + '\n', 'utf8');

  // 6. Cleanup tmpDir
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`Successfully updated @flyxc/windy-types to v${pkgData.version}!`);
}

main().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
