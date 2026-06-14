const fs = require('fs');
const storePath = '.mock-store.json';
const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));

const userId = '9d967805-4a17-4ea5-8d78-539a95350a7b';
const role = 'center_head';

const exams = data.exams.filter(e => e.centerHeadId === userId);
console.log(`Exams for ${userId}:`, exams.length);
exams.forEach(e => console.log(e.title));
