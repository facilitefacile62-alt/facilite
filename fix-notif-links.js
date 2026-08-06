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
  
  // Add links to the mock data
  content = content.replace(
    /time: "Il y a 15 minutes",\s*unread: true,?\s*\}/g,
    'time: "Il y a 15 minutes",\n      unread: true,\n      link: "/offres"\n    }'
  );
  
  content = content.replace(
    /time: "Il y a 1 heure",\s*unread: true,?\s*\}/g,
    'time: "Il y a 1 heure",\n      unread: true,\n      link: "/profil"\n    }'
  );

  // Update the onClick handler
  content = content.replace(
    /onClick=\{\(\) => \{\s*if \(notif\.unread\) \{\s*setNotificationsList\(prev => prev\.map\(n => n\.id === notif\.id \? \{ \.\.\.n, unread: false \} : n\)\);\s*setUnreadNotifCount\(prev => Math\.max\(0, prev - 1\)\);\s*\}\s*\}\}/g,
    `onClick={() => {
                      if (notif.unread) {
                        setNotificationsList(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
                        setUnreadNotifCount(prev => Math.max(0, prev - 1));
                      }
                      if (notif.link) {
                        window.location.href = notif.link;
                      }
                    }}`
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    changedCount++;
  }
});
console.log(`Changed ${changedCount} files.`);
