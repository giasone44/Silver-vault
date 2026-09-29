import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";
import type { Item, ItemInput, Valuation } from "./schemas.js";

fs.mkdirSync(path.join(config.dataDir, "photos"), { recursive: true });

const db = new DatabaseSync(path.join(config.dataDir, "vault.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    obverse_photo TEXT,
    reverse_photo TEXT,
    valuation TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS valuations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    valuation TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS valuations_item ON valuations(item_id, created_at);
  CREATE TABLE IF NOT EXISTS spot_history (
    minute TEXT NOT NULL,
    metal TEXT NOT NULL,
    price REAL NOT NULL,
    PRIMARY KEY (minute, metal)
  );
`);

type Row = {
  id: string;
  data: string;
  obverse_photo: string | null;
  reverse_photo: string | null;
  valuation: string | null;
  created_at: string;
  updated_at: string;
};

function toItem(row: Row): Item {
  return {
    ...(JSON.parse(row.data) as ItemInput),
    id: row.id,
    obverse_photo: row.obverse_photo,
    reverse_photo: row.reverse_photo,
    valuation: row.valuation ? (JSON.parse(row.valuation) as Valuation) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listItems(): Item[] {
  const rows = db.prepare("SELECT * FROM items ORDER BY created_at DESC").all() as Row[];
  return rows.map(toItem);
}

export function getItem(id: string): Item | null {
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as Row | undefined;
  return row ? toItem(row) : null;
}

export function createItem(input: ItemInput): Item {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO items (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    id,
    JSON.stringify(input),
    now,
    now,
  );
  return getItem(id)!;
}

export function updateItem(id: string, input: ItemInput): Item | null {
  db.prepare("UPDATE items SET data = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify(input),
    new Date().toISOString(),
    id,
  );
  return getItem(id);
}

export function setPhotos(id: string, obverse: string | null, reverse: string | null) {
  db.prepare(
    "UPDATE items SET obverse_photo = COALESCE(?, obverse_photo), reverse_photo = COALESCE(?, reverse_photo) WHERE id = ?",
  ).run(obverse, reverse, id);
}

export function setValuation(id: string, valuation: Valuation) {
  const json = JSON.stringify(valuation);
  db.prepare("UPDATE items SET valuation = ? WHERE id = ?").run(json, id);
  db.prepare("INSERT INTO valuations (item_id, valuation, created_at) VALUES (?, ?, ?)").run(
    id,
    json,
    valuation.valued_at,
  );
}

export function valuationHistory(id: string): Valuation[] {
  const rows = db
    .prepare("SELECT valuation FROM valuations WHERE item_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(id) as { valuation: string }[];
  return rows.map((r) => JSON.parse(r.valuation) as Valuation);
}

export function deleteItem(id: string): Item | null {
  const item = getItem(id);
  db.prepare("DELETE FROM items WHERE id = ?").run(id);
  db.prepare("DELETE FROM valuations WHERE item_id = ?").run(id);
  return item;
}

export function recordSpot(prices: Record<string, number | null>, at: Date) {
  const minute = at.toISOString().slice(0, 16);
  const stmt = db.prepare("INSERT OR REPLACE INTO spot_history (minute, metal, price) VALUES (?, ?, ?)");
  for (const [metal, price] of Object.entries(prices)) {
    if (price != null) stmt.run(minute, metal, price);
  }
}

export function spotHistory(metal: string, sinceIso: string) {
  return db
    .prepare("SELECT minute, price FROM spot_history WHERE metal = ? AND minute >= ? ORDER BY minute")
    .all(metal, sinceIso.slice(0, 16)) as { minute: string; price: number }[];
}
