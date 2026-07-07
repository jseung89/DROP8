// DROP 8 Refactor 025A — Open Arena HUD Layout Hotfix
// Latest-source based patch executor for DROP8_SOURCE.zip.
// Windows CMD:
//   node --experimental-strip-types DROP8_refactor_025A_open_arena_hud_layout_hotfix_patch_FIXED_v1.ts --dry-run
//   node --experimental-strip-types DROP8_refactor_025A_open_arena_hud_layout_hotfix_patch_FIXED_v1.ts
//   node --experimental-strip-types DROP8_refactor_025A_open_arena_hud_layout_hotfix_patch_FIXED_v1.ts --rollback
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

type ManifestFile={path:string;existed:boolean;beforeSha256:string;eol:'LF'|'CRLF';bom:boolean};
type Manifest={patchId:string;patchFile:string;createdAt:string;projectRoot:string;files:ManifestFile[];createdFiles:string[];generatedDirs:Array<{path:string;existed:boolean}>};
type Target={path:string;purpose:string;mode:'modify'|'create';marker?:string};

const PATCH_ID='DROP8 Refactor 025A Open Arena HUD Layout Hotfix FIXED v1';
const PATCH_FILE='DROP8_refactor_025A_open_arena_hud_layout_hotfix_patch_FIXED_v1.ts';
const BACKUP_NAME='refactor_025A_open_arena_hud_layout_hotfix_FIXED_v1';
const MARKER='DROP8_REFACTOR_025A_OPEN_ARENA_HUD_LAYOUT_HOTFIX';
const PRIOR_025='DROP8_REFACTOR_025_OPEN_ARENA_KILL_LIMIT_MATCH_CYCLE';
const PRIOR_024E='DROP8_REFACTOR_024E_OPEN_ARENA_SCOREBOARD_UX';
const args=process.argv.slice(2);
const dryRun=args.includes('--dry-run');
const rollbackIndex=args.indexOf('--rollback');
const internal=process.env.DROP8_PATCH_INTERNAL==='1';
const forceFail=process.env.DROP8_PATCH_FORCE_FAIL==='1';
const scriptDir=dirname(fileURLToPath(import.meta.url));
const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const read=(path:string)=>readFileSync(path,'utf8');
const timestamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
const hasBom=(text:string)=>text.charCodeAt(0)===0xfeff;
const eol=(text:string):'LF'|'CRLF'=>text.includes('\r\n')?'CRLF':'LF';
const normalize=(p:string)=>p.replace(/\\/g,'/');
function safe(path:string){const rel=normalize(path);if(!rel||rel.startsWith('/')||rel.split('/').includes('..'))throw new Error(`안전하지 않은 경로: ${path}`);return rel;}
function isRoot(path:string){return existsSync(join(path,'package.json'))&&existsSync(join(path,'client/src/main.ts'))&&existsSync(join(path,'client/src/GameScene.ts'))&&existsSync(join(path,'server/src/rooms/Drop8Room.ts'))&&existsSync(join(path,'shared/src/index.ts'));}
function findRoot(){for(const start of [process.cwd(),scriptDir]){let cursor=resolve(start);for(let i=0;i<10;i++){if(isRoot(cursor))return cursor;const parent=dirname(cursor);if(parent===cursor)break;cursor=parent;}}throw new Error('DROP8 프로젝트 루트를 찾지 못했습니다. 실행기를 프로젝트 최상위 폴더에 넣으세요.');}
function atomicWrite(path:string,content:string){mkdirSync(dirname(path),{recursive:true});const tmp=`${path}.drop8-${process.pid}-${Date.now()}.tmp`;writeFileSync(tmp,content,'utf8');renameSync(tmp,path);}
function count(text:string,needle:string){return needle?text.split(needle).length-1:0;}
function replaceExactly(text:string,from:string,to:string,label:string){const n=count(text,from);if(n!==1)throw new Error(`${label} 문맥 검증 실패: 예상 1회, 실제 ${n}회`);return text.replace(from,to);}
function insertTopMarker(text:string,comment:string){return text.includes(MARKER)?text:`${comment}\n${text}`;}

