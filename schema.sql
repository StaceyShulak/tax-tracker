CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  account TEXT NOT NULL,
  taxYear TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  assignedTo TEXT,
  created TEXT,
  updated TEXT,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  issueId TEXT NOT NULL,
  text TEXT NOT NULL,
  date TEXT NOT NULL,
  FOREIGN KEY(issueId) REFERENCES issues(id)
);

CREATE INDEX IF NOT EXISTS idx_issues_updated ON issues(updated);
CREATE INDEX IF NOT EXISTS idx_issues_archived ON issues(archived);
CREATE INDEX IF NOT EXISTS idx_notes_issueId ON notes(issueId);
