const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '../db');

function readDB(name) {
  const fp = path.join(dbDir, `${name}.json`);
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function writeDB(name, data) {
  const fp = path.join(dbDir, `${name}.json`);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

function findOne(collection, predicate) {
  const data = readDB(collection);
  return data.find(predicate) || null;
}

function findAll(collection, predicate) {
  const data = readDB(collection);
  return predicate ? data.filter(predicate) : data;
}

function insert(collection, record) {
  const data = readDB(collection);
  data.push(record);
  writeDB(collection, data);
  return record;
}

function update(collection, predicate, updates) {
  const data = readDB(collection);
  const idx = data.findIndex(predicate);
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...updates };
  writeDB(collection, data);
  return data[idx];
}

function upsert(collection, predicate, record) {
  const data = readDB(collection);
  const idx = data.findIndex(predicate);
  if (idx === -1) {
    data.push(record);
  } else {
    data[idx] = { ...data[idx], ...record };
  }
  writeDB(collection, data);
  return idx === -1 ? record : data[idx];
}

module.exports = { readDB, writeDB, findOne, findAll, insert, update, upsert };