const TARGETS:Target[]=[
  {path:'client/src/main.ts',mode:'modify',marker:`// ${MARKER}`,purpose:'Open Arena 전용 HUD 레이아웃 클래스를 game 섹션에 부여하고 Battle Royale HUD와 분리'},
  {path:'client/src/GameScene.ts',mode:'modify',marker:`// ${MARKER}`,purpose:'Open Arena에서 Phaser 자기장 원·미니맵 자기장 라벨·자기장 경고음을 숨김'},
  {path:'client/src/style.css',mode:'modify',marker:`/* ${MARKER} */`,purpose:'미니맵·실시간 순위표·킬피드·정산창 영역을 z-index 덮기가 아닌 공간 분리로 재배치'},
  {path:'docs/PATCH_NOTES.md',mode:'modify',marker:`<!-- ${MARKER} -->`,purpose:'025A 패치 노트 추가'},
  {path:'server/tests/refactor025a-open-arena-hud-layout-source.test.ts',mode:'create',marker:`// ${MARKER}`,purpose:'HUD 레이아웃/자기장 숨김/BR 보호 소스 회귀 테스트 추가'},
];

const TEST_CONTENT=String.raw`// DROP8_REFACTOR_025A_OPEN_ARENA_HUD_LAYOUT_HOTFIX
import { describe,expect,it } from 'vitest';import { readFileSync } from 'node:fs';import { resolve } from 'node:path';
const project=resolve(process.cwd(),'..');
const main=readFileSync(resolve(project,'client/src/main.ts'),'utf8');
const scene=readFileSync(resolve(project,'client/src/GameScene.ts'),'utf8');
const css=readFileSync(resolve(project,'client/src/style.css'),'utf8');
const notes=readFileSync(resolve(project,'docs/PATCH_NOTES.md'),'utf8');
describe('Refactor 025A Open Arena HUD layout hotfix',()=>{
  it('uses an Open Arena-only layout class while keeping Battle Royale zone DOM guarded',()=>{
    expect(main).toContain("gameEl.classList.toggle('open-arena-layout',arena)");
    expect(main).toContain("gameEl.classList.remove('open-arena-layout','map-open')");
    expect(main).toContain("$('zoneHudItem').classList.toggle('hidden',arena)");
    expect(main).toContain("$('zoneText').textContent=arena?'없음'");
  });
  it('separates the live scoreboard from the right-side Phaser minimap and keeps result modal central',()=>{
    expect(css).toContain('#game.open-arena-layout #arenaScoreboardPanel');
    expect(css).toContain('left:14px;right:auto;top:66px');
    expect(css).toContain('#game.open-arena-layout #killfeed');
    expect(css).toContain('#game.open-arena-layout.map-open #killfeed{display:none}');
    expect(css).toContain('#game.open-arena-layout .arena-round-result{z-index:86');
    expect(css).toContain('#game.open-arena-layout #zoneHudItem{display:none!important}');
  });
  it('hides Battle Royale zone visuals and warning audio in Open Arena only',()=>{
    expect(scene).toContain("document.getElementById('game')?.classList.toggle('map-open',this.mapOpen)");
    expect(scene).toContain("if(!arena&&s.zoneActive)g.lineStyle(6,0x4db5ff,.72).strokeCircle(s.zoneX,s.zoneY,s.zoneRadius)");
    expect(scene).toContain("if(!arena&&s.zoneActive)g.lineStyle(2,0x4db5ff,.95).strokeCircle(x+s.zoneX*sc,y+s.zoneY*sc,s.zoneRadius*sc)");
    expect(scene).toContain("if(arena){this.miniLabel?.setVisible(false);return;}");
    expect(scene).toContain("if(this.net.roomConfig.gameMode==='openArena'){this.lastZoneState='';this.zoneWarningStage='';playLowHealth();return;}");
  });
  it('documents the 025A scope without changing kill-limit or match-cycle rules',()=>{
    expect(notes).toContain('Refactor 025A — Open Arena HUD Layout Hotfix');
    expect(notes).toContain('킬 제한·정산·라운드 재시작 로직은 변경하지 않았습니다');
  });
});
`;

