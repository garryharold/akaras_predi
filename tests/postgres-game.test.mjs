import {fixture} from './pg-fixture.mjs';
import {bootstrapAdmin} from '../server/setup.mjs';
import {handleAuth} from '../lib/account-auth.ts';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {handleGame} from '../lib/game-api.ts';
import {validSeries,pointsFor,standingsFor} from '../lib/game-engine.ts';
const {pg,DB}=await fixture();
await bootstrapAdmin(DB,'owner@example.test','Test password for owner!');
async function account(email,password){const r=await handleAuth(new Request('https://example.test/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})}),{DB});assert.equal(r.status,200);return {cookie:r.headers.get('set-cookie').split(';')[0]};}
for(const email of ['player@example.test','other@example.test']){const r=await handleAuth(new Request('https://example.test/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'Test password for player!'})}),{DB});assert.equal(r.status,201);}
const admin=await account('owner@example.test','Test password for owner!'),user=await account('player@example.test','Test password for player!'),userB=await account('other@example.test','Test password for player!');
const passwordUserA=(await DB.prepare('SELECT user_id FROM auth_accounts WHERE email=?').bind('player@example.test').first()).user_id,passwordUserB=(await DB.prepare('SELECT user_id FROM auth_accounts WHERE email=?').bind('other@example.test').first()).user_id;
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
async function api(path,b,method,who=admin){const r=await handleGame(new Request('https://example.test/api/game/'+path,{method:method||(b===undefined?'GET':'POST'),headers:{'Content-Type':'application/json',...who},body:b===undefined?undefined:JSON.stringify(b)}),{DB});return{status:r.status,data:await r.json()}}
for(const bo of [1,3,5,7,9]){const wins=(bo+1)/2;for(let l=0;l<wins;l++){eq(validSeries(wins,l,bo),true);eq(validSeries(l,wins,bo),true)}eq(validSeries(wins,wins,bo),false);eq(validSeries(0,0,bo),false)}
const m={status:'completed',score_a:3,score_b:1,mvp_player_id:'p1'};
eq(pointsFor({score_a:3,score_b:1,mvp_player_id:'p1'},m).total,80);eq(pointsFor({score_a:3,score_b:1,mvp_player_id:'p2'},m).total,50);eq(pointsFor({score_a:3,score_b:2,mvp_player_id:'p1'},m).total,60);eq(pointsFor({score_a:0,score_b:3,mvp_player_id:'p1'},m).total,30);eq(pointsFor({score_a:3,score_b:1}, {...m,status:'cancelled'}).total,0);
eq((await api('initialize',{})).status,200);eq((await api('initialize',{})).status,200);let d=(await api('bootstrap')).data;eq(d.leagues.length,7);eq(d.seasons.length,7);
eq((await api('initialize',{},'POST',user)).status,403);
const sample=JSON.parse(readFileSync(new URL('../public/templates/akaras-adatok-pelda.json',import.meta.url),'utf8'));
for(const match of sample.matches.filter(m=>m.status==='scheduled'))match.start_at=new Date(Date.now()+86400000).toISOString();
let r=await api('import',{dataset:sample,apply:false});eq(r.status,200);eq(r.data.counts.teams,2);eq((await api('bootstrap')).data.teams.length,0);
r=await api('import',{dataset:sample,apply:true});eq(r.status,200);d=(await api('bootstrap')).data;eq(d.teams.length,2);eq(d.players.length,10);eq(d.matches.length,4);eq(d.match_players.length,40);eq(d.standings['minta-alapszakasz'][0].rows[0].wins,1);eq(d.standings['minta-alapszakasz'][0].rows[0].maps_for,2);
eq((await api('import',{dataset:sample,apply:true})).status,200);eq((await api('bootstrap')).data.matches.length,4);
const bad=structuredClone(sample);bad.matches=[{...sample.matches[0],id:'new-bad-match',team_b_id:'missing'}];eq((await api('import',{dataset:bad,apply:false})).status,400);
const newTeam={id:'new-team-rollback',name:'Rollback',short_name:'ROLL',region_id:'KR',league_id:'lck',aliases:[]};const bad2={schema_version:1,teams:[newTeam],players:[{id:'bad-player',ign:'Bad',country_ids:['NOT-A-COUNTRY']}]};eq((await api('import',{dataset:bad2,apply:true})).status,400);eq((await api('bootstrap')).data.teams.some(t=>t.id===newTeam.id),false);
const pick={match_id:'minta-match-1',score_a:2,score_b:1,mvp_player_id:'minta-a-mid'};
eq((await api('prediction',pick,'POST',{})).status,401);eq((await api('prediction',{...pick,score_a:1,score_b:1},'POST',user)).status,400);eq((await api('prediction',{...pick,mvp_player_id:'unknown'},'POST',user)).status,400);eq((await api('prediction',pick,'POST',user)).status,200);eq((await api('prediction',pick,'POST',user)).status,200);eq((await api('bootstrap',undefined,undefined,user)).data.predictions.length,1);eq((await api('bootstrap',undefined,undefined,userB)).data.predictions.length,0);
eq((await api('result/minta-match-1',{status:'completed',score_a:2,score_b:1,mvp_player_id:'minta-a-mid'},'POST',user)).status,403);
eq((await api('result/minta-match-1',{status:'completed',score_a:2,score_b:2,mvp_player_id:null})).status,400);
eq((await api('result/minta-match-1',{status:'completed',score_a:2,score_b:1,mvp_player_id:'minta-a-mid'})).status,200);
d=(await api('bootstrap',undefined,undefined,user)).data;eq(d.predictions[0].points.total,80);eq(d.leaderboard[0].points,80);eq(d.standings['minta-alapszakasz'][0].rows[0].wins,2);eq(d.standings['minta-alapszakasz'][0].rows[0].maps_for,4);eq((await api('prediction',pick,'POST',user)).status,409);
eq((await api('result/minta-match-1',{status:'completed',score_a:0,score_b:2,mvp_player_id:'minta-b-mid'})).status,200);d=(await api('bootstrap',undefined,undefined,user)).data;eq(d.predictions[0].points.total,0);eq(d.standings['minta-alapszakasz'][0].rows.reduce((n,r)=>n+r.played,0),4);
const old=sample.matches[0];const editable={phase_id:old.phase_id,group_id:null,team_a_id:old.team_a_id,team_b_id:old.team_b_id,best_of:3,start_at:new Date(Date.now()+172800000).toISOString(),round_name:'Rescheduled',round_order:1,bracket_side:'main'};
eq((await api('match/'+old.id,{...editable,best_of:5},'PATCH')).status,409);eq((await api('match/'+old.id,editable,'PATCH')).status,200);
eq((await api('result/'+old.id,{status:'scheduled',score_a:null,score_b:null,mvp_player_id:null})).status,200);eq((await api('prediction',pick,'POST',user)).status,409);
const locked='minta-match-2';await DB.prepare('UPDATE matches SET prediction_lock_at=? WHERE id=?').bind('2020-01-01T00:00:00.000Z',locked).run();eq((await api('prediction',{...pick,match_id:locked},'POST',user)).status,409);
const phaseBody={season_id:'lck-2026',name:'New Group',type:'groups',sort_order:4,groups:[{id:'new-a',name:'A'},{id:'new-b',name:'B'}],participants:[{team_id:'minta-team-a',group_id:'new-a'},{team_id:'minta-team-b',group_id:'new-b'}]};r=await api('phase',phaseBody);eq(r.status,200);eq((await api('match',{...editable,phase_id:r.data.id,group_id:'new-a'})).status,400);
eq((await api('season',{league_id:'lck',year:2027,name:'2027'})).status,200);eq((await api('season',{league_id:'lck',year:2027,name:'2027 again'})).status,409);
const groups=standingsFor({id:'p',win_points:3,loss_points:0},[{phase_id:'p',status:'completed',team_a_id:'a',team_b_id:'b',score_a:2,score_b:0,start_at:'2026'}],[{phase_id:'p',team_id:'a',group_id:'x'},{phase_id:'p',team_id:'b',group_id:'x'},{phase_id:'p',team_id:'c',group_id:'y'}],[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}]);eq(groups.length,2);eq(groups.find(g=>g.group_id==='x').rows[0].points,3);eq(groups.find(g=>g.group_id==='y').rows[0].played,0);
console.log(`PASS: ${checks} game checks. Bo1–9, max 80 scoring, privacy, admin authorization, atomic/idempotent JSON import, snapshots, group membership, result correction, standings and server lock.`);
// Brackets are plans, so the final exists before either finalist is known.
const brTeams=[{id:'br-c',name:'Bracket C',short_name:'BRC'},{id:'br-d',name:'Bracket D',short_name:'BRD'}];
eq((await api('import',{dataset:{schema_version:1,teams:brTeams},apply:true})).status,200);
const brParticipants=['minta-team-a','minta-team-b','br-c','br-d'];
r=await api('phase',{season_id:'lck-2026',name:'Bracket test',type:'double_elimination',participants:brParticipants.map(team_id=>({team_id}))});eq(r.status,200);const brPhase=r.data.id;
const slot=(type,id)=>id?{type,id}:{type};
const brNode=(id,order,a,b,side='upper')=>({id,label:id,round_name:order===1?'Elődöntő':'Döntő',round_order:order,bracket_side:side,position:0,best_of:3,match_id:null,a,b});
let brNodes=[brNode('semi-a',1,slot('team',brParticipants[0]),slot('team',brParticipants[1])),brNode('semi-b',1,slot('team',brParticipants[2]),slot('team',brParticipants[3])),brNode('final',2,slot('winner','semi-a'),slot('winner','semi-b'),'final'),brNode('lower',2,slot('loser','semi-a'),slot('loser','semi-b'),'lower')];
eq((await api('bracket/'+brPhase,{nodes:brNodes,revision:0},'POST',user)).status,403);
eq((await api('bracket/'+brPhase,{nodes:brNodes,revision:0})).status,200);
eq((await api('bracket/'+brPhase,{nodes:brNodes,revision:0})).status,409);
eq((await api('bracket/'+brPhase,{nodes:[...brNodes,brNode('duplicate-route',3,slot('winner','semi-a'),slot('tbd'))],revision:1})).status,409);
eq((await api('bracket/'+brPhase,{nodes:brNodes.map(n=>n.id==='semi-a'?{...n,a:slot('winner','final')}:n),revision:1})).status,409);
eq((await api('bracket/'+brPhase,{nodes:brNodes.map(n=>n.id==='semi-a'?{...n,a:slot('team','unknown')}:n),revision:1})).status,409);
const brDate=new Date(Date.now()+86400000).toISOString();
eq((await api('bracket-activate/'+brPhase,{node_id:'final',start_at:brDate,revision:1})).status,400);
r=await api('bracket-activate/'+brPhase,{node_id:'semi-a',start_at:brDate,revision:1});eq(r.status,200);const semiA=r.data.id;
r=await api('bracket-activate/'+brPhase,{node_id:'semi-b',start_at:brDate,revision:2});eq(r.status,200);const semiB=r.data.id;
eq((await api('result/'+semiA,{status:'completed',score_a:2,score_b:0,mvp_player_id:null})).status,200);
eq((await api('bracket-activate/'+brPhase,{node_id:'final',start_at:brDate,revision:3})).status,400);
eq((await api('result/'+semiB,{status:'completed',score_a:1,score_b:2,mvp_player_id:null})).status,200);
r=await api('bracket-activate/'+brPhase,{node_id:'final',start_at:brDate,revision:3});eq(r.status,200);const finalId=r.data.id;
d=(await api('bootstrap')).data;const actualFinal=d.matches.find(m=>m.id===finalId);eq(actualFinal.team_a_id,brParticipants[0]);eq(actualFinal.team_b_id,brParticipants[3]);
r=await api('bracket-activate/'+brPhase,{node_id:'lower',start_at:brDate,revision:4});eq(r.status,200);d=(await api('bootstrap')).data;const lowerMatch=d.matches.find(m=>m.id===r.data.id);eq(lowerMatch.team_a_id,brParticipants[1]);eq(lowerMatch.team_b_id,brParticipants[2]);
// A correction cannot silently invalidate an already created next-round pairing.
eq((await api('result/'+semiA,{status:'completed',score_a:0,score_b:2,mvp_player_id:null})).status,409);
eq((await api('bootstrap')).data.matches.find(m=>m.id===semiA).score_a,2);
eq((await api('bracket-activate/'+brPhase,{node_id:'final',start_at:brDate,revision:5})).status,409);
console.log('PASS: bracket planning, revisions, admin guard, invalid routes, unresolved slots, winner and loser advancement, match creation and correction consistency.');

// Every tournament mutation requires admin identity, including identity-less requests.
for(const actor of [{},user])for(const path of ['initialize','season','phase','match','result/'+semiA,'bracket/'+brPhase,'bracket-activate/'+brPhase,'import'])eq((await api(path,{},'POST',actor)).status,403);
// A second player's independent total is visible to everyone; private picks remain private.
eq((await api('prediction',{match_id:finalId,score_a:2,score_b:0,mvp_player_id:null},'POST',userB)).status,200);
eq((await api('result/'+finalId,{status:'completed',score_a:2,score_b:0,mvp_player_id:null})).status,200);
eq((await api('profile',{display_name:'Player A'},'POST',user)).status,200);
eq((await api('profile',{display_name:'Player B'},'POST',userB)).status,200);
let boardAnon=(await api('bootstrap',undefined,undefined,{})).data;
eq(boardAnon.leaderboard.find(p=>p.user_id===passwordUserB).points,50);
eq(boardAnon.leaderboard.find(p=>p.user_id===passwordUserA).points,0);
eq(boardAnon.predictions.length,0);
eq((await api('bootstrap',undefined,undefined,user)).data.leaderboard,boardAnon.leaderboard);
eq('birth_date' in boardAnon.players[0],false);
eq('first_name' in boardAnon.players[0],false);
eq('source_label' in boardAnon.roster_memberships[0],false);
eq((await api('bootstrap',undefined,undefined,userB)).data.predictions.length,1);
console.log('PASS: anonymous/non-admin write denial, globally visible independent player scores, zero-point players, private predictions and editor metadata separation.');

await pg.close();
