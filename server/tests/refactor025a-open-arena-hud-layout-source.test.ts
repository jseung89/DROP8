// DROP8_REFACTOR_025A_OPEN_ARENA_HUD_LAYOUT_HOTFIX
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
