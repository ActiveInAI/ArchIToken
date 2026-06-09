"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const BetterSqlite3 = require("better-sqlite3");
class BetterSqlite3Statement {
  constructor(stmt) {
    this.stmt = stmt;
  }
  get(...args) {
    return this.stmt.get(...args);
  }
  all(...args) {
    return this.stmt.all(...args);
  }
  run(...args) {
    return this.stmt.run(...args);
  }
}
class BetterSqlite3Driver {
  constructor(dbPath) {
    this.db = new BetterSqlite3(dbPath);
  }
  prepare(sql) {
    return new BetterSqlite3Statement(this.db.prepare(sql));
  }
  exec(sql) {
    this.db.exec(sql);
  }
  pragma(sql, options) {
    return this.db.pragma(sql, options);
  }
  transaction(fn) {
    return this.db.transaction(fn);
  }
  close() {
    this.db.close();
  }
}
exports.BetterSqlite3Driver = BetterSqlite3Driver;
