// db/database.ts
import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("user_records.db");

export const setupDatabase = () => {
  db.withTransactionSync(() => {
    // 1. Main Records Table
    db.runSync(
      `CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        aadhaar_no TEXT,
        aadhaar_photo TEXT,
        present_address TEXT,
        location_proceeding TEXT,
        phone TEXT,
        geo_tag TEXT,
        start_date TEXT,
        end_date TEXT
      );`,
    );

    // 2. NEW: Relatives Table
    // 'record_id' links this relative to the main user
    db.runSync(
      `CREATE TABLE IF NOT EXISTS relatives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER, 
        name TEXT,
        aadhaar_no TEXT,
        aadhaar_photo TEXT,
        present_address TEXT,
        mobile_no TEXT,
        relationship TEXT,
        FOREIGN KEY(record_id) REFERENCES records(id) ON DELETE CASCADE
      );`,
    );
  });
};
