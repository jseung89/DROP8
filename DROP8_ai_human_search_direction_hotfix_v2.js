const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const target = path.join(projectRoot, 'server', 'src', 'rooms', 'Drop8Room.ts');
const backup = path.join(projectRoot, 'server', 'src', 'rooms', 'Drop8Room.ts.before_ai_human_search_direction_v2.bak');

if (!fs.existsSync(target)) throw new Error(`대상 파일을 찾지 못했습니다: ${target}`);

const raw = fs.readFileSync(target, 'utf8');
const crlf = raw.includes('\r\n');
let source = raw.replace(/\r\n/g, '\n');
const marker = '// DROP8_AI_HUMAN_SEARCH_DIRECTION_HOTFIX_V2';

if (source.includes(marker)) {
  console.log('AI 인간형 탐색 방향 V2가 이미 적용되어 있습니다.');
  process.exit(0);
}

if (!fs.existsSync(backup)) {
  fs.copyFileSync(target, backup);
  console.log(`백업 생성: ${backup}`);
}

function replaceOnce(oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label} 문맥 개수 오류: ${count}`);
  source = source.replace(oldText, newText);
  console.log(`${label} 적용 완료`);
}

replaceOnce(
  "memory.searchUntil=Math.max(memory.searchUntil,this.now()+3.2);",
  "memory.searchUntil=Math.max(memory.searchUntil,this.now()+7.5);",
  '목표 상실 수색시간 7.5초'
);

const oldSearch = "    if(memory.searchUntil>now&&memory.confidence>10){memory.confidence=Math.max(0,memory.confidence-(now-memory.lastSeenAt)*.6);p.aiState='SEARCH_LAST_SEEN';intent.state='SEARCH_LAST_SEEN';this.setAiDestination(p,intent,memory.lastSeenX,memory.lastSeenY);return;}";

const newSearch = `    if(memory.searchUntil>now&&memory.confidence>10){
      memory.confidence=Math.max(0,memory.confidence-(now-memory.lastSeenAt)*.6);
      p.aiState='SEARCH_LAST_SEEN';
      const continuingSearch=[
        intent.state==='SEARCH_LAST_SEEN',
        intent.lastRepathReason==='human-search-leg',
        now<intent.repathAt,
        intent.route.length>0,
        distance(p.x,p.y,intent.routeGoalX,intent.routeGoalY)>66,
      ].every(Boolean);
      intent.state='SEARCH_LAST_SEEN';
      if(continuingSearch)return;
      const lastSeenDistance=distance(p.x,p.y,memory.lastSeenX,memory.lastSeenY);
      if(lastSeenDistance>78&&intent.lastRepathReason!=='human-search-leg'){
        this.setAiDestination(p,intent,memory.lastSeenX,memory.lastSeenY);
        intent.repathAt=Math.max(intent.repathAt,now+1.8);
        intent.lastRepathReason='human-search-approach';
        return;
      }
      const hasPreviousLeg=intent.lastRepathReason==='human-search-leg';
      const previousHeading=hasPreviousLeg
        ?Math.atan2(intent.routeGoalY-p.y,intent.routeGoalX-p.x)
        :Math.atan2(memory.lastSeenY-p.y,memory.lastSeenX-p.x);
      const roll=this.lootRandom();
      let turn=(this.lootRandom()-.5)*.22;
      if(roll>.72&&roll<=.92)turn=(this.lootRandom()<.5?-1:1)*(.32+this.lootRandom()*.5);
      if(roll>.92)turn=Math.PI+(this.lootRandom()-.5)*.45;
      const heading=previousHeading+turn;
      const legDistance=280+this.lootRandom()*180;
      const searchX=clamp(p.x+Math.cos(heading)*legDistance,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
      const searchY=clamp(p.y+Math.sin(heading)*legDistance,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
      this.setAiDestination(p,intent,searchX,searchY,true);
      intent.repathAt=now+2.8+this.lootRandom()*1.4;
      intent.lastRepathReason='human-search-leg';
      if(AI_HUMAN_DEBUG)console.debug('[DROP8 AI HUMAN] search-leg',{ai:p.id,heading:Number(heading.toFixed(2)),goalX:Math.round(searchX),goalY:Math.round(searchY)});
      return;
    }`;

replaceOnce(oldSearch, newSearch, '한 방향 수색 이동');

const oldEarlyPatrol = "p.aiState=this.aiHasUsableGun(p)?'COMBAT_READY':'PATROL';intent.state=p.aiState;const patrol=this.state.zoneActive?{x:this.state.zoneX+(this.lootRandom()-.5)*500,y:this.state.zoneY+(this.lootRandom()-.5)*500}:this.aiPatrolPoint();this.setAiDestination(p,intent,patrol.x,patrol.y);return;}";

const newEarlyPatrol = `p.aiState=this.aiHasUsableGun(p)?'COMBAT_READY':'PATROL';
      const earlyPatrolState=p.aiState;
      const keepEarlyPatrol=[
        intent.state===earlyPatrolState,
        intent.lastRepathReason==='human-patrol-leg',
        now<intent.repathAt,
        intent.route.length>0,
        distance(p.x,p.y,intent.routeGoalX,intent.routeGoalY)>70,
      ].every(Boolean);
      intent.state=earlyPatrolState;
      if(!keepEarlyPatrol){
        const heading=intent.route.length>0
          ?Math.atan2(intent.routeGoalY-p.y,intent.routeGoalX-p.x)+(this.lootRandom()-.5)*.7
          :this.lootRandom()*Math.PI*2;
        const roamDistance=360+this.lootRandom()*260;
        const patrol=this.state.zoneActive
          ?{x:this.state.zoneX+(this.lootRandom()-.5)*500,y:this.state.zoneY+(this.lootRandom()-.5)*500}
          :{x:clamp(p.x+Math.cos(heading)*roamDistance,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS),y:clamp(p.y+Math.sin(heading)*roamDistance,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS)};
        this.setAiDestination(p,intent,patrol.x,patrol.y,true);
        intent.repathAt=now+5+this.lootRandom()*3;
        intent.lastRepathReason='human-patrol-leg';
      }
      return;}`;

replaceOnce(oldEarlyPatrol, newEarlyPatrol, '초반 순찰 목표 유지');

const oldPatrol = "p.aiState='PATROL';intent.state='PATROL';const patrol=this.state.zoneActive?{x:this.state.zoneX+(this.lootRandom()-.5)*Math.min(650,this.state.zoneRadius*.45),y:this.state.zoneY+(this.lootRandom()-.5)*Math.min(650,this.state.zoneRadius*.45)}:this.aiPatrolPoint();this.setAiDestination(p,intent,patrol.x,patrol.y);";

const newPatrol = `const keepPatrol=[
      intent.state==='PATROL',
      intent.lastRepathReason==='human-patrol-leg',
      now<intent.repathAt,
      intent.route.length>0,
      distance(p.x,p.y,intent.routeGoalX,intent.routeGoalY)>70,
    ].every(Boolean);
    p.aiState='PATROL';
    intent.state='PATROL';
    if(!keepPatrol){
      const currentHeading=intent.route.length>0
        ?Math.atan2(intent.routeGoalY-p.y,intent.routeGoalX-p.x)
        :this.lootRandom()*Math.PI*2;
      const turnRoll=this.lootRandom();
      let heading=currentHeading+(this.lootRandom()-.5)*.34;
      if(turnRoll>.72&&turnRoll<=.92)heading=currentHeading+(this.lootRandom()<.5?-1:1)*(.35+this.lootRandom()*.55);
      if(turnRoll>.92)heading=currentHeading+Math.PI+(this.lootRandom()-.5)*.4;
      const roamDistance=380+this.lootRandom()*300;
      const patrol=this.state.zoneActive
        ?{x:this.state.zoneX+(this.lootRandom()-.5)*Math.min(650,this.state.zoneRadius*.45),y:this.state.zoneY+(this.lootRandom()-.5)*Math.min(650,this.state.zoneRadius*.45)}
        :{x:clamp(p.x+Math.cos(heading)*roamDistance,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS),y:clamp(p.y+Math.sin(heading)*roamDistance,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS)};
      this.setAiDestination(p,intent,patrol.x,patrol.y,true);
      intent.repathAt=now+5+this.lootRandom()*3;
      intent.lastRepathReason='human-patrol-leg';
      if(AI_HUMAN_DEBUG)console.debug('[DROP8 AI HUMAN] patrol-leg',{ai:p.id,heading:Number(heading.toFixed(2)),goalX:Math.round(patrol.x),goalY:Math.round(patrol.y)});
    }`;

replaceOnce(oldPatrol, newPatrol, '일반 순찰 목표 유지');

const preferredAnchor = '// DROP8_AI_LARGE_BUILDING_PERIMETER_HOTFIX';
const fallbackAnchor = '// DROP8_REFACTOR_019_AI_HUMANIZATION';
if (source.includes(preferredAnchor)) source = source.replace(preferredAnchor, `${preferredAnchor}\n${marker}`);
else if (source.includes(fallbackAnchor)) source = source.replace(fallbackAnchor, `${fallbackAnchor}\n${marker}`);
else source = `${marker}\n${source}`;

fs.writeFileSync(target, crlf ? source.replace(/\n/g, '\r\n') : source, 'utf8');
console.log('AI 인간형 수색 방향 V2 적용 완료');
console.log('다음 명령: pnpm --filter @drop8/server typecheck');
