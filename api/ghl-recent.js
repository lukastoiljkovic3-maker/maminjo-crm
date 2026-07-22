// Lightweight endpoint: fetches only the latest 20 GHL contacts.
// Used by the frontend for speed-to-lead notification polling.
const GHL_TOKEN = process.env.GHL_TOKEN;
const GHL_LOC   = 'RKrapXXixFmKO2AnWe0B';
const BASE      = 'https://services.leadconnectorhq.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  try {
    const url = `${BASE}/contacts/?locationId=${GHL_LOC}&limit=20`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        Version: '2021-07-28',
      },
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `GHL ${r.status}: ${t.slice(0, 200)}` });
    }
    const json = await r.json();
    const contacts = (json.contacts || []).map(c => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Nepoznat',
      phone: c.phone || null,
      email: c.email || null,
      tags: c.tags || [],
      dateAdded: c.dateAdded || null,
    }));
    // Sort newest first by dateAdded just in case GHL doesn't.
    contacts.sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));
    res.status(200).json({ contacts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
