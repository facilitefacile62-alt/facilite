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
  
  // Replace the previous fix with a non-flex-1 version that works in all browsers
  content = content.replace(
    /className="overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800\/60 flex-1 min-h-\[300px\] sm:min-h-\[400px\]"/g,
    'className="overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 min-h-[300px] max-h-[50vh] sm:max-h-[400px]"'
  );
  
  content = content.replace(
    /className="overflow-y-auto divide-y divide-gray-100 flex-1 min-h-\[300px\] sm:min-h-\[400px\]"/g,
    'className="overflow-y-auto divide-y divide-gray-100 min-h-[300px] max-h-[50vh] sm:max-h-[400px]"'
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    changedCount++;
  }
});
console.log(`Changed ${changedCount} files.`);