const CSS_BLOCK=String.raw`

/* DROP8_REFACTOR_025A_OPEN_ARENA_HUD_LAYOUT_HOTFIX */
#game.open-arena-layout #arenaScoreboardPanel{left:14px;right:auto;top:66px;width:min(310px,calc(100vw - 456px));max-height:calc(100vh - 214px);overflow:hidden;display:flex;flex-direction:column;gap:4px;z-index:56}
#game.open-arena-layout #arenaScoreboardPanel.hidden{display:none}
#game.open-arena-layout #arenaPopulationText{line-height:1.35}
#game.open-arena-layout #arenaScoreboardRows{overflow:auto;max-height:min(330px,calc(100vh - 318px));padding-right:2px}
#game.open-arena-layout #killfeed{right:14px;top:276px;max-width:270px;pointer-events:none}
#game.open-arena-layout.map-open #killfeed{display:none}
#game.open-arena-layout #topHud{max-width:calc(100vw - 680px);flex-wrap:wrap;justify-content:center;row-gap:6px}
#game.open-arena-layout #zoneHudItem{display:none!important}
#game.open-arena-layout .arena-round-result{z-index:86;padding:28px;width:100%;height:100%;place-content:center}
#game.open-arena-layout .arena-round-result.hidden{display:none}
@media(max-width:1180px){#game.open-arena-layout #arenaScoreboardPanel{top:64px;width:min(292px,calc(100vw - 28px));max-height:190px}#game.open-arena-layout #arenaScoreboardRows{max-height:112px}#game.open-arena-layout #killfeed{top:276px;max-width:240px}#game.open-arena-layout #topHud{max-width:calc(100vw - 340px)}}
@media(max-width:900px){#game.open-arena-layout #arenaScoreboardPanel{left:14px;top:62px;width:min(270px,calc(100vw - 214px));max-height:174px}#game.open-arena-layout #arenaScoreboardRows{max-height:92px}#game.open-arena-layout #arenaScoreboardPanel .arena-score-row{grid-template-columns:20px 1fr}#game.open-arena-layout #arenaScoreboardPanel .arena-score-row em{display:none}#game.open-arena-layout #killfeed{right:8px;top:272px;max-width:210px}#game.open-arena-layout #topHud{max-width:calc(100vw - 300px);font-size:12px;gap:8px;padding:8px 10px}}
@media(max-width:620px){#game.open-arena-layout #arenaScoreboardPanel{top:58px;width:min(226px,calc(100vw - 200px));padding:9px;max-height:152px}#game.open-arena-layout #arenaScoreboardRows{max-height:78px}#game.open-arena-layout #arenaScoreboardPanel h3{font-size:12px}#game.open-arena-layout #arenaPopulationText{font-size:10px}#game.open-arena-layout #killfeed{display:none}#game.open-arena-layout #topHud{left:50%;max-width:calc(100vw - 236px)}}`;

const NOTES_SECTION=String.raw`<!-- DROP8_REFACTOR_025A_OPEN_ARENA_HUD_LAYOUT_HOTFIX -->
## Refactor 025A — Open Arena HUD Layout Hotfix

- Open Arena 전투 HUD에 'open-arena-layout' 클래스를 부여해 Battle Royale과 별도 레이아웃만 적용합니다.
- 실시간 순위표를 미니맵 우측 상단 영역에서 분리해 좌측 상단 독립 패널로 배치하고, 작은 화면에서는 높이와 행 정보를 축약합니다.
- 미니맵은 기존 우측 영역을 유지하며, Open Arena에서는 자기장 원·다음 원·안전구역 라벨을 그리지 않습니다.
- Open Arena의 자기장 DOM 항목과 Phaser 자기장 경고음은 숨기되, Battle Royale 자기장 HUD·월드 원·미니맵 라벨은 기존 경로를 유지합니다.
- 킬피드는 미니맵 아래로 내려 충돌을 줄이고, 확장 지도 상태에서는 전투 화면 침범을 피하도록 숨깁니다.
- 중앙 정산창은 독립 모달 계층으로 유지하며 킬 제한·정산·라운드 재시작 로직은 변경하지 않았습니다.

`;

