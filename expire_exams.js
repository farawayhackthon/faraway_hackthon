const fs = require('fs');
const path = '.mock-store.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Expire all active exams by setting their examTime to 2 hours in the past
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

let changed = 0;
data.exams.forEach(exam => {
  const diffMin = Math.floor((new Date(exam.examTime).getTime() - Date.now()) / 60000);
  if (diffMin >= -30) {
    exam.examTime = twoHoursAgo;
    changed++;
  }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log(`Expired ${changed} active exams.`);
