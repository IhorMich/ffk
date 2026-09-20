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

// Vendor: Supabase UMD for Coach cloud mode
const vendorSrc = path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js');
const vendorDir = path.join(root, 'js/vendor');
fs.mkdirSync(vendorDir, {recursive: true});
if(fs.existsSync(vendorSrc)){
  fs.copyFileSync(vendorSrc, path.join(vendorDir, 'supabase.js'));
}

fs.rmSync(dest, {recursive: true, force: true});
fs.mkdirSync(dest, {recursive: true});
for(const file of files){
  fs.copyFileSync(path.join(root, file), path.join(dest, file));
}
for(const dir of dirs){
  copyDir(path.join(root, dir), path.join(dest, dir));
}
