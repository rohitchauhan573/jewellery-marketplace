const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbFolder = path.join(__dirname, '..', '..', 'database');
const db = new DatabaseSync(path.join(dbFolder, 'jewellery.db'));

db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(dbFolder, 'schema.sql'), 'utf8'));
db.exec(fs.readFileSync(path.join(dbFolder, 'seed.sql'), 'utf8'));

module.exports = db;