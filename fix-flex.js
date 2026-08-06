const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  content = content.replace(
    /className="overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800\/60 flex-1"/g,
    'className="overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 flex-1 min-h-[300px] sm:min-h-[400px]"'
  );
  
  content = content.replace(
    /className="overflow-y-auto divide-y divide-gray-100 flex-1"/g,
    'className="overflow-y-auto divide-y divide-gray-100 flex-1 min-h-[300px] sm:min-h-[400px]"'
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    changedCount++;
  }
});
console.log(`Changed ${changedCount} files.`);
