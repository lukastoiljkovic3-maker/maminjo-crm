// Daily EOD summary → Slack. Triggered by Vercel cron (see vercel.json,
// 21:00 Europe/Belgrade = 19:00 UTC in summer). Pulls today's numbers
// straight from GHL: new leads by funnel tag + won opportunities.
// Requires GHL_TOKEN + SLACK_WEBHOOK_URL env vars.

const GHL_TOKEN = process.env.GHL_TOKEN;
const WEBHOOK   = process.env.SLACK_WEBHOOK_URL;
const GHL_LOC   = 'RKrapXXixFmKO2AnWe0B';
const BASE      = 'https://services.leadconnectorhq.com';
const VERSION   = '2021-07-28';

function belgradeDayRange() {
  const now = new Date();
  const belgrade = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Belgrade' }));
  const offsetMs = belgrade.getTime() - now.getTime();
  const startLocal = new Date(belgrade); startLocal.setHours(0, 0, 0, 0);
  return { start: new Date(startLocal.getTime() - offsetMs), end: now };
}

async function ghl(path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${GHL_TOKEN}`, Version: VERSION } });
  if (!res.ok) throw new Error(`GHL ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function countContactsByTag(tag, sinceIso) {
  // contacts/search with tag filter + dateAdded range
  const res = await fetch(`${BASE}/contacts/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GHL_TOKEN}`, Version: VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locationId: GHL_LOC,
      pageLimit: 1,
      filters: [
        { field: 'tags', operator: 'contains', value: tag },
        { field: 'dateAdded', operator: 'range', value: { gte: sinceIso } },
      ],
    }),
  });
  if (!res.ok) return 0;
  const j = await res.json();
  return j.total ?? (j.contacts || []).length;
}

export default async function handler(req, res) {
  if (!WEBHOOK) return res.status(200).json({ ok: false, error: 'SLACK_WEBHOOK_URL not set' });
  if (!GHL_TOKEN) return res.status(200).json({ ok: false, error: 'GHL_TOKEN not set' });

  try {
    const { start } = belgradeDayRange();
    const sinceIso = start.toISOString();

    const [optins, qualified, booked, oppsJson] = await Promise.all([
      countContactsByTag('24_07_2026_webinar_optin', sinceIso),
      countContactsByTag('qualified', sinceIso),
      countContactsByTag('booked-call', sinceIso),
      ghl('/opportunities/search', { location_id: GHL_LOC, limit: 100 }),
    ]);

    const opps = oppsJson.opportunities || [];
    const wonToday = opps.filter(
      (o) => o.status === 'won' && new Date(o.lastStatusChangeAt || o.createdAt) >= start,
    );
    const cash = wonToday.reduce((s, o) => s + Number(o.monetaryValue || 0), 0);
    const openPipeline = opps.filter((o) => o.status === 'open');
    const pipelineValue = openPipeline.reduce((s, o) => s + Number(o.monetaryValue || 0), 0);

    const dateStr = new Date().toLocaleDateString('sr-RS', {
      timeZone: 'Europe/Belgrade', day: 'numeric', month: 'long',
    });

    const lines = [
      `*Optini:* ${optins}`,
      `*Kvalifikovani:* ${qualified}`,
      `*Zakazani pozivi:* ${booked}`,
      `*Zatvoreno danas:* ${wonToday.length}${cash ? ` · ${cash.toLocaleString('de-DE')} €` : ''}`,
      `*Pipeline:* ${openPipeline.length} otvorenih · ${pipelineValue.toLocaleString('de-DE')} €`,
    ];

    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: `📊 CJUREFX EOD · ${dateStr}` } },
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
      ...(wonToday.length
        ? [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Današnji closevi:*\n' + wonToday
                .map((o) => `• ${o.name || o.contact?.name || 'Nepoznat'}: ${Number(o.monetaryValue || 0).toLocaleString('de-DE')} €`)
                .join('\n'),
            },
          }]
        : []),
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'CJUREFX CRM · automatski EOD izveštaj' }] },
    ];

    const r = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `CJUREFX EOD · ${dateStr}`, blocks }),
    });
    return res.status(200).json({ ok: r.ok, optins, qualified, booked, closed: wonToday.length, cash });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
