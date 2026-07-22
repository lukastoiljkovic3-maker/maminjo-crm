// GHL → revenue/clients for the Metrics tab (replaces the old Google Sheet).
// Pulls opportunities and maps them to the row shape the SPA's renderRevenue()
// already expects: { name, challenge, email, date, closer, status }.
//   status: 'polozeno' = won (cash collected) · 'u toku' = open (pipeline)
// closer = the GHL user the opportunity is assigned to (Luka / Dimitrije).

const GHL_TOKEN = process.env.GHL_TOKEN;
const GHL_LOC   = 'RKrapXXixFmKO2AnWe0B';
const BASE      = 'https://services.leadconnectorhq.com';
const VERSION   = '2021-07-28';

async function fetchAllOpps() {
  const out = [];
  let url = `${BASE}/opportunities/search?location_id=${GHL_LOC}&limit=100`;
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${GHL_TOKEN}`, Version: VERSION },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GHL ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = await res.json();
    out.push(...(j.opportunities || []));
    url = j.meta?.nextPageUrl || null;
  }
  return out;
}

// Opportunities carry the assigned GHL *user id*, not a name. Resolve ids → names
// so the revenue table shows which closer (Luka / Dimitrije) owns the deal.
// Needs the "View Users" scope; without it we degrade to a blank closer column.
async function fetchUserMap() {
  try {
    const res = await fetch(`${BASE}/users/?locationId=${GHL_LOC}`, {
      headers: { Authorization: `Bearer ${GHL_TOKEN}`, Version: VERSION },
    });
    if (!res.ok) return {};
    const j = await res.json();
    const map = {};
    for (const u of (j.users || [])) {
      const name = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ');
      if (u.id && name) map[u.id] = name;
    }
    return map;
  } catch {
    return {};
  }
}

function contactName(o) {
  return (
    o.name ||
    o.contact?.name ||
    [o.contact?.firstName, o.contact?.lastName].filter(Boolean).join(' ') ||
    'Nepoznat'
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
  try {
    const [opps, userMap] = await Promise.all([fetchAllOpps(), fetchUserMap()]);

    const rows = opps
      .filter(o => o.status === 'won' || o.status === 'open')
      .map(o => ({
        name:      contactName(o),
        challenge: Number(o.monetaryValue || 0),
        email:     o.contact?.email || '',
        date:      o.lastStatusChangeAt || o.createdAt || o.dateAdded || null,
        closer:    (o.assignedTo && userMap[o.assignedTo]) || '',
        status:    o.status === 'won' ? 'polozeno' : 'u toku',
      }))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // debug: GET /api/ghl-metrics?raw=1 → inspect the opportunity object shape
    if (req.query && req.query.raw === '1') {
      return res.status(200).json({
        count: opps.length,
        statuses: [...new Set(opps.map(o => o.status))],
        keys: Object.keys(opps[0] || {}),
        sample: opps.slice(0, 2),
      });
    }

    // `data` is the real payload. `rows` is intentionally EMPTY: clients running
    // a stale cached build read `rows` and mass-close leads from it (the old
    // sheet-sync had no won-only filter) — starving them neutralizes that.
    res.status(200).json({ rows: [], data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
