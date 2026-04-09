import Database from 'better-sqlite3'
import path from 'node:path'

const SINGAPORE_HOLIDAYS: Record<number, Array<{ date: string; name: string }>> = {
  2024: [
    { date: '2024-01-01', name: "New Year's Day" },
    { date: '2024-02-10', name: 'Chinese New Year' },
    { date: '2024-02-11', name: 'Chinese New Year (Day 2)' },
    { date: '2024-02-12', name: 'Chinese New Year (observed)' },
    { date: '2024-03-29', name: 'Good Friday' },
    { date: '2024-04-10', name: 'Hari Raya Puasa' },
    { date: '2024-05-01', name: 'Labour Day' },
    { date: '2024-05-22', name: 'Vesak Day' },
    { date: '2024-06-17', name: 'Hari Raya Haji' },
    { date: '2024-08-09', name: 'National Day' },
    { date: '2024-10-31', name: 'Deepavali' },
    { date: '2024-12-25', name: 'Christmas Day' },
  ],
  2025: [
    { date: '2025-01-01', name: "New Year's Day" },
    { date: '2025-01-29', name: 'Chinese New Year' },
    { date: '2025-01-30', name: 'Chinese New Year (Day 2)' },
    { date: '2025-03-30', name: 'Hari Raya Puasa' },
    { date: '2025-03-31', name: 'Hari Raya Puasa (observed)' },
    { date: '2025-04-18', name: 'Good Friday' },
    { date: '2025-05-01', name: 'Labour Day' },
    { date: '2025-05-12', name: 'Vesak Day' },
    { date: '2025-06-06', name: 'Hari Raya Haji' },
    { date: '2025-08-09', name: 'National Day' },
    { date: '2025-10-20', name: 'Deepavali' },
    { date: '2025-12-25', name: 'Christmas Day' },
  ],
  2026: [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-02-17', name: 'Chinese New Year' },
    { date: '2026-02-18', name: 'Chinese New Year (Day 2)' },
    { date: '2026-03-20', name: 'Hari Raya Puasa' },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-05-01', name: 'Labour Day' },
    { date: '2026-05-31', name: 'Vesak Day' },
    { date: '2026-05-27', name: 'Hari Raya Haji' },
    { date: '2026-08-09', name: 'National Day' },
    { date: '2026-08-10', name: 'National Day (observed)' },
    { date: '2026-11-08', name: 'Deepavali' },
    { date: '2026-11-09', name: 'Deepavali (observed)' },
    { date: '2026-12-25', name: 'Christmas Day' },
  ],
}

const dbPath = path.join(process.cwd(), 'todos.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    country_code TEXT NOT NULL DEFAULT 'SG',
    UNIQUE(date, name)
  )
`)

const upsert = db.prepare(
  'INSERT OR REPLACE INTO holidays (date, name, country_code) VALUES (?, ?, ?)'
)

const insertMany = db.transaction((holidays: Array<{ date: string; name: string }>) => {
  for (const h of holidays) {
    upsert.run(h.date, h.name, 'SG')
  }
})

let total = 0
for (const [year, holidays] of Object.entries(SINGAPORE_HOLIDAYS)) {
  insertMany(holidays)
  total += holidays.length
  console.log(`Seeded ${holidays.length} holidays for ${year}`)
}

console.log(`Done. ${total} total holidays seeded.`)
db.close()
