export async function onRequestPost(context) {
  const db = context.env.DB;
  const body = await context.request.json();
  const url = new URL(context.request.url);
  const issueId = url.searchParams.get('issueId');

  try {
    const { noteId, text, date } = body;

    await db
      .prepare('INSERT INTO notes (id, issueId, text, date) VALUES (?, ?, ?, ?)')
      .bind(noteId, issueId, text, date)
      .run();

    return new Response(JSON.stringify({ id: noteId, text, date }), {
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
