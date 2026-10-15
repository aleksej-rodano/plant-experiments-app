// Daily keep-alive for the Supabase free tier, which pauses a project after a
// week without database activity. Vercel Cron (see vercel.json) calls this once
// a day; one tiny query is enough to count as activity. RLS means the anon key
// reads no rows — the query still reaches Postgres, which is all that matters.
//
// Uses the same VITE_SUPABASE_* env vars the web build already has on Vercel.
export async function GET(request) {
  // When CRON_SECRET is set in Vercel, only Vercel Cron's own calls get through.
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    return Response.json({ ok: false, error: 'Supabase env vars missing' }, { status: 500 })
  }

  const res = await fetch(`${url}/rest/v1/folders?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  return Response.json({ ok: res.ok, status: res.status }, { status: res.ok ? 200 : 502 })
}
