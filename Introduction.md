# Manual one-shot analysis
node src/cli.js analyze -t "Post text here" -d "iPhone" --time "2026-05-08T01:22:00-04:00"

# Run demo with all sample posts
node src/cli.js demo

# Run demo with specific sample (1-5)
node src/cli.js demo --sample 3

# Start auto-scrape monitor
node src/cli.js monitor --target @username --interval 5

# View analysis history
node src/cli.js history --last 10

# View specific report
node src/cli.js history --id VP-20260508-001
