// Push status/follow-up changes back to GHL.
// POST body: { contactId, addTags?:[], removeTags?:[] }
const GHL_TOKEN = process.env.GHL_TOKEN;
const BASE      = 'https://services.leadconnectorhq.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const { contactId, addTags = [], removeTags = [] } = body;
  if (!contactId) return res.status(400).json({ error: 'contactId required' });

  const headers = {
    Authorization: `Bearer ${GHL_TOKEN}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  };

  const results = { added: [], removed: [], errors: [] };

  if (Array.isArray(addTags) && addTags.length) {
    try {
      const r = await fetch(`${BASE}/contacts/${contactId}/tags`, {
        method: 'POST', headers, body: JSON.stringify({ tags: addTags }),
      });
      if (!r.ok) results.errors.push(`add: ${r.status} ${(await r.text()).slice(0,120)}`);
      else results.added = addTags;
    } catch (e) { results.errors.push('add: '+e.message); }
  }

  if (Array.isArray(removeTags) && removeTags.length) {
    try {
      const r = await fetch(`${BASE}/contacts/${contactId}/tags`, {
        method: 'DELETE', headers, body: JSON.stringify({ tags: removeTags }),
      });
      if (!r.ok) results.errors.push(`remove: ${r.status} ${(await r.text()).slice(0,120)}`);
      else results.removed = removeTags;
    } catch (e) { results.errors.push('remove: '+e.message); }
  }

  res.status(results.errors.length ? 207 : 200).json(results);
}
