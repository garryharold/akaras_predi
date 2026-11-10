import {createHash, timingSafeEqual} from 'node:crypto';

const reply = (data, status = 200) => Response.json(data, {
  status, headers: {'Cache-Control': 'no-store'}
});

function authorized(request, secret) {
  if (!secret || secret.length < 32) return false;
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(request.headers.get('authorization') || ''), hash('Bearer ' + secret));
}

function discordLabel(value) {
  return String(value).replace(/[\r\n]+/g, ' ').replace(/[\\*_~`|<>@\[\]]/g, '\\$&').slice(0, 100);
}

export async function handleDiscordReminders(request, env, {send = fetch, now = Date.now} = {}) {
  if (request.method !== 'POST') return reply({error: 'POST szükséges.'}, 405);
  if (!authorized(request, env.DISCORD_REMINDER_KEY)) return reply({error: 'Hozzáférés megtagadva.'}, 401);
  return sendDiscordMatchNotices(env, new URL(request.url), {
    send, now, dryRun: new URL(request.url).searchParams.get('dry_run') === '1'
  });
}

export async function sendDiscordMatchNotices(env, url, {
  send = fetch, now = Date.now, dryRun = false, announcementOnly = false, matchId = null
} = {}) {
  const webhook = env.DISCORD_WEBHOOK_URL?.trim();
  if (!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(webhook || '')) {
    return reply({error: 'A Discord-webhook beállítása hiányzik vagy hibás.'}, 503);
  }
  const time = now();
  const from = new Date(time).toISOString();
  const oneHourAhead = new Date(time + 60 * 60_000).toISOString();
  const matches = await env.DB.prepare(`
    SELECT m.id,m.start_at,m.prediction_lock_at,a.name AS home,b.name AS away,
      s.league_id,s.id AS season_id,p.id AS phase_id,notice.lead_minutes
    FROM matches m
    JOIN teams a ON a.id=m.team_a_id JOIN teams b ON b.id=m.team_b_id
    JOIN phases p ON p.id=m.phase_id JOIN seasons s ON s.id=p.season_id
    CROSS JOIN (VALUES (0),(60)) AS notice(lead_minutes)
    WHERE m.status='scheduled' AND m.start_at>?
      AND (?::text IS NULL OR m.id=?)
      AND (
        (notice.lead_minutes=0 AND m.created_at >=
          (SELECT checksum FROM app_migrations WHERE name='discord-announcement-start'))
        OR (notice.lead_minutes=60 AND NOT ?::boolean AND m.start_at<=?
          AND m.created_at::timestamptz <= m.start_at::timestamptz - interval '1 hour')
      )
      AND NOT EXISTS (SELECT 1 FROM discord_match_reminders r
        WHERE r.match_id=m.id AND r.lead_minutes=notice.lead_minutes)
    ORDER BY m.start_at,m.id,notice.lead_minutes LIMIT 5
  `).bind(from,matchId,matchId,announcementOnly,oneHourAhead).all();
  if (dryRun) {
    return reply({ok: true, dry_run: true, eligible: matches.results.length,
      announcements: matches.results.filter(match => match.lead_minutes === 0).length,
      reminders: matches.results.filter(match => match.lead_minutes === 60).length});
  }
  let sent = 0;
  for (const match of matches.results) {
    const current = new Date(now()).toISOString();
    const claimed = await env.DB.prepare(`
      INSERT INTO discord_match_reminders (match_id,lead_minutes)
      SELECT id,? FROM matches WHERE id=? AND status='scheduled'
        AND start_at>? AND start_at=? AND prediction_lock_at=?
      ON CONFLICT (match_id,lead_minutes) DO NOTHING RETURNING match_id
    `).bind(match.lead_minutes,match.id,current,match.start_at,match.prediction_lock_at).first();
    if (!claimed) continue;

    const deadline = Math.floor(Date.parse(match.prediction_lock_at) / 1000);
    const start = Math.floor(Date.parse(match.start_at) / 1000);
    const link = new URL('/',url.origin);
    link.hash = ['league',match.league_id,match.season_id,match.phase_id].map(encodeURIComponent).join('/');
    const content = [
      match.lead_minutes === 0 ? '📣 **Új meccs az Akarásban**' : '🎯 **Tippemlékeztető · kezdés egy órán belül**',
      '**' + discordLabel(match.home) + ' – ' + discordLabel(match.away) + '**',
      'Tippelés lezárása <t:' + deadline + ':t> (<t:' + deadline + ':R>)',
      'Meccskezdés <t:' + start + ':f>',
      (match.prediction_lock_at > current ? 'Ha még nincs tipped, add le az Akarásban: <' : 'Meccs az Akarásban: <') + link.href + '>'
    ].join('\n');
    let response;
    try {
      response = await send(webhook + '?wait=true', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({content, allowed_mentions: {parse: []}}),
        signal: AbortSignal.timeout(8000), redirect: 'error'
      });
    } catch {
      // Discord may have accepted the message before the connection was lost.
      // Keep the claim so a retry cannot send a duplicate.
      return reply({error: 'A Discord-küldés visszaigazolása nem érkezett meg.', sent}, 502);
    }
    if (!response.ok) {
      if (response.status < 500) {
        // Discord explicitly rejected the request. A later run can try again.
        await env.DB.prepare('DELETE FROM discord_match_reminders WHERE match_id=? AND lead_minutes=?').bind(match.id,match.lead_minutes).run();
      }
      return reply({error: 'A Discord nem igazolta vissza a küldést.', discord_status: response.status, sent}, 502);
    }
    sent++;
  }
  return reply({ok: true, sent});
}
