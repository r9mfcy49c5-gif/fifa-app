import { NextResponse } from 'next/server';
export async function POST(req: Request) {
  const body = await req.json();
  const { phones = [], message = '' } = body;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return NextResponse.json({ ok:false, skipped:true, reason:'Twilio env vars not configured' });
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const sent:any[] = [];
  for (const to of phones) {
    const params = new URLSearchParams({ To: to, From: from, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method:'POST', headers:{ Authorization:`Basic ${auth}`, 'Content-Type':'application/x-www-form-urlencoded' }, body: params });
    sent.push({ to, status: res.status });
  }
  return NextResponse.json({ ok:true, sent });
}
