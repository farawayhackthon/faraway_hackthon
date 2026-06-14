const fs = require('fs');
const storePath = '.mock-store.json';
const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));

console.log("Users:");
const chs = data.users.filter(u => u.role === 'center_head');
console.log("Center Heads:", chs.map(u => u.id + ' (' + u.username + ')').join(', '));
const invs = data.users.filter(u => u.role === 'invigilator');
console.log("Invigilators:", invs.map(u => u.id + ' (' + u.username + ')').join(', '));

console.log("\nExams:");
const exams = data.exams;
exams.forEach(e => {
  console.log(`Exam: ${e.title}`);
  console.log(`  centerHeadId: ${e.centerHeadId}`);
  console.log(`  invigilatorId: ${e.invigilatorId}`);
});
