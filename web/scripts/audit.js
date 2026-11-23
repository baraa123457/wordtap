const fs = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.next') files = files.concat(walk(full));
    } else if (/\.(tsx|ts|css)$/.test(f)) {
      files.push(full);
    }
  }
  return files;
}

const files = walk('./web/src');

console.log('=== 1. apple-segmented ===');
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (l.includes('apple-segmented')) {
      console.log(`${f}:${i+1}: ${l.trim()}`);
    }
  });
}

console.log('\n=== 2. rounded-full groups with buttons / pills ===');
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (l.includes('rounded-full') && (l.includes('button') || l.includes('<button') || l.includes('apple-segmented') || l.includes('role="radio"') || l.includes('cursor-pointer'))) {
      console.log(`${f}:${i+1}: ${l.trim()}`);
    }
  });
}

console.log('\n=== 3. text-[(8|9|10|11)px] ===');
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (/text-\[(8|9|10|11)px\]/.test(l)) {
      console.log(`${f}:${i+1}: ${l.trim()}`);
    }
  });
}

console.log('\n=== 4. text-xs on buttons / links / pills ===');
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (l.includes('text-xs') && (l.includes('<button') || l.includes('btn') || l.includes('<Link') || l.includes('apple-segmented') || l.includes('cursor-pointer') || l.includes('onClick'))) {
      console.log(`${f}:${i+1}: ${l.trim()}`);
    }
  });
}