function patchMain(input:string){let text=insertTopMarker(input,`// ${MARKER}`);
  text=replaceExactly(text,String.raw`    lobby.classList.remove('hidden');
    gameEl.classList.add('hidden');
    renderLobby(s);`,String.raw`    lobby.classList.remove('hidden');
    gameEl.classList.add('hidden');
    gameEl.classList.remove('open-arena-layout','map-open');
    renderLobby(s);`,'main.ts lobby 전환 HUD 클래스 제거');
  text=replaceExactly(text,String.raw`  lobby.classList.add('hidden');
  gameEl.classList.remove('hidden');
  if(!game)createGame();
  const now=performance.now();
  if(now-lastHudAt<100)return;
  lastHudAt=now;
  const me=s.players.find((p)=>p.id===net.sessionId);
  const arena=net.roomConfig.gameMode==='openArena';`,String.raw`  lobby.classList.add('hidden');
  gameEl.classList.remove('hidden');
  const arena=net.roomConfig.gameMode==='openArena';
  gameEl.classList.toggle('open-arena-layout',arena);
  if(!arena)gameEl.classList.remove('map-open');
  if(!game)createGame();
  const now=performance.now();
  if(now-lastHudAt<100)return;
  lastHudAt=now;
  const me=s.players.find((p)=>p.id===net.sessionId);`,'main.ts Open Arena 레이아웃 클래스 부여');
  return text;
}

function patchScene(input:string){let text=insertTopMarker(input,`// ${MARKER}`);
  text=replaceExactly(text,String.raw`    this.keys.M.on('down',()=>{this.mapOpen=!this.mapOpen;this.lastMiniDraw=0;});`,String.raw`    this.keys.M.on('down',()=>{this.mapOpen=!this.mapOpen;this.lastMiniDraw=0;document.getElementById('game')?.classList.toggle('map-open',this.mapOpen);});`,'GameScene.ts 확장 지도 클래스 동기화');
  text=replaceExactly(text,String.raw`      window.removeEventListener('drop8-chat-state',this.chatStateHandler as EventListener);
      for(const overlay of this.playerOverlays.values())overlay.container.destroy(true);`,String.raw`      window.removeEventListener('drop8-chat-state',this.chatStateHandler as EventListener);
      document.getElementById('game')?.classList.remove('map-open');
      for(const overlay of this.playerOverlays.values())overlay.container.destroy(true);`,'GameScene.ts shutdown 지도 클래스 정리');
  text=replaceExactly(text,String.raw`    const visible=(x:number,y:number,m=120)=>x>=view.x-m&&x<=view.right+m&&y>=view.y-m&&y<=view.bottom+m;
    if(s.zoneActive)g.lineStyle(6,0x4db5ff,.72).strokeCircle(s.zoneX,s.zoneY,s.zoneRadius);
    if(s.zoneActive||s.zoneState==='ANNOUNCING')g.lineStyle(3,0xffffff,.36).strokeCircle(s.nextZoneX,s.nextZoneY,s.nextZoneRadius);`,String.raw`    const visible=(x:number,y:number,m=120)=>x>=view.x-m&&x<=view.right+m&&y>=view.y-m&&y<=view.bottom+m;
    const arena=this.net.roomConfig.gameMode==='openArena';
    if(!arena&&s.zoneActive)g.lineStyle(6,0x4db5ff,.72).strokeCircle(s.zoneX,s.zoneY,s.zoneRadius);
    if(!arena&&(s.zoneActive||s.zoneState==='ANNOUNCING'))g.lineStyle(3,0xffffff,.36).strokeCircle(s.nextZoneX,s.nextZoneY,s.nextZoneRadius);`,'GameScene.ts 월드 자기장 원 Open Arena 숨김');
  text=replaceExactly(text,String.raw`  private updateZoneAudio(s:any,time:number){
    const me=this.local();if(!me)return;
    const zoneState=String(s.zoneState??'');if(zoneState!==this.lastZoneState){if(this.lastZoneState&&zoneState==='SHRINKING')audio.playLocal('zone_start');if(zoneState==='ANNOUNCING')audio.playLocal('zone_warning');if(zoneState==='FINAL')audio.playLocal('zone_final');this.lastZoneState=zoneState;this.zoneWarningStage='';}
    if(zoneState==='WAITING'||zoneState==='ANNOUNCING'){
      const timer=Math.ceil(Number(s.zoneTimer??0)),stage=timer<=3?'3':timer<=10?'10':'';
      if(stage&&stage!==this.zoneWarningStage){this.zoneWarningStage=stage;audio.playLocal('zone_warning');}
    }
    const hp=Number(me.hp??0);if(hp<=25&&hp>0&&time-this.lastLowHealthAt>1400){this.lastLowHealthAt=time;audio.playLocal('low_health');}
  }`,String.raw`  private updateZoneAudio(s:any,time:number){
    const me=this.local();if(!me)return;
    const playLowHealth=()=>{const hp=Number(me.hp??0);if(hp<=25&&hp>0&&time-this.lastLowHealthAt>1400){this.lastLowHealthAt=time;audio.playLocal('low_health');}};
    if(this.net.roomConfig.gameMode==='openArena'){this.lastZoneState='';this.zoneWarningStage='';playLowHealth();return;}
    const zoneState=String(s.zoneState??'');if(zoneState!==this.lastZoneState){if(this.lastZoneState&&zoneState==='SHRINKING')audio.playLocal('zone_start');if(zoneState==='ANNOUNCING')audio.playLocal('zone_warning');if(zoneState==='FINAL')audio.playLocal('zone_final');this.lastZoneState=zoneState;this.zoneWarningStage='';}
    if(zoneState==='WAITING'||zoneState==='ANNOUNCING'){
      const timer=Math.ceil(Number(s.zoneTimer??0)),stage=timer<=3?'3':timer<=10?'10':'';
      if(stage&&stage!==this.zoneWarningStage){this.zoneWarningStage=stage;audio.playLocal('zone_warning');}
    }
    playLowHealth();
  }`,'GameScene.ts Open Arena 자기장 오디오 차단');
  text=replaceExactly(text,String.raw`    const w=this.mapOpen?420:160,h=this.mapOpen?420:160,x=this.scale.width-w-14,y=this.mapOpen?70:82,sc=w/this.mapConfig.width;`,String.raw`    const w=this.mapOpen?420:160,h=this.mapOpen?420:160,x=this.scale.width-w-14,y=this.mapOpen?70:82,sc=w/this.mapConfig.width;
    const arena=this.net.roomConfig.gameMode==='openArena';`,'GameScene.ts 미니맵 Open Arena 여부 계산');
  text=replaceExactly(text,String.raw`    if(s.zoneActive)g.lineStyle(2,0x4db5ff,.95).strokeCircle(x+s.zoneX*sc,y+s.zoneY*sc,s.zoneRadius*sc);
    if(s.zoneActive||s.zoneState==='ANNOUNCING')g.lineStyle(2,0xffffff,.72).strokeCircle(x+s.nextZoneX*sc,y+s.nextZoneY*sc,s.nextZoneRadius*sc);`,String.raw`    if(!arena&&s.zoneActive)g.lineStyle(2,0x4db5ff,.95).strokeCircle(x+s.zoneX*sc,y+s.zoneY*sc,s.zoneRadius*sc);
    if(!arena&&(s.zoneActive||s.zoneState==='ANNOUNCING'))g.lineStyle(2,0xffffff,.72).strokeCircle(x+s.nextZoneX*sc,y+s.nextZoneY*sc,s.nextZoneRadius*sc);`,'GameScene.ts 미니맵 자기장 원 Open Arena 숨김');
  text=replaceExactly(text,String.raw`    const direction=zoneDirection(s.nextZoneX-s.zoneX,s.nextZoneY-s.zoneY);`,String.raw`    if(arena){this.miniLabel?.setVisible(false);return;}
    const direction=zoneDirection(s.nextZoneX-s.zoneX,s.nextZoneY-s.zoneY);`,'GameScene.ts 미니맵 안전구역 라벨 Open Arena 숨김');
  return text;
}

