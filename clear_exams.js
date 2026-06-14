const fs = require('fs');
const path = '.mock-store.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Clear all exams
data.exams = [];

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('All exams removed successfully.');
