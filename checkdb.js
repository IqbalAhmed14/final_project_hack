const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Must match the file used in db.js
const dbFile = path.join(__dirname, "data.db");  
const db = new sqlite3.Database(dbFile);

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
  if (err) {
    console.error("Error fetching tables:", err);
    return;
  }
  console.log("Tables:", rows);

  rows.forEach(row => {
    db.all(`PRAGMA table_info(${row.name})`, [], (err, info) => {
      if (!err) {
        console.log(`\nSchema for ${row.name}:`);
        console.table(info);
      }
    });
  });
});
