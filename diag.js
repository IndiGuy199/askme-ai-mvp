const fs = require('fs');
const path = require('path');

const SIZE_LIMIT_MB = 10;

function scanDir(dir, results = [], parent = '') {
  try {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch (err) {
        // Skip files/folders we can't access
        return;
      }
      if (stats.isDirectory()) {
        scanDir(filePath, results, path.join(parent, file));
      } else {
        results.push({
          path: path.join(parent, file),
          sizeMB: stats.size / (1024 * 1024)
        });
      }
    });
  } catch (err) {
    // Print the directory that caused an error
    console.error(`Error reading directory ${dir}: ${err.message}`);
  }
  return results;
}

function main() {
  const root = process.cwd();
  console.log(`🔎 Scanning directory: ${root} ...`);
  const files = scanDir(root);

  // 1. Large files
  const largeFiles = files.filter(f => f.sizeMB > SIZE_LIMIT_MB);
  if (largeFiles.length) {
    console.log('\n🚨 Large Files (>10MB):');
    largeFiles.forEach(f =>
      console.log(`${f.path} — ${f.sizeMB.toFixed(2)} MB`)
    );
  } else {
    console.log('\n✅ No files over 10MB found.');
  }

  // 2. Hidden files/folders
  const hiddenFiles = files.filter(f =>
    f.path.split(path.sep).some(part => part.startsWith('.'))
  );
  if (hiddenFiles.length) {
    console.log('\n👀 Hidden files/folders:');
    hiddenFiles.forEach(f => console.log(f.path));
  } else {
    console.log('\n✅ No hidden files or folders detected.');
  }

  // 3. File count
  console.log(`\n📦 Total files scanned: ${files.length}`);
}

main();
