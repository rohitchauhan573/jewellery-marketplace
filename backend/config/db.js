const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbFolder = path.join(__dirname, '..', '..', 'database');
const dbFile = path.join(dbFolder, 'jewellery.db');
const db = new DatabaseSync(dbFile);

db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(dbFolder, 'schema.sql'), 'utf8'));
db.exec(fs.readFileSync(path.join(dbFolder, 'seed.sql'), 'utf8'));

const count = db.prepare('SELECT COUNT(*) AS total FROM categories').get();
console.log(`Database ready: ${dbFile}`);
console.log(`Categories loaded: ${count.total}`);

module.exports = db;