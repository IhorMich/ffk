const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'www');
const files = ['index.html', 'manifest.webmanifest', 'sw.js', 'privacy.html'];
const dirs = ['css', 'js', 'fonts', 'icons'];

function copyDir(src, dst){
  fs.mkdirSync(dst, {recursive: true});
  for(const name of fs.readdirSync(src)){
    const from = path.join(src, name);
    const to = path.join(dst, name);
    if(fs.statSync(from).isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

fs.rmSync(dest, {recursive: true, force: true});
fs.mkdirSync(dest, {recursive: true});
for(const file of files){
  fs.copyFileSync(path.join(root, file), path.join(dest, file));
}
for(const dir of dirs){
  copyDir(path.join(root, dir), path.join(dest, dir));
}
