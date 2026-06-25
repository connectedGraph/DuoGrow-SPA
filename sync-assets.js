import fs from 'fs';
import path from 'path';

const files = [
  'index.html',
  'style.css',
  'app.js',
  'config.js',
  'topic.js',
  'storage-adapter.js'
];

const destDir = './www';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

files.forEach(file => {
  fs.copyFileSync(file, path.join(destDir, file));
});
console.log('Assets synced to www/ successfully.');
