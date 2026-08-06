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
  
  // Fix the modal wrapper to have a guaranteed minimum height
  content = content.replace(
    /className="bg-white dark:bg-gray-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col max-h-\[85vh\]"/g,
    'className="bg-white dark:bg-gray-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col min-h-[400px] max-h-[85vh]"'
  );

  // Revert the list container to use flex-1 properly now that the parent has height
  content = content.replace(
    /className="overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800\/60 min-h-\[300px\] max-h-\[50vh\] sm:max-h-\[400px\]"/g,
    'className="overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 flex-1"'
  );
  
  content = content.replace(
    /className="overflow-y-auto divide-y divide-gray-100 min-h-\[300px\] max-h-\[50vh\] sm:max-h-\[400px\]"/g,
    'className="overflow-y-auto divide-y divide-gray-100 flex-1"'
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    changedCount++;
  }
});
console.log(`Changed ${changedCount} files.`);