function patchCss(input:string){let text=input;if(text.includes(`/* ${MARKER} */`))return text;
  const anchor=String.raw`/* DROP8_REFACTOR_025_OPEN_ARENA_KILL_LIMIT_MATCH_CYCLE */
.arena-round-result{padding:28px;overflow:auto}.arena-round-result h2{margin:0 0 18px}.arena-result-row{display:grid;gap:6px;min-width:min(620px,86vw);padding:12px 16px;margin:8px auto;border:1px solid #ffffff24;border-radius:12px;background:#0c1721}.arena-result-row:first-child{border-color:var(--accent);box-shadow:0 0 24px #ffce4830}.arena-result-row span{color:#b9c6d0}.arena-round-result p{font-size:24px;color:var(--accent);font-weight:800}`;
  return replaceExactly(text,anchor,anchor+CSS_BLOCK,'style.css 025A CSS 블록 삽입');
}
function patchNotes(input:string){if(input.includes(`<!-- ${MARKER} -->`))return input;return NOTES_SECTION+input;}
function patchFile(rel:string,text:string){if(rel==='client/src/main.ts')return patchMain(text);if(rel==='client/src/GameScene.ts')return patchScene(text);if(rel==='client/src/style.css')return patchCss(text);if(rel==='docs/PATCH_NOTES.md')return patchNotes(text);throw new Error(`알 수 없는 수정 파일: ${rel}`);}
function expectedContent(root:string,rel:string){if(rel==='server/tests/refactor025a-open-arena-hud-layout-source.test.ts')return TEST_CONTENT;const original=read(join(root,rel));return patchFile(rel,original);}
function validatePackage(root:string){const pkg=JSON.parse(read(join(root,'package.json')));if(pkg.name!=='drop8-source')throw new Error(`예상 프로젝트가 아닙니다: ${pkg.name??'unknown'}`);}
function validatePriorMarkers(root:string){const main=read(join(root,'client/src/main.ts'));const css=read(join(root,'client/src/style.css'));const notes=read(join(root,'docs/PATCH_NOTES.md'));const room=read(join(root,'server/src/rooms/Drop8Room.ts'));
  if(!main.includes(PRIOR_025)||!main.includes(PRIOR_024E))throw new Error('client/src/main.ts에 Refactor 024E/025 마커가 없습니다. 먼저 최신 Open Arena 체인을 확인하세요.');
  if(!css.includes(PRIOR_024E)||!css.includes(PRIOR_025))throw new Error('client/src/style.css에 Refactor 024E/025 CSS 마커가 없습니다.');
  if(!notes.includes(PRIOR_024E)||!notes.includes(PRIOR_025))throw new Error('docs/PATCH_NOTES.md에 Refactor 024E/025 마커가 없습니다.');
  if(!room.includes(PRIOR_025)||!room.includes(PRIOR_024E))throw new Error('server/src/rooms/Drop8Room.ts에 Refactor 024E/025 마커가 없습니다.');
}
function validateBeforeContexts(root:string){for(const t of TARGETS){const target=join(root,safe(t.path));if(t.mode==='create'){if(existsSync(target))throw new Error(`신규 테스트 파일이 이미 존재합니다: ${t.path}`);continue;}const text=read(target);if(text.includes(MARKER))continue;expectedContent(root,t.path);}}
function appliedStatus(root:string){let applied=0,missing=0;const conflicts:string[]=[];for(const t of TARGETS){const target=join(root,safe(t.path));if(!existsSync(target)){if(t.mode==='create')missing++;else conflicts.push(`${t.path}(파일 누락)`);continue;}const text=read(target);const markerOk=t.marker?text.includes(t.marker):false;if(markerOk){applied++;continue;}missing++;}
  return{applied,missing,conflicts,total:TARGETS.length};
}
function verifyAfter(root:string){for(const t of TARGETS){const target=join(root,safe(t.path));if(!existsSync(target))throw new Error(`적용 후 파일 누락: ${t.path}`);const text=read(target);if(t.marker&&!text.includes(t.marker))throw new Error(`적용 후 마커 누락: ${t.path}`);}const main=read(join(root,'client/src/main.ts'));const scene=read(join(root,'client/src/GameScene.ts'));const css=read(join(root,'client/src/style.css'));const notes=read(join(root,'docs/PATCH_NOTES.md'));const test=read(join(root,'server/tests/refactor025a-open-arena-hud-layout-source.test.ts'));
  for(const needle of ["gameEl.classList.toggle('open-arena-layout',arena)","gameEl.classList.remove('open-arena-layout','map-open')","$('zoneHudItem').classList.toggle('hidden',arena)"])if(!main.includes(needle))throw new Error(`main.ts 검증 실패: ${needle}`);
  for(const needle of ["if(!arena&&s.zoneActive)g.lineStyle(6,0x4db5ff,.72).strokeCircle(s.zoneX,s.zoneY,s.zoneRadius)","if(!arena&&s.zoneActive)g.lineStyle(2,0x4db5ff,.95).strokeCircle(x+s.zoneX*sc,y+s.zoneY*sc,s.zoneRadius*sc)","if(arena){this.miniLabel?.setVisible(false);return;}","if(this.net.roomConfig.gameMode==='openArena'){this.lastZoneState='';this.zoneWarningStage='';playLowHealth();return;}"])if(!scene.includes(needle))throw new Error(`GameScene.ts 검증 실패: ${needle}`);
  for(const needle of ['#game.open-arena-layout #arenaScoreboardPanel','left:14px;right:auto;top:66px','#game.open-arena-layout #zoneHudItem{display:none!important}','#game.open-arena-layout .arena-round-result{z-index:86','#game.open-arena-layout.map-open #killfeed{display:none}'])if(!css.includes(needle))throw new Error(`style.css 검증 실패: ${needle}`);
  if(!notes.includes('Refactor 025A — Open Arena HUD Layout Hotfix'))throw new Error('PATCH_NOTES 025A 섹션 누락');
  if(!test.includes('Refactor 025A Open Arena HUD layout hotfix'))throw new Error('025A 소스 테스트 내용 누락');
}
function backupAndWrite(root:string){const backup=join(root,'patch_backups',BACKUP_NAME,timestamp()),pre=join(backup,'preimage');mkdirSync(pre,{recursive:true});
  const manifest:Manifest={patchId:PATCH_ID,patchFile:PATCH_FILE,createdAt:new Date().toISOString(),projectRoot:root,files:[],createdFiles:[],generatedDirs:[]};
  for(const t of TARGETS){const rel=safe(t.path),target=join(root,rel),existed=existsSync(target);if(existed){const original=readFileSync(target),backupFile=join(pre,rel);mkdirSync(dirname(backupFile),{recursive:true});copyFileSync(target,backupFile);const text=original.toString('utf8');manifest.files.push({path:rel,existed:true,beforeSha256:sha(original),eol:eol(text),bom:hasBom(text)});}else{manifest.files.push({path:rel,existed:false,beforeSha256:'',eol:'LF',bom:false});manifest.createdFiles.push(rel);}}
  for(const rel of ['shared/dist','client/dist','server/build']){const target=join(root,rel),existed=existsSync(target);manifest.generatedDirs.push({path:rel,existed});if(existed){const dest=join(backup,'generated-preimage',rel);mkdirSync(dirname(dest),{recursive:true});cpSync(target,dest,{recursive:true,preserveTimestamps:true});}}
  writeFileSync(join(backup,'manifest.json'),JSON.stringify(manifest,null,2),'utf8');
  for(const t of TARGETS){const rel=safe(t.path),target=join(root,rel);if(t.mode==='create')atomicWrite(target,TEST_CONTENT);else atomicWrite(target,expectedContent(root,rel));}
  return backup;
}
function latestBackup(root:string){const base=join(root,'patch_backups',BACKUP_NAME);if(!existsSync(base))throw new Error(`백업 폴더가 없습니다: ${base}`);const dirs=readdirSync(base).filter((name)=>existsSync(join(base,name,'manifest.json'))).sort().reverse();if(!dirs[0])throw new Error('복원 가능한 백업이 없습니다.');return join(base,dirs[0]);}
function rollback(root:string,arg?:string){const backup=arg?(isAbsolute(arg)?arg:resolve(root,arg)):latestBackup(root),manifestPath=join(backup,'manifest.json');if(!existsSync(manifestPath))throw new Error(`manifest 누락: ${manifestPath}`);const manifest=JSON.parse(read(manifestPath)) as Manifest;if(manifest.patchId!==PATCH_ID)throw new Error(`다른 패치 백업입니다: ${manifest.patchId}`);
  for(const item of [...manifest.files].reverse()){const target=join(root,safe(item.path));if(item.existed){const source=join(backup,'preimage',safe(item.path));if(!existsSync(source))throw new Error(`백업 파일 누락: ${item.path}`);mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);}else rmSync(target,{force:true});}
  for(const dir of manifest.generatedDirs){const target=join(root,safe(dir.path));rmSync(target,{recursive:true,force:true});if(dir.existed){const source=join(backup,'generated-preimage',safe(dir.path));if(existsSync(source))cpSync(source,target,{recursive:true,preserveTimestamps:true});}}
  console.log(`[${PATCH_ID}] 롤백 완료: ${backup}`);
}
function run(label:string,command:string,root:string,log:string){console.log(`\n[${PATCH_ID}] ${label}\n> ${command}`);const result=spawnSync(command,{cwd:root,shell:true,encoding:'utf8',maxBuffer:128*1024*1024,env:process.env});writeFileSync(log,`\n### ${label}\n> ${command}\nexit=${result.status}\n${result.stdout??''}\n${result.stderr??''}\n`,{encoding:'utf8',flag:'a'});if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);if(result.error)throw result.error;if(result.status!==0)throw new Error(`${label} 실패 (exit=${result.status})`);}

