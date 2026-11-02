// Refresh only matches whose predictions are still open. Finished/live/locked
// matches keep their historical player snapshots and existing predictions.
export function openRosterStatements(db:D1Database,now=new Date().toISOString()){
 const eligible=`r.team_id IN (m.team_a_id,m.team_b_id) AND r.started_at<=substr(m.start_at,1,10) AND (r.ended_at IS NULL OR r.ended_at>substr(m.start_at,1,10)) AND p.active=1`;
 return [
  db.prepare(`DELETE FROM match_players WHERE match_id IN (SELECT id FROM matches WHERE status='scheduled' AND prediction_lock_at>?) AND NOT EXISTS (SELECT 1 FROM roster_memberships r JOIN matches m ON m.id=match_players.match_id JOIN players p ON p.id=r.player_id WHERE r.player_id=match_players.player_id AND r.team_id=match_players.team_id AND ${eligible})`).bind(now),
  db.prepare(`INSERT OR IGNORE INTO match_players (id,match_id,player_id,team_id) SELECT ? || ':' || m.id || ':' || r.player_id,m.id,r.player_id,r.team_id FROM matches m JOIN roster_memberships r ON r.team_id IN (m.team_a_id,m.team_b_id) JOIN players p ON p.id=r.player_id WHERE m.status='scheduled' AND m.prediction_lock_at>? AND ${eligible}`).bind(crypto.randomUUID(),now)
 ];
}
export async function syncOpenMatchRosters(db:D1Database){await db.batch(openRosterStatements(db));}
