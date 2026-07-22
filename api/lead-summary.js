// AI summary for a single lead using Anthropic's Claude API.
// Reads ANTHROPIC_API_KEY from Vercel env vars.
// POST body: { lead: { name, experience, knowledge, time_frame, pain_point, qualification, notes, tags, status, ... } }

const MODEL = 'claude-haiku-4-5';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY missing. Add it in Vercel → Settings → Environment Variables.'
    });
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const lead = body.lead || {};
  const fields = [];
  if (lead.name)          fields.push(`Ime: ${lead.name}`);
  if (lead.status)        fields.push(`Status: ${lead.status}`);
  if (lead.experience)    fields.push(`Iskustvo: ${lead.experience}`);
  if (lead.knowledge)     fields.push(`Nivo znanja: ${lead.knowledge}`);
  if (lead.time_frame)    fields.push(`Vremenski okvir: ${lead.time_frame}`);
  if (lead.pain_point)    fields.push(`Pain point: ${lead.pain_point}`);
  if (lead.qualification) fields.push(`Kvalifikacija (slobodan tekst): ${lead.qualification}`);
  if (lead.notes)         fields.push(`Beleške rep-a: ${lead.notes}`);
  if (Array.isArray(lead.tags) && lead.tags.length) fields.push(`Tagovi: ${lead.tags.join(', ')}`);
  if (lead.assigned_to)   fields.push(`Dodeljen: ${lead.assigned_to}`);
  if (lead.follow_up_date)fields.push(`Sledeći follow-up: ${lead.follow_up_date}`);

  if (fields.length < 2) {
    return res.status(200).json({ summary: 'Nedovoljno podataka za AI sažetak. Popuni kvalifikaciju ili beleške i pokušaj ponovo.' });
  }

  const systemPrompt = `Ti si pomoćnik prodajnom timu CjureFX — AI-trading program (CjureFX, Srbija). Leadovi dolaze preko besplatnog webinara "AI Bot Koji Trguje Umesto Tebe" (5. jul 2026, 19:00). Ton: chill, nikad ne jurimo nikoga, mi kvalifikujemo lidove — ne prodajemo. Nismo "setteri" ili "closeri", mi smo profesionalci. Tim zatvara klijente na AI-trading program/mentorstvo (AI bot + signali).

Tvoj zadatak: na osnovu sirovih podataka o leadu, napiši kratak brief koji odgovara na pitanje "Da li je ovaj lead UOPŠTE za nas, i ako jeste, kako da ga kvalifikujemo?"

Format izlaza (3 rečenice, bez bullet pointa, ISKLJUČIVO srpski latinica):

1. rečenica: KO JE lead — koja je njegova trenutna situacija i šta ga je dovelo do nas. Ne marketing fraze.
2. rečenica: DA LI JE FIT — vruć / topao / hladan / nije za nas. Konkretni razlozi: ima li budžet, hitnost (kada želi da krene), iskustvo, motivaciju. Ako nešto bitno fali — reci direktno.
3. rečenica: KONKRETAN SLEDEĆI KORAK — šta da rep pita ili uradi da kvalifikuje dalje (NE "zovi i ponudi 25K paket" — već "pitaj kada konkretno hoće da krene" ili "proveri budžet pre nego što ulazi u detalje"). Ne predlažeš closing taktike, predlažeš kvalifikacione korake.

ZABRANJENO:
- Nazivati paket-specifične preporuke u 3. rečenici ("ponudi 50K paket") — to je rep-ov posao.
- Marketing fraze ("idealan kandidat", "ozbiljan potencijal").
- Velika obećanja.
- Emoji-i.

Ako su podaci slabi → "Premalo podataka. Pozovi i kvalifikuj — pitaj o vremenu, budžetu i razlogu zašto sad."`;

  const userPrompt = `Podaci o leadu:\n\n${fields.join('\n')}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 350,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `Claude API ${r.status}: ${t.slice(0, 240)}` });
    }
    const json = await r.json();
    const summary = (json.content || []).map(c => c.text || '').join('').trim();
    if (!summary) return res.status(500).json({ error: 'Empty AI response' });
    res.status(200).json({ summary, model: json.model });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
