// DROP8_REFACTOR_025_OPEN_ARENA_KILL_LIMIT_MATCH_CYCLE
import { describe,expect,it } from 'vitest';import { readFileSync } from 'node:fs';import { resolve } from 'node:path';
const project=resolve(process.cwd(),'..');
const html=readFileSync(resolve(project,'client/index.html'),'utf8');
const main=readFileSync(resolve(project,'client/src/main.ts'),'utf8');
const network=readFileSync(resolve(project,'client/src/network.ts'),'utf8');
const registry=readFileSync(resolve(process.cwd(),'src/roomRegistry.ts'),'utf8');
describe('Refactor 025 Open Arena UX',()=>{
  it('offers the four limits and renders a human-only result overlay',()=>{
    expect(html).toContain('id="arenaKillLimit"');
    for(const value of ['10','20','30','0'])expect(html).toContain(`value="${value}"`);
    expect(html).toContain('id="arenaRoundResult"');
    expect(main).toContain("arenaRoundResult");
    expect(main).not.toContain("row.ai?' <small>AI</small>'");
  });
  it('carries kill limit and round messages outside the 64-field Schema',()=>{
    expect(network).toContain('killLimit:number');
    expect(network).toContain("'arenaRoundResult','arenaRoundStarted'");
    expect(registry).toContain('killLimit:OpenArenaKillLimit');
    expect(registry).toContain("roundState:'active'|'result'|'resetting'");
  });
});
