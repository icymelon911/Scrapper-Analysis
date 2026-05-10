const fs = require('fs');
const html = fs.readFileSync('truthsocial_dump.html', 'utf-8');

// Find div classes
const matches = html.match(/class="[^"]+"/g) || [];
const classCounts = {};
for (const match of matches) {
  const cls = match.replace('class="', '').replace('"', '');
  classCounts[cls] = (classCounts[cls] || 0) + 1;
}

// Find frequent classes that might be posts
const sortedClasses = Object.entries(classCounts).sort((a,b) => b[1] - a[1]);
console.log('Top classes:', sortedClasses.slice(0, 30));

// Find timestamp formats
const timeMatches = html.match(/<time[^>]*>[^<]*<\/time>/g) || [];
console.log('Time matches:', timeMatches.slice(0, 5));

// Try to find the exact text of a known post to see its parent
const postIdx = html.indexOf('Congratulations to John Swinney');
if (postIdx !== -1) {
  const prefix = html.substring(Math.max(0, postIdx - 500), postIdx);
  console.log('\nPrefix before post:\n', prefix);
} else {
  console.log('Could not find post text. It might be in the timeline but not yet loaded or structure is different.');
}

// Any data-testid or aria-labels for engagement?
const replyMatches = html.match(/aria-label="[^"]*Reply[^"]*"/ig) || [];
console.log('Reply aria-labels:', replyMatches.slice(0, 5));
const likeMatches = html.match(/aria-label="[^"]*Like[^"]*"/ig) || [];
console.log('Like aria-labels:', likeMatches.slice(0, 5));

const dataTestids = html.match(/data-testid="[^"]+"/g) || [];
console.log('Data testids:', Array.from(new Set(dataTestids)).slice(0, 10));
