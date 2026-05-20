#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
const configJs = fs.readFileSync(path.join(dir, 'config.js'), 'utf8');
const topicJs = fs.readFileSync(path.join(dir, 'topic.js'), 'utf8');
const appJs = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');

let output = html;
output = output.replace(
    '<link rel="stylesheet" href="style.css" />',
    `<style>\n${css}\n</style>`
);
output = output.replace(
    '  <script src="config.js"></script>\n  <script src="topic.js"></script>\n  <script src="app.js"></script>',
    `<script>\n${configJs}\n${topicJs}\n${appJs}\n</script>`
);

fs.writeFileSync(path.join(dir, 'dist.html'), output, 'utf8');
console.log('Built dist.html successfully.');
