// A bracket plan can exist before its matches and participants are known.
export type BracketSlot={type:'tbd'|'team'|'winner'|'loser';id?:string};
export type BracketNode={id:string;label:string;round_name:string;round_order:number;bracket_side:string;position:number;best_of:number;match_id:string|null;a:BracketSlot;b:BracketSlot};
type Row=Record<string,any>;
export function resolveBracket(nodes:BracketNode[],matches:Row[]){
 const result=new Map<string,{a:string|null;b:string|null}>();
 const visit=(n:BracketNode):{a:string|null;b:string|null}=>{if(result.has(n.id))return result.get(n.id)!;
 const slot=(s:BracketSlot):string|null=>{if(s.type==='team')return s.id!;if(s.type==='tbd')return null;const source=nodes.find(n=>n.id===s.id);if(!source)return null;const teams=visit(source),m=matches.find(m=>m.id===source.match_id);if(!m||m.status!=='completed'||teams.a!==m.team_a_id||teams.b!==m.team_b_id)return null;return s.type==='winner'?(m.score_a>m.score_b?teams.a:teams.b):(m.score_a>m.score_b?teams.b:teams.a)};
 const r={a:slot(n.a),b:slot(n.b)};result.set(n.id,r);return r};
 nodes.forEach(visit);return result;
}
export function validateBracket(nodes:BracketNode[],phase:string,matches:Row[],participants:Row[]){
 if(nodes.length>128)throw Error('Ágrajz: legfeljebb 128 meccshely hozható létre.');
 const ids=new Set(nodes.map(n=>n.id));if(ids.size!==nodes.length)throw Error('Ágrajz: ismétlődő meccsazonosító.');
 const usedMatches=new Set(),outputs=new Set(),done=new Set(),visiting=new Set();
 const visit=(n:BracketNode)=>{if(visiting.has(n.id))throw Error('Ágrajz: körkörös továbbjutás nem engedélyezett.');if(done.has(n.id))return;visiting.add(n.id);
 for(const s of [n.a,n.b]){if(s.type==='team'&&!participants.some(p=>p.phase_id===phase&&p.team_id===s.id))throw Error('Ágrajz: a csapat nincs a fázis résztvevői között.');if(['winner','loser'].includes(s.type)){const source=nodes.find(x=>x.id===s.id);if(!source)throw Error('Ágrajz: hiányzó forrásmeccs.');const output=s.id+'|'+s.type;if(outputs.has(output))throw Error('Ágrajz: ugyanaz a győztes vagy vesztes csak egy helyre juthat tovább.');outputs.add(output);if(source.round_order>=n.round_order)throw Error('Ágrajz: a cél fordulósorrendje legyen nagyobb a forrásénál.');visit(source)}}
 if(n.match_id){const m=matches.find(m=>m.id===n.match_id);if(!m||m.phase_id!==phase)throw Error('Ágrajz: csak a fázis meccse kapcsolható hozzá.');if(usedMatches.has(n.match_id))throw Error('Ágrajz: egy meccs csak egy helyen szerepelhet.');usedMatches.add(n.match_id)}visiting.delete(n.id);done.add(n.id)};
 nodes.forEach(visit);const resolved=resolveBracket(nodes,matches);
 for(const n of nodes){const r=resolved.get(n.id)!;if(r.a&&r.a===r.b)throw Error('Ágrajz: egy csapat nem játszhat saját maga ellen.');if(n.match_id){const m=matches.find(m=>m.id===n.match_id)!;if(!r.a||!r.b||r.a!==m.team_a_id||r.b!==m.team_b_id)throw Error('Ágrajz: a kapcsolt meccs párosítása eltér a továbbjutásból következő csapatoktól. Előbb rendezd a következő meccs kapcsolatát.')}}
 return resolved;
}
