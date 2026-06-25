#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
const storageAdapterJs = fs.readFileSync(path.join(dir, 'storage-adapter.js'), 'utf8');
const configJs = fs.readFileSync(path.join(dir, 'config.js'), 'utf8');
const topicJs = fs.readFileSync(path.join(dir, 'topic.js'), 'utf8');
const appJs = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');

// 1. Clean JS files to remove ES Module export/import keywords
const cleanedStorageAdapterJs = storageAdapterJs.replace(/export\s+\{\s*StorageAdapter\s*\}\s*;?/g, '');
const cleanedConfigJs = configJs.replace(/export\s+const\s+APP_CONFIG\s*=/g, 'const APP_CONFIG =');
const cleanedTopicJs = topicJs.replace(/export\s+const\s+topicNouns\s*=/g, 'const topicNouns =');

// Remove import statements in app.js
let cleanedAppJs = appJs
  .replace(/import\s+\{\s*StorageAdapter\s*\}\s+from\s+['"]\.\/storage-adapter\.js['"]\s*;?/g, '')
  .replace(/import\s+\{\s*APP_CONFIG\s*\}\s+from\s+['"]\.\/config\.js['"]\s*;?/g, '')
  .replace(/import\s+\{\s*topicNouns\s*\}\s+from\s+['"]\.\/topic\.js['"]\s*;?/g, '');

// 2. Replace CSS link tag
let output = html.replace(
  /<link\s+rel="stylesheet"\s+href="style\.css"\s*\/?>/i,
  `<style>\n${css}\n</style>`
);

// 3. Replace module script tags with a single inline non-module script tag
const scriptRegex = /<script\s+type="module"\s+src="storage-adapter\.js"><\/script>\s*<script\s+type="module"\s+src="config\.js"><\/script>\s*<script\s+type="module"\s+src="topic\.js"><\/script>\s*<script\s+type="module"\s+src="app\.js"><\/script>/i;

if (scriptRegex.test(output)) {
  output = output.replace(
    scriptRegex,
    `<script>\n${cleanedStorageAdapterJs}\n${cleanedConfigJs}\n${cleanedTopicJs}\n${cleanedAppJs}\n</script>`
  );
} else {
  // Try backup simple replacements if regex fails
  console.warn('Warning: Script pattern match failed, trying fallback replacements.');
  output = output
    .replace('<script type="module" src="storage-adapter.js"></script>', '')
    .replace('<script type="module" src="config.js"></script>', '')
    .replace('<script type="module" src="topic.js"></script>', '')
    .replace('<script type="module" src="app.js"></script>', `<script>\n${cleanedStorageAdapterJs}\n${cleanedConfigJs}\n${cleanedTopicJs}\n${cleanedAppJs}\n</script>`);
}

fs.writeFileSync(path.join(dir, 'dist.html'), output, 'utf8');
console.log('Built dist.html successfully.');
