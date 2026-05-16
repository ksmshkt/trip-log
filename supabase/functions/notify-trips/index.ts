import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL               = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LINE_CHANNEL_ACCESS_TOKEN  = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// JST の今日の日付文字列 (YYYY-MM-DD) を返す
function jstDateString(daysOffset = 0): string {
  const now = new Date();
  now.setTime(now.getTime() + (9 * 60 + daysOffset * 24 * 60) * 60 * 1000);
  return now.toISOString().split('T')[0];
}

async function sendLineMessage(lineUserId: string, message: string): Promise<number> {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text: message }],
    }),
  });
  return res.status;
}

Deno.serve(async () => {
  const date3 = jstDateString(3); // 3日後
  const date1 = jstDateString(1); // 1日後

  // 対象の旅行を取得
  const { data: trips, error: tripsError } = await db
    .from('trips')
    .select('id, title, start_date, user_id')
    .in('start_date', [date3, date1]);

  if (tripsError) {
    console.error('trips fetch error:', tripsError);
    return new Response(JSON.stringify({ error: tripsError.message }), { status: 500 });
  }

  if (!trips || trips.length === 0) {
    return new Response(JSON.stringify({ message: 'No trips to notify', sent: 0 }));
  }

  // 対象ユーザーのプロフィール（LINE ID）を取得
  const userIds = [...new Set(trips.map((t) => t.user_id))];
  const { data: profiles, error: profilesError } = await db
    .from('profiles')
    .select('id, line_user_id')
    .in('id', userIds)
    .not('line_user_id', 'is', null);

  if (profilesError) {
    console.error('profiles fetch error:', profilesError);
    return new Response(JSON.stringify({ error: profilesError.message }), { status: 500 });
  }

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.line_user_id as string])
  );

  // 通知を送信
  const results: { trip: string; days: number; lineStatus: number }[] = [];

  for (const trip of trips) {
    const lineUserId = profileMap[trip.user_id];
    if (!lineUserId) continue;

    const days = trip.start_date === date3 ? 3 : 1;
    const message =
      days === 3
        ? `🧳 ${trip.title}まであと3日！準備リストを確認しましょう`
        : `✈️ ${trip.title}はいよいよ明日！忘れ物はありませんか？`;

    const lineStatus = await sendLineMessage(lineUserId, message);
    results.push({ trip: trip.title, days, lineStatus });
    console.log(`Notified: ${trip.title} (${days}日前) → LINE status ${lineStatus}`);
  }

  return new Response(
    JSON.stringify({ sent: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
