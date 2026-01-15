import * as SQLite from 'expo-sqlite';

// Open or Create the database file
export const db = SQLite.openDatabaseSync('user_records.db');

export const setupDatabase = () => {
  db.withTransactionSync(() => {
    db.runSync(
      `CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        name TEXT,
        phone TEXT,
        start_date TEXT,
        end_date TEXT
      );`
    );
  });
};