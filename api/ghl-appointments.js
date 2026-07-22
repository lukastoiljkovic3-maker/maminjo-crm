// Kalendar source — MAMINJO DIFFERENCE vs the CJURE original: bookings are
// native (maminjo.com/rezerviraj → Supabase public.bookings), NOT a GHL
// calendar. This endpoint reads bookings server-side and emits the exact
// GHL-events shape the SPA already consumes (appointmentStatus, startTime,
// endTime, title, contactId, calendarName), so the SPA needed zero changes.
//
// GET /api/ghl-appointments?start=<ms>&end=<ms>&contactId=<id>
// status map: booked→confirmed, completed→showed, no_show→noshow, cancelled→cancelled
const SUPABASE_URL = 'https://ydltgxzdcipvvcajjxbi.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STATUS_MAP = { booked: 'confirmed', completed: 'showed', no_show: 'noshow', cancelled: 'cancelled' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');

  if (!KEY) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing in Vercel env.' });
  }

  try {
    const now = Date.now();
    const start = new Date(Number(req.query.start) || now - 7 * 864e5).toISOString();
    const end = new Date(Number(req.query.end) || now + 30 * 864e5).toISOString();

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?select=*&starts_at=gte.${start}&starts_at=lte.${end}&order=starts_at.asc`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
    );
    if (!r.ok) return res.status(502).json({ error: `bookings query failed (${r.status})` });
    const rows = await r.json();

    let events = rows.map(b => ({
      id: b.id,
      title: `${b.ime}${b.prezime ? ' ' + b.prezime : ''} · ${b.telefon}`,
      // No GHL contactId for native bookings; the sync may later match by email.
      contactId: null,
      startTime: b.starts_at,
      endTime: new Date(new Date(b.starts_at).getTime() + (b.duration_min || 30) * 60000).toISOString(),
      appointmentStatus: STATUS_MAP[b.status] || 'confirmed',
      calendarName: 'Rezervacije (maminjo.com)',
      deleted: false,
      email: b.email,
      phone: b.telefon,
      note: b.note,
    }));

    if (req.query.contactId) events = events.filter(e => e.contactId === req.query.contactId);

    res.status(200).json({
      calendars: [{ id: 'bookings', name: 'Rezervacije (maminjo.com)' }],
      count: events.length,
      events,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
