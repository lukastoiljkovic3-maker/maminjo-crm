// Fetch a single GHL contact by id — used by the tracker's deep-link
// (?lead=<contactId>) so a lead can open even before the full GHL→Supabase
// sync has pulled it in (e.g. a brand-new lead from a Slack notification).
const GHL_TOKEN = process.env.GHL_TOKEN;
const BASE      = 'https://services.leadconnectorhq.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const id = req.query && req.query.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    const r = await fetch(`${BASE}/contacts/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${GHL_TOKEN}`, Version: '2021-07-28' },
    });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: `GHL ${r.status}`, detail: text.slice(0, 200) });
    let j = null; try { j = JSON.parse(text); } catch { /* leave null */ }
    res.status(200).json({ contact: (j && (j.contact || j)) || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
