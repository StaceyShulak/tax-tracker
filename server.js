import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bodyParser from 'body-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

let db;

function initializeDatabase() {
  db = new sqlite3.Database('./tracker.db', (err) => {
    if (err) console.error('Database open error:', err);
    else console.log('Database connected');
  });

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        account TEXT NOT NULL,
        taxYear TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT,
        assignedTo TEXT,
        created TEXT,
        updated TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        issueId TEXT NOT NULL,
        text TEXT NOT NULL,
        date TEXT NOT NULL,
        FOREIGN KEY(issueId) REFERENCES issues(id)
      )
    `);
  });
}

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.get('/api/issues', (req, res) => {
  db.all('SELECT * FROM issues ORDER BY updated DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const issuesWithNotes = rows.map(issue => {
      return new Promise((resolve) => {
        db.all(
          'SELECT * FROM notes WHERE issueId = ? ORDER BY date DESC',
          [issue.id],
          (err, notes) => {
            resolve({ ...issue, notes: notes || [] });
          }
        );
      });
    });

    Promise.all(issuesWithNotes).then(results => {
      res.json(results);
    });
  });
});

app.post('/api/issues', (req, res) => {
  const { id, title, account, taxYear, status, description, assignedTo, created, updated } = req.body;

  db.run(
    'INSERT INTO issues (id, title, account, taxYear, status, description, assignedTo, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, title, account, taxYear, status, description, assignedTo, created, updated],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, title, account, taxYear, status, description, assignedTo, created, updated, notes: [] });
    }
  );
});

app.put('/api/issues/:id', (req, res) => {
  const { id } = req.params;
  const { title, status, description, updated } = req.body;

  db.run(
    'UPDATE issues SET title = ?, status = ?, description = ?, updated = ? WHERE id = ?',
    [title, status, description, updated, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/issues/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM notes WHERE issueId = ?', [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.run('DELETE FROM issues WHERE id = ?', [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    });
  });
});

app.post('/api/issues/:id/notes', (req, res) => {
  const { id } = req.params;
  const { noteId, text, date } = req.body;

  db.run(
    'INSERT INTO notes (id, issueId, text, date) VALUES (?, ?, ?, ?)',
    [noteId, id, text, date],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: noteId, text, date });
    }
  );
});

initializeDatabase();

app.listen(PORT, () => {
  console.log(`Tax Tracker server running on port ${PORT}`);
});
