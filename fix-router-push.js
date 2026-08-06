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
  
  // Replace window.location.href with router.push
  content = content.replace(
    /if\s*\(\s*notif\.link\s*\)\s*\{\s*window\.location\.href\s*=\s*notif\.link;\s*\}/g,
    'if (notif.link) {\n                        router.push(notif.link);\n                        if (typeof setNotificationsModalOpen !== "undefined") setNotificationsModalOpen(false);\n                      }'
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    changedCount++;
  }
});
console.log(`Changed ${changedCount} files.`);
