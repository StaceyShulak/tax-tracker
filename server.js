import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bodyParser from 'body-parser';
import { google } from 'googleapis';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

const SPREADSHEET_ID = '143QTYvI3S4LujrNdoDhj_5DcblP-KVu-XieMg6Jjstc';
const ISSUES_SHEET = 'Issues';
const NOTES_SHEET = 'Notes';

let sheetsClient;
let authClient;

async function initializeSheets() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    
    authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheetsClient = google.sheets({
      version: 'v4',
      auth: authClient
    });

    console.log('Google Sheets connected');
    
    await ensureSheets();
  } catch (err) {
    console.error('Sheets initialization error:', err);
    process.exit(1);
  }
}

async function ensureSheets() {
  try {
    const sheets = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });

    const sheetNames = sheets.data.sheets.map(s => s.properties.title);

    if (!sheetNames.includes(ISSUES_SHEET)) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: ISSUES_SHEET }
            }
          }]
        }
      });

      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${ISSUES_SHEET}!A1:I1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'title', 'account', 'taxYear', 'status', 'description', 'assignedTo', 'created', 'updated']]
        }
      });
    }

    if (!sheetNames.includes(NOTES_SHEET)) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: NOTES_SHEET }
            }
          }]
        }
      });

      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${NOTES_SHEET}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'issueId', 'text', 'date']]
        }
      });
    }
  } catch (err) {
    console.error('Error ensuring sheets exist:', err);
  }
}

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.get('/api/issues', async (req, res) => {
  try {
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ISSUES_SHEET}!A2:I`
    });

    const rows = response.data.values || [];
    const issues = rows.map(row => ({
      id: row[0],
      title: row[1],
      account: row[2],
      taxYear: row[3],
      status: row[4],
      description: row[5],
      assignedTo: row[6],
      created: row[7],
      updated: row[8],
      notes: []
    }));

    const notesResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTES_SHEET}!A2:D`
    });

    const notes = notesResponse.data.values || [];
    notes.forEach(noteRow => {
      const issue = issues.find(i => i.id === noteRow[1]);
      if (issue) {
        issue.notes.push({
          id: noteRow[0],
          text: noteRow[2],
          date: noteRow[3]
        });
      }
    });

    res.json(issues.sort((a, b) => new Date(b.updated) - new Date(a.updated)));
  } catch (err) {
    console.error('Error fetching issues:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/issues', async (req, res) => {
  try {
    const { id, title, account, taxYear, status, description, assignedTo, created, updated } = req.body;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ISSUES_SHEET}!A:I`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[id, title, account, taxYear, status, description, assignedTo, created, updated]]
      }
    });

    res.json({ id, title, account, taxYear, status, description, assignedTo, created, updated, notes: [] });
  } catch (err) {
    console.error('Error creating issue:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/issues/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status, description, updated } = req.body;

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ISSUES_SHEET}!A:A`
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === id);

    if (rowIndex === -1) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ISSUES_SHEET}!A${rowIndex + 1}:I${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[id, title, '', '', status, description, '', '', updated]]
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating issue:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/issues/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const issuesResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ISSUES_SHEET}!A:A`
    });

    const issueRows = issuesResponse.data.values || [];
    const issueRowIndex = issueRows.findIndex(row => row[0] === id);

    if (issueRowIndex !== -1) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            deleteRange: {
              range: {
                sheetId: 0,
                startRowIndex: issueRowIndex,
                endRowIndex: issueRowIndex + 1
              },
              shiftDimension: 'ROWS'
            }
          }]
        }
      });
    }

    const notesResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTES_SHEET}!A:B`
    });

    const noteRows = notesResponse.data.values || [];
    const notesForIssue = noteRows
      .map((row, idx) => ({ row, idx }))
      .filter(item => item.row[1] === id);

    for (const item of notesForIssue.reverse()) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            deleteRange: {
              range: {
                sheetId: 1,
                startRowIndex: item.idx,
                endRowIndex: item.idx + 1
              },
              shiftDimension: 'ROWS'
            }
          }]
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting issue:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/issues/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { noteId, text, date } = req.body;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTES_SHEET}!A:D`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[noteId, id, text, date]]
      }
    });

    res.json({ id: noteId, text, date });
  } catch (err) {
    console.error('Error adding note:', err);
    res.status(500).json({ error: err.message });
  }
});

await initializeSheets();

app.listen(PORT, () => {
  console.log(`Tax Tracker server running on port ${PORT}`);
});
