export async function onRequestGet(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const showArchived = url.searchParams.get('archived') === 'true';

  try {
    const query = showArchived 
      ? 'SELECT * FROM issues WHERE archived = 1 ORDER BY updated DESC'
      : 'SELECT * FROM issues WHERE archived = 0 ORDER BY updated DESC';
    
    const issues = await db.prepare(query).all();

    const issuesWithNotes = await Promise.all(
      issues.results.map(async (issue) => {
        const notesResult = await db
          .prepare('SELECT * FROM notes WHERE issueId = ? ORDER BY date DESC')
          .bind(issue.id)
          .all();

        return {
          ...issue,
          notes: notesResult.results || []
        };
      })
    );

    return new Response(JSON.stringify(issuesWithNotes), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const body = await context.request.json();

  try {
    const { id, title, account, taxYear, status, description, assignedTo, created, updated } = body;

    await db
      .prepare(
        'INSERT INTO issues (id, title, account, taxYear, status, description, assignedTo, created, updated, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'
      )
      .bind(id, title, account, taxYear, status, description, assignedTo, created, updated)
      .run();

    return new Response(JSON.stringify({ id, title, account, taxYear, status, description, assignedTo, created, updated, archived: 0, notes: [] }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPut(context) {
  const db = context.env.DB;
  const body = await context.request.json();
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id');

  try {
    const { title, status, description, updated } = body;

    await db
      .prepare('UPDATE issues SET title = ?, status = ?, description = ?, updated = ? WHERE id = ?')
      .bind(title, status, description, updated, id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPatch(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id');
  const body = await context.request.json();

  try {
    const { archived } = body;

    await db
      .prepare('UPDATE issues SET archived = ? WHERE id = ?')
      .bind(archived ? 1 : 0, id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id');

  try {
    await db
      .prepare('DELETE FROM notes WHERE issueId = ?')
      .bind(id)
      .run();

    await db
      .prepare('DELETE FROM issues WHERE id = ?')
      .bind(id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
