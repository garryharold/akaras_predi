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
  const webhook = env.DISCORD_WEBHOOK_URL?.trim();
  if (!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(webhook || '')) {
    return reply({error: 'A Discord-webhook beállítása hiányzik vagy hibás.'}, 503);
  }
  const minutes = Number(env.DISCORD_REMINDER_MINUTES || 30);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
    return reply({error: 'A DISCORD_REMINDER_MINUTES értéke 5 és 1440 közötti egész szám legyen.'}, 503);
  }
  const url = new URL(request.url);
  const time = now();
  const from = new Date(time).toISOString();
  const to = new Date(time + minutes * 60_000).toISOString();
  const matches = await env.DB.prepare(`
    SELECT m.id,m.start_at,m.prediction_lock_at,a.name AS home,b.name AS away,
      s.league_id,s.id AS season_id,p.id AS phase_id
    FROM matches m
    JOIN teams a ON a.id=m.team_a_id JOIN teams b ON b.id=m.team_b_id
    JOIN phases p ON p.id=m.phase_id JOIN seasons s ON s.id=p.season_id
    WHERE m.status='scheduled' AND m.start_at>? AND m.prediction_lock_at>?
      AND m.prediction_lock_at<=?
      AND NOT EXISTS (SELECT 1 FROM discord_match_reminders r WHERE r.match_id=m.id)
    ORDER BY m.prediction_lock_at,m.id LIMIT 5
  `).bind(from,from,to).all();
  if (url.searchParams.get('dry_run') === '1') {
    return reply({ok: true, dry_run: true, eligible: matches.results.length, minutes});
  }
  let sent = 0;
  for (const match of matches.results) {
    const current = new Date(now()).toISOString();
    const claimed = await env.DB.prepare(`
      INSERT INTO discord_match_reminders (match_id)
      SELECT id FROM matches WHERE id=? AND status='scheduled'
        AND start_at>? AND prediction_lock_at>? AND prediction_lock_at=?
      ON CONFLICT (match_id) DO NOTHING RETURNING match_id
    `).bind(match.id,current,current,match.prediction_lock_at).first();
    if (!claimed) continue;

    const deadline = Math.floor(Date.parse(match.prediction_lock_at) / 1000);
    const start = Math.floor(Date.parse(match.start_at) / 1000);
    const link = new URL('/',url.origin);
    link.hash = ['league',match.league_id,match.season_id,match.phase_id].map(encodeURIComponent).join('/');
    const content = [
      '🎯 **Tippemlékeztető**',
      '**' + discordLabel(match.home) + ' – ' + discordLabel(match.away) + '**',
      'Tippelés lezárása <t:' + deadline + ':t> (<t:' + deadline + ':R>)',
      'Meccskezdés <t:' + start + ':f>',
      'Ha még nincs tipped, add le az Akarásban: <' + link.href + '>'
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
        await env.DB.prepare('DELETE FROM discord_match_reminders WHERE match_id=?').bind(match.id).run();
      }
      return reply({error: 'A Discord nem igazolta vissza a küldést.', discord_status: response.status, sent}, 502);
    }
    sent++;
  }
  return reply({ok: true, sent});
}
