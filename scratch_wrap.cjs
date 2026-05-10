const text = "Source: \"Happy Mother's Day weekend to all, especially to the 115 THOUSAND AMERICANS who found jobs in the month of April alone! As usual, over 90 percent of Bloomberg Economists (nearly all of whom have a 'Terminal' case of TRUMP DERANGEMENT SYNDROME!) underestimated the strength of the Trump Economy. Despite the best efforts of Jerome 'Too Late and Won't Leave' Powell, and the America Hating Democrat Party, more Americans are working today than ever before. Happy Mother’s Day and, know that, we are MAKING AMERICA WEALTHY AND SAFE AGAIN! President DONALD J. TRUMP\"";
const width = 66;
const sourceWords = text.split(' ');
let currentSourceLine = '  ';
for (const word of sourceWords) {
  const cleanWord = word.replace(/\n/g, ' ');
  if ((currentSourceLine + cleanWord).length > width - 2) {
    console.log('║' + currentSourceLine.padEnd(width) + '║');
    currentSourceLine = '  ';
  }
  currentSourceLine += cleanWord + ' ';
}
if (currentSourceLine.trim()) {
  console.log('║' + currentSourceLine.padEnd(width) + '║');
}
