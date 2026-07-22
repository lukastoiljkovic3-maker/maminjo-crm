// Slack notifications for CRM events. POST { event, lead, meta } →
// posts a Block Kit message to the CJUREFX Slack via SLACK_WEBHOOK_URL.
// Events: new_lead · booked · closed · reopened · dq
// Fail-soft: never breaks the CRM flow — errors return 200 with ok:false.

const WEBHOOK = process.env.SLACK_WEBHOOK_URL;

const EVENTS = {
  new_lead: { emoji: '🆕', title: 'Novi lead' },
  booked:   { emoji: '📞', title: 'Zakazan poziv' },
  closed:   { emoji: '💰', title: 'CLOSED' },
  reopened: { emoji: '↩️', title: 'Lead ponovo otvoren' },
  dq:       { emoji: '❌', title: 'Diskvalifikovan' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!WEBHOOK) return res.status(200).json({ ok: false, error: 'SLACK_WEBHOOK_URL not set' });

  try {
    const { event, lead = {}, meta = {} } = req.body || {};
    const ev = EVENTS[event];
    if (!ev) return res.status(200).json({ ok: false, error: `unknown event: ${event}` });

    const fields = [];
    if (lead.email) fields.push(`*Email:* ${lead.email}`);
    if (lead.phone) fields.push(`*Telefon:* ${lead.phone}`);
    if (meta.deal_value) fields.push(`*Vrednost:* ${Number(meta.deal_value).toLocaleString('de-DE')} €`);
    if (meta.closer) fields.push(`*Closer:* ${meta.closer}`);
    if (meta.note) fields.push(meta.note);

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${ev.emoji} *${ev.title}*: *${lead.name || 'Nepoznat'}*${fields.length ? '\n' + fields.join(' · ') : ''}`,
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `CJUREFX CRM · ${new Date().toLocaleString('sr-RS', { timeZone: 'Europe/Belgrade' })}` }],
      },
    ];

    const r = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `${ev.emoji} ${ev.title}: ${lead.name || ''}`, blocks }),
    });
    return res.status(200).json({ ok: r.ok });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
