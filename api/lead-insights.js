// AI-driven win/loss pattern analysis.
// POST body: { closed: [...lead summaries], dq: [...lead summaries] }
//   → { insights: "..." }
const MODEL = 'claude-haiku-4-5';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const closed = (body.closed || []).slice(0, 80);  // cap to control tokens
  const dq     = (body.dq     || []).slice(0, 80);

  if (closed.length === 0 && dq.length === 0) {
    return res.status(200).json({ insights: 'Premalo zatvorenih ili DQ leadova za analizu.' });
  }

  const fmtLead = l => {
    const bits = [];
    if (l.experience)    bits.push(`isk:${l.experience}`);
    if (l.knowledge)     bits.push(`znanje:${l.knowledge}`);
    if (l.time_frame)    bits.push(`vreme:${l.time_frame}`);
    if (l.pain_point)    bits.push(`pain:${l.pain_point}`);
    if (l.qualification) bits.push(`kval:${l.qualification.slice(0,80)}`);
    if (l.lead_type)     bits.push(`tip:${l.lead_type}`);
    if (Array.isArray(l.tags) && l.tags.length) bits.push(`tagovi:${l.tags.join('|')}`);
    return '- ' + bits.join(' | ');
  };

  const system = `Ti si data analitičar za prodajni tim CjureFX (AI-trading program — leadovi dolaze preko besplatnog webinara). Daju ti listu CLOSED (zatvoreno = uspeh) i DQ (diskvalifikovano = gubitak) leadova. Tvoj zadatak: pronađi obrasce i napiši kratak izveštaj za vlasnika.

Format izlaza — ISKLJUČIVO srpski (latinica):

**ŠTA RADI:**
- 2-3 bulleta sa konkretnim obrascima (npr. "Leadovi koji u 'time_frame' imaju 'odmah' zatvaraju 3x češće").
- Svaki bullet treba da bude akcionabilan.

**ŠTA NE RADI:**
- 2-3 bulleta o uzrocima DQ (npr. "60% DQ-ova ima 'samo gledam' u kvalifikaciji").

**ŠTA URADITI:**
- 2 konkretne preporuke za tim (npr. "Pitajte 'kada bi krenuli' u prvoj poruci — eliminiše tire-kickere.").

Bez emoji-ja. Bez generalnih marketing fraza. Konkretne, merljive opservacije iz date dataset-e. Ako su podaci slabi reci to direktno.`;

  const userPrompt = `Closed leadovi (${closed.length}):
${closed.map(fmtLead).join('\n')}

DQ leadovi (${dq.length}):
${dq.map(fmtLead).join('\n')}

Analiziraj.`;

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
        max_tokens: 800,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `Claude API ${r.status}: ${t.slice(0, 240)}` });
    }
    const json = await r.json();
    const insights = (json.content || []).map(c => c.text || '').join('').trim();
    res.status(200).json({ insights });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
