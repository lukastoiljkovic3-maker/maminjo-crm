// Permanently delete a GHL contact — called by the tracker's "Obriši lead"
// action so a deleted lead won't be re-added by the next GHL→Supabase sync.
// POST { contactId }. Requires GHL_TOKEN with contacts write scope.
const GHL_TOKEN = process.env.GHL_TOKEN;
const BASE      = 'https://services.leadconnectorhq.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const { contactId } = body;
  if (!contactId) return res.status(400).json({ error: 'contactId required' });

  try {
    const r = await fetch(`${BASE}/contacts/${encodeURIComponent(contactId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${GHL_TOKEN}`, Version: '2021-07-28' },
    });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: `GHL ${r.status}`, detail: text.slice(0, 200) });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
