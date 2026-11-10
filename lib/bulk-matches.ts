type Row = Record<string, any>;
const normalize = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('hu-HU');
const localClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

function budapestStart(day: string, hours: string, minutes: string) {
  const label = day + ' ' + hours + ':' + minutes;
  const utc = Date.parse(day + 'T' + hours + ':' + minutes + ':00Z');
  const possible = [60, 120].map(offset => new Date(utc - offset * 60000))
    .filter(time => Number.isFinite(+time) && localClock.format(time) === label);
  if (possible.length !== 1) throw Error('Érvénytelen vagy az óraátállítás miatt kétértelmű budapesti időpont.');
  return possible[0].toISOString();
}

function unique(rows: Row[], missing: string, ambiguous: string) {
  if (!rows.length) throw Error(missing);
  if (rows.length > 1) throw Error(ambiguous);
  return rows[0];
}

export function parseBulkMatches(source: string, selectedPhaseId: string, catalog: Record<string, Row[]>) {
  const {leagues, seasons, phases, phase_teams, teams, matches} = catalog;
  const selected = phases.find(phase => phase.id === selectedPhaseId);
  const selectedSeason = seasons.find(season => season.id === selected?.season_id);
  const defaultLeague = leagues.find(league => league.id === selectedSeason?.league_id);
  let league = defaultLeague;
  let day = '';
  const rows: Row[] = [];
  const errors: {line:number; message:string}[] = [];
  const key = (m: Row) => JSON.stringify([m.phase_id, m.start_at, ...[m.team_a_id,m.team_b_id].sort()]);
  const used = new Set(matches.map(key));
  const pattern = /^(\d{2})[.:](\d{2})\s+(?:"([^"]+)"|([^\s"]+))\s+(?:"([^"]+)"|([^\s"]+))\s+bo([13579])$/i;
  for (const [index,raw] of source.split(/\r?\n/).entries()) {
    const input = raw.trim();
    if (!input) continue;
    const line = index+1;
    try {
      if (input.startsWith('[')) {
        league = undefined;
        const tag = /^\[([^\]]+)\]$/.exec(input);
        if (!tag) throw Error('A liga formátuma [LEC].');
        const name = normalize(tag[1]);
        league = unique(leagues.filter(item => [item.id,item.name,item.short_name].some(value => normalize(value) === name)),
          'Ismeretlen liga: '+tag[1], 'Több liga is megfelel ennek a névnek.');
        continue;
      }
      if (input.startsWith('#')) {
        day = '';
        if (!/^#20\d{2}-\d{2}-\d{2}$/.test(input)) throw Error('A dátum formátuma #ÉÉÉÉ-HH-NN.');
        budapestStart(input.slice(1),'12','00');
        day = input.slice(1);
        continue;
      }
      if (rows.length >= 50) throw Error('Egyszerre legfeljebb 50 meccset lehet felvinni.');
      const parsed = pattern.exec(input);
      if (!parsed) throw Error('A meccssor formátuma: 14.00 "Csapat A" "Csapat B" bo3.');
      if (!league || !day) throw Error('Adj meg egy ligát és egy dátumot a meccs előtt.');
      const year = Number(day.slice(0,4));
      const leagueSeasons = seasons.filter(season => season.league_id === league!.id && Number(season.year) === year);
      const target = selected && selectedSeason && leagueSeasons.some(season => season.id === selectedSeason.id)
        ? selected
        : unique(phases.filter(phase => leagueSeasons.some(season => season.id === phase.season_id)),
            'Ehhez a ligához és évhez nincs fázis.', 'Több fázis van. Válaszd ki felül a megfelelő fázist, és külön töltsd fel ezt a ligát.');
      const entries = phase_teams.filter(entry => entry.phase_id === target.id);
      const available = teams.filter(team => entries.some(entry => entry.team_id === team.id));
      const resolve = (name: string) => unique(
        available.filter(team => [team.name,team.short_name].some(value => normalize(value) === normalize(name))),
        'A csapat nincs a fázisban: '+name, 'Nem egyértelmű csapatnév: '+name);
      const a = resolve(parsed[3] || parsed[4]), b = resolve(parsed[5] || parsed[6]);
      if (a.id === b.id) throw Error('Két különböző csapat szükséges.');
      const group = entries.find(entry => entry.team_id === a.id)?.group_id;
      if (target.type === 'groups' && (!group || group !== entries.find(entry => entry.team_id === b.id)?.group_id)) {
        throw Error('A két csapatnak ugyanabban a csoportban kell lennie.');
      }
      const match = {phase_id:target.id, group_id:target.type==='groups'?group:null, team_a_id:a.id, team_b_id:b.id,
        start_at:budapestStart(day,parsed[1],parsed[2]), best_of:Number(parsed[7])};
      if (used.has(key(match))) throw Error('Ez a párosítás már szerepel ennél a fázisnál és időpontnál.');
      used.add(key(match));
      rows.push({...match, line, league:league.short_name, phase:target.name, home:a.name, away:b.name});
    } catch (error) {
      errors.push({line,message:(error as Error).message});
    }
  }
  if (!rows.length && !errors.length) errors.push({line:0,message:'Illessz be legalább egy meccssort.'});
  return {rows, errors};
}
