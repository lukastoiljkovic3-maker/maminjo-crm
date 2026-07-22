const GHL_TOKEN = process.env.GHL_TOKEN;
const GHL_LOC   = 'RKrapXXixFmKO2AnWe0B';
const BASE      = 'https://services.leadconnectorhq.com';

async function fetchAllContacts() {
  const contacts = [];
  let url = `${BASE}/contacts/?locationId=${GHL_LOC}&limit=100`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        Version: '2021-07-28',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GHL ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    contacts.push(...(json.contacts || []));
    url = json.meta?.nextPageUrl || null;
  }

  return contacts;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const all = await fetchAllContacts();

    // CjureFX webinar funnel buckets — the REAL tags the GHL workflows apply
    // (verified against the location 2026-07-05). Every registrant carries a
    // dated `webinar_*` tag; qualifier outcome = kvalifikovan / value tiers vs dq/low-value.
    const QUAL   = ['qualified', 'mid-priority', 'high priority', 'kvalifikovan'];
    const DQ     = ['disqualified', 'low-priority', 'dq'];
    const BOOKED = ['booked-call'];
    const CUST   = ['customer'];
    const hasTag = (c, tags) => (c.tags || []).some(t => tags.includes(t));
    const isOptin = (c) => (c.tags || []).some(t => String(t).startsWith('webinar_') || String(t).endsWith('_webinar_optin') || t.endsWith('_webinar_optin'));

    const customer     = all.filter(c => hasTag(c, CUST));
    const booked       = all.filter(c => hasTag(c, BOOKED) && !hasTag(c, CUST));
    const qualified    = all.filter(c => hasTag(c, QUAL) && !hasTag(c, [...BOOKED, ...CUST]));
    const disqualified = all.filter(c => hasTag(c, DQ) && !hasTag(c, [...QUAL, ...BOOKED, ...CUST]));
    // Optin = registered for the webinar but not yet qualified/disqualified/booked/closed.
    const optin        = all.filter(c =>
      isOptin(c) && !hasTag(c, [...QUAL, ...DQ, ...BOOKED, ...CUST]));

    res.status(200).json({ optin, qualified, disqualified, booked, customer });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
