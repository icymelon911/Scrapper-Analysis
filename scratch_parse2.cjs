const fs = require('fs');
const html = fs.readFileSync('truthsocial_dump.html', 'utf-8');

const blocks = html.split('data-testid="status-card-description"');
if (blocks.length > 1) {
  // block 0 is before the first match, block 1 is right after data-testid="status-card-description"
  const before = blocks[0].substring(blocks[0].length - 500);
  const after = blocks[1].substring(0, 1000);
  console.log('BEFORE:\n', before);
  console.log('\nAFTER:\n', after);
}
