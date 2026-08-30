const fs = require('fs');
const path = require('path');
const dir = 'docs';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('<script src="common.js"></script>') && !content.includes('store.js')) {
    content = content.replace('<script src="common.js"></script>', '<script src="store.js"></script>\n    <script src="apiService.js"></script>\n    <script src="common.js"></script>');
    fs.writeFileSync(filePath, content);
  }
}
console.log('HTML files updated successfully.');