const root=findRoot();process.chdir(root);console.log(`[${PATCH_ID}] 프로젝트 루트: ${root}`);
if(rollbackIndex>=0){const arg=args[rollbackIndex+1]&&!args[rollbackIndex+1]!.startsWith('--')?args[rollbackIndex+1]:undefined;rollback(root,arg);process.exit(0);}
validatePackage(root);validatePriorMarkers(root);const status=appliedStatus(root);if(status.conflicts.length)throw new Error(`기준 코드 충돌: ${status.conflicts.join(', ')}`);if(status.applied===status.total){verifyAfter(root);console.log(`[${PATCH_ID}] 이미 정상 적용되어 있습니다.`);process.exit(0);}if(status.applied>0)throw new Error(`부분 적용 상태(${status.applied}/${status.total})입니다. 자동 진행하지 않습니다. --rollback 또는 최신 ZIP 재생성이 필요합니다.`);
validateBeforeContexts(root);
console.log(`[${PATCH_ID}] 직전 단계 확인: ${PRIOR_024E}, ${PRIOR_025}`);
console.log(`[${PATCH_ID}] 변경 예정 파일:`);for(const t of TARGETS)console.log(` - [${t.mode==='create'?'신규':'수정'}] ${t.path} :: ${t.purpose}`);
console.log(`[${PATCH_ID}] Battle Royale 규칙, 자기장 로직, 킬 제한/정산/라운드 재시작 로직은 변경하지 않습니다.`);
console.log(`[${PATCH_ID}] 검증: typecheck → lint → 025A 집중 테스트 → 024E/025 회귀 테스트 → 전체 test → build → git diff --check`);
if(dryRun){console.log(`\n[${PATCH_ID}] dry-run 성공: 실제 파일과 백업을 만들지 않았습니다.`);process.exit(0);}
const backup=backupAndWrite(root),log=join(backup,'verification-log.txt');writeFileSync(log,'','utf8');
try{verifyAfter(root);if(forceFail)throw new Error('DROP8_PATCH_FORCE_FAIL=1 강제 실패');if(!internal){
  run('TypeScript typecheck','pnpm run typecheck',root,log);
  run('ESLint','pnpm run lint',root,log);
  run('Refactor 025A 집중 테스트','pnpm --filter @drop8/server exec vitest run tests/refactor025a-open-arena-hud-layout-source.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --testTimeout=30000 --hookTimeout=30000 --reporter=verbose',root,log);
  run('Refactor 024E/025 회귀 테스트','pnpm --filter @drop8/server exec vitest run tests/refactor024e-arena-scoreboard.test.ts tests/refactor024e-arena-ux-source.test.ts tests/refactor025-open-arena-kill-limit.test.ts tests/refactor025-open-arena-round-source.test.ts tests/refactor025-open-arena-ux-source.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --testTimeout=30000 --hookTimeout=30000 --reporter=verbose',root,log);
  run('전체 테스트','pnpm run test',root,log);
  run('전체 빌드','pnpm run build',root,log);
  const paths=TARGETS.map((t)=>`"${t.path}"`).join(' ');run('대상 git diff check',`git diff --check -- ${paths}`,root,log);
}else console.log(`[${PATCH_ID}] 내부 복제본 검증 모드: pnpm 명령 생략`);
console.log(`\n[${PATCH_ID}] 적용 성공`);console.log(`[${PATCH_ID}] 백업: ${backup}`);console.log(`[${PATCH_ID}] 롤백 CMD: node --experimental-strip-types ${PATCH_FILE} --rollback`);
}catch(error){console.error(`\n[${PATCH_ID}] 검증 실패. 전체 자동 롤백합니다.`);try{rollback(root,backup);}catch(rollbackError){console.error('자동 롤백 오류',rollbackError);}console.error(`[${PATCH_ID}] 백업: ${backup}`);throw error;}
