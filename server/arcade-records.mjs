import {resolveViewer} from '../lib/identity.ts';

const difficulties = ['bronze', 'emerald', 'challenger'];
const reply = (data, status = 200) => Response.json(data, {
  status, headers: {'Cache-Control': 'no-store'}
});

export async function handleArcadeRecords(request, env) {
  if (new URL(request.url).pathname !== '/api/arcade/records') {
    return reply({error: 'Nincs ilyen végpont.'}, 404);
  }
  if (!['GET', 'POST'].includes(request.method)) return reply({error: 'Nem támogatott művelet.'}, 405);
  if (!env.DB) return reply({error: 'Az adatbázis nem elérhető.'}, 503);
  try {
    const viewer = await resolveViewer(request, env.DB);
    if (request.method === 'POST') {
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) return reply({error: 'Másik webhelyről indított mentés nem engedélyezett.'}, 403);
      if (!viewer) return reply({error: 'A közös rekordhoz jelentkezz be.'}, 401);
      const raw = await request.text();
      if (raw.length > 1024) return reply({error: 'Túl nagy kérés.'}, 413);
      let body;
      try { body = JSON.parse(raw); } catch { return reply({error: 'Hibás kérés.'}, 400); }
      if (!body || !difficulties.includes(body.difficulty) || !Number.isInteger(body.score) ||
          body.score <= 0 || body.score > 2147483600 || body.score % 100 !== 0) {
        return reply({error: 'Érvénytelen nehézség vagy pontszám.'}, 400);
      }
      // A single conditional upsert keeps concurrent submissions and retries consistent.
      // Equal scores preserve the player who reached the record first.
      await env.DB.prepare(`INSERT INTO item_guessr_records (difficulty,user_id,score)
        VALUES (?,?,?) ON CONFLICT (difficulty) DO UPDATE
        SET user_id=excluded.user_id, score=excluded.score, achieved_at=now()
        WHERE excluded.score > item_guessr_records.score`)
        .bind(body.difficulty, viewer.id, body.score).run();
    }
    const result = await env.DB.prepare(`SELECT r.difficulty,r.score,u.display_name AS player_name
      FROM item_guessr_records r JOIN prediction_users u ON u.id=r.user_id`).all();
    return reply({signed_in: !!viewer, records: result.results});
  } catch (error) {
    console.error('Item Guessr record error:', error.code || error.name);
    return reply({error: 'A rekord nem elérhető. Próbáld újra később.'}, 500);
  }
}
