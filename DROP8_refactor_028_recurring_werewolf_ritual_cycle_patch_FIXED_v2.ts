// DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

type Replacement = [string,string];
type PatchOp = { path:string; replacements:Replacement[] };
type ManifestEntry = { path:string; existed:boolean };

const PATCH_NAME='DROP8 Refactor 028 Recurring Werewolf Ritual Cycle FIXED v2';
const MARKER='DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE';
const PRE_025A='DROP8_REFACTOR_025A_OPEN_ARENA_HUD_LAYOUT_HOTFIX';
const PRE_027='DROP8_REFACTOR_027_OPEN_ARENA_RECURRING_SUPPLY_DROPS';
const BACKUP_ROOT=join('patch_backups','refactor_028_recurring_werewolf_ritual_cycle_FIXED_v2');

const ops:PatchOp[] = [
  {
    "path": "server/src/rooms/openArenaWorld.ts",
    "replacements": [
      [
        "// DROP8_REFACTOR_027_OPEN_ARENA_RECURRING_SUPPLY_DROPS\n",
        "// DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE\n// DROP8_REFACTOR_027_OPEN_ARENA_RECURRING_SUPPLY_DROPS\n"
      ],
      [
        "export const OPEN_ARENA_SUPPLY_DROP_RETRY_SECONDS=15;\nexport const OPEN_ARENA_VEHICLE_RESPAWN_SECONDS=75;",
        "export const OPEN_ARENA_SUPPLY_DROP_RETRY_SECONDS=15;\nexport const OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS=90;\nexport const OPEN_ARENA_RITUAL_WARNING_SECONDS=15;\nexport const OPEN_ARENA_RITUAL_ACTIVE_SECONDS=45;\nexport const OPEN_ARENA_RITUAL_COOLDOWN_SECONDS=120;\nexport const OPEN_ARENA_RITUAL_COMPLETION_SECONDS=5;\nexport const OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE=520;\nexport const OPEN_ARENA_VEHICLE_RESPAWN_SECONDS=75;"
      ]
    ]
  },
  {
    "path": "server/src/rooms/Drop8Room.ts",
    "replacements": [
      [
        "// DROP8_REFACTOR_027_OPEN_ARENA_RECURRING_SUPPLY_DROPS\n",
        "// DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE\n// DROP8_REFACTOR_027_OPEN_ARENA_RECURRING_SUPPLY_DROPS\n"
      ],
      [
        "import { OPEN_ARENA_DROP_TTL_SECONDS, OPEN_ARENA_MAX_ACTIVE_SUPPLY_DROPS, OPEN_ARENA_SUPPLY_DROP_FIRST_DELAY_SECONDS, OPEN_ARENA_SUPPLY_DROP_INTERVAL_SECONDS, OPEN_ARENA_SUPPLY_DROP_RETRY_SECONDS, OPEN_ARENA_VEHICLE_RESPAWN_SECONDS, OPEN_ARENA_WORLD_CLEANUP_INTERVAL_SECONDS, arenaLootRespawnSeconds, type ArenaLootSlot, type ArenaVehicleSlot } from './openArenaWorld.js';",
        "import { OPEN_ARENA_DROP_TTL_SECONDS, OPEN_ARENA_MAX_ACTIVE_SUPPLY_DROPS, OPEN_ARENA_RITUAL_ACTIVE_SECONDS, OPEN_ARENA_RITUAL_COMPLETION_SECONDS, OPEN_ARENA_RITUAL_COOLDOWN_SECONDS, OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS, OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE, OPEN_ARENA_RITUAL_WARNING_SECONDS, OPEN_ARENA_SUPPLY_DROP_FIRST_DELAY_SECONDS, OPEN_ARENA_SUPPLY_DROP_INTERVAL_SECONDS, OPEN_ARENA_SUPPLY_DROP_RETRY_SECONDS, OPEN_ARENA_VEHICLE_RESPAWN_SECONDS, OPEN_ARENA_WORLD_CLEANUP_INTERVAL_SECONDS, arenaLootRespawnSeconds, type ArenaLootSlot, type ArenaVehicleSlot } from './openArenaWorld.js';"
      ],
      [
        "  private openArenaNextSupplyDropAt=0;\n",
        "  private openArenaNextSupplyDropAt=0;\n  private openArenaNextRitualWarningAt=0;\n  private openArenaRitualActiveEndsAt=0;\n  private openArenaLastRitualPoint:Point|null=null;\n"
      ],
      [
        "this.openArenaRoundRows=[];this.openArenaNextSupplyDropAt=0;for(const p of this.state.players.values())",
        "this.openArenaRoundRows=[];this.openArenaNextSupplyDropAt=0;this.openArenaNextRitualWarningAt=0;this.openArenaRitualActiveEndsAt=0;this.openArenaLastRitualPoint=null;for(const p of this.state.players.values())"
      ],
      [
        "this.state.supplySpawned=false;this.state.supplyDropId='';this.openArenaNextSupplyDropAt=this.now()+OPEN_ARENA_SUPPLY_DROP_FIRST_DELAY_SECONDS;",
        "this.state.supplySpawned=false;this.state.supplyDropId='';this.openArenaNextSupplyDropAt=this.now()+OPEN_ARENA_SUPPLY_DROP_FIRST_DELAY_SECONDS;this.openArenaNextRitualWarningAt=this.now()+OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS;this.openArenaRitualActiveEndsAt=0;this.openArenaLastRitualPoint=null;"
      ],
      [
        "this.adhesivePlayerExposure.clear();\n    this.werewolfAuraDamageAt.clear();",
        "this.adhesivePlayerExposure.clear();\n    this.openArenaNextRitualWarningAt=0;\n    this.openArenaRitualActiveEndsAt=0;\n    this.openArenaLastRitualPoint=null;\n    this.werewolfAuraDamageAt.clear();"
      ],
      [
        "  private initializeWerewolfSeason(){\n",
        "  private initializeWerewolfSeason(firstDelaySeconds=WEREWOLF_BALANCE.altarWakeSeconds){\n"
      ],
      [
        "season.enabled=true;season.altarPhase='dormant';season.altarX=selected.altar.x;season.altarY=selected.altar.y;season.altarActivatesAt=this.now()+WEREWOLF_BALANCE.altarWakeSeconds;season.armoryX=selected.armory.x;season.armoryY=selected.armory.y;",
        "season.enabled=true;season.altarPhase='dormant';season.altarX=selected.altar.x;season.altarY=selected.altar.y;season.altarActivatesAt=this.now()+firstDelaySeconds;season.armoryX=selected.armory.x;season.armoryY=selected.armory.y;"
      ],
      [
        "  private initializeWerewolfSeason(firstDelaySeconds=WEREWOLF_BALANCE.altarWakeSeconds){\n    const season=this.state.werewolfSeason;\n    season.enabled=false;season.altarPhase='disabled';season.altarX=0;season.altarY=0;season.altarActivatesAt=0;season.altarReactivateAt=0;season.armoryX=0;season.armoryY=0;season.armoryActive=false;season.armoryOpened=false;season.armoryOpenedBy='';season.curseOwnerId='';season.werewolfPlayerId='';season.curseDropActive=false;season.curseDropX=0;season.curseDropY=0;season.curseDropRemaining=0;season.cycle=0;season.initialNoticeSent=false;season.disabledForEndgame=false;\n    const selected=chooseWerewolfSeasonPoints(this.map.id,this.lootRandom,(point)=>{\n      const space=spaceAt(point.x,point.y,this.map.buildingVisibilityZones,this.map.rooms,0);\n      return seasonPointStructurallyValid(this.map,point,this.terrainKindAt(point.x,point.y),space.outdoors);\n    });\n    if(!selected){console.error('[DROP8 Refactor 018] no valid werewolf season points',this.map.id);return;}\n    season.enabled=true;season.altarPhase='dormant';season.altarX=selected.altar.x;season.altarY=selected.altar.y;season.altarActivatesAt=this.now()+firstDelaySeconds;season.armoryX=selected.armory.x;season.armoryY=selected.armory.y;\n  }\n\n",
        "  private initializeWerewolfSeason(firstDelaySeconds=WEREWOLF_BALANCE.altarWakeSeconds){\n    const season=this.state.werewolfSeason;\n    season.enabled=false;season.altarPhase='disabled';season.altarX=0;season.altarY=0;season.altarActivatesAt=0;season.altarReactivateAt=0;season.armoryX=0;season.armoryY=0;season.armoryActive=false;season.armoryOpened=false;season.armoryOpenedBy='';season.curseOwnerId='';season.werewolfPlayerId='';season.curseDropActive=false;season.curseDropX=0;season.curseDropY=0;season.curseDropRemaining=0;season.cycle=0;season.initialNoticeSent=false;season.disabledForEndgame=false;\n    const selected=chooseWerewolfSeasonPoints(this.map.id,this.lootRandom,(point)=>{\n      const space=spaceAt(point.x,point.y,this.map.buildingVisibilityZones,this.map.rooms,0);\n      return seasonPointStructurallyValid(this.map,point,this.terrainKindAt(point.x,point.y),space.outdoors);\n    });\n    if(!selected){console.error('[DROP8 Refactor 018] no valid werewolf season points',this.map.id);return;}\n    season.enabled=true;season.altarPhase='dormant';season.altarX=selected.altar.x;season.altarY=selected.altar.y;season.altarActivatesAt=this.now()+firstDelaySeconds;season.armoryX=selected.armory.x;season.armoryY=selected.armory.y;\n  }\n\n  private openArenaRitualPositionClear(point:Point){\n    if(this.openArenaLastRitualPoint&&distance(point.x,point.y,this.openArenaLastRitualPoint.x,this.openArenaLastRitualPoint.y)<OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE)return false;\n    for(const drop of this.state.supplyDrops.values())if(!drop.opened&&distance(point.x,point.y,drop.x,drop.y)<OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE)return false;\n    return true;\n  }\n\n  private startOpenArenaRitualWarning(now=this.now()){\n    if(this.gameMode!=='openArena'||this.state.phase!=='ACTIVE'||this.openArenaRoundState!=='active')return false;\n    const selected=chooseWerewolfSeasonPoints(this.map.id,this.lootRandom,(point)=>{\n      const space=spaceAt(point.x,point.y,this.map.buildingVisibilityZones,this.map.rooms,0);\n      return seasonPointStructurallyValid(this.map,point,this.terrainKindAt(point.x,point.y),space.outdoors)&&this.openArenaRitualPositionClear(point);\n    });\n    if(!selected){this.openArenaNextRitualWarningAt=now+OPEN_ARENA_RITUAL_WARNING_SECONDS;return false;}\n    const season=this.state.werewolfSeason;\n    for(const p of this.state.players.values())this.cancelWerewolfRitual(p);\n    season.enabled=true;season.altarPhase='dormant';season.altarX=selected.altar.x;season.altarY=selected.altar.y;season.altarActivatesAt=now+OPEN_ARENA_RITUAL_WARNING_SECONDS;season.altarReactivateAt=0;season.armoryX=selected.armory.x;season.armoryY=selected.armory.y;season.armoryActive=false;season.armoryOpened=false;season.armoryOpenedBy='';season.curseOwnerId='';season.werewolfPlayerId='';season.curseDropActive=false;season.curseDropX=0;season.curseDropY=0;season.curseDropRemaining=0;season.cycle++;season.initialNoticeSent=true;season.disabledForEndgame=false;\n    this.openArenaLastRitualPoint={x:selected.altar.x,y:selected.altar.y};this.openArenaRitualActiveEndsAt=0;this.openArenaNextRitualWarningAt=0;\n    this.system('늑대인간 의식 장소가 드러났습니다. 곧 제단이 깨어납니다.');\n    return true;\n  }\n\n  private endOpenArenaRitualAttempt(message:string){\n    const season=this.state.werewolfSeason;\n    for(const p of this.state.players.values())this.cancelWerewolfRitual(p);\n    season.altarPhase='recharging';season.altarReactivateAt=this.now()+OPEN_ARENA_RITUAL_COOLDOWN_SECONDS;season.armoryActive=false;season.armoryOpened=true;season.curseDropActive=false;this.openArenaRitualActiveEndsAt=0;\n    if(message)this.system(message);\n  }\n\n"
      ],
      [
        "const now=this.now(),w=p.werewolf;w.ritualizing=true;w.ritualStartedAt=now;w.ritualCompletesAt=now+WEREWOLF_BALANCE.ritualSeconds;w.ritualOriginX=p.x;w.ritualOriginY=p.y;\n      c.send('notice',{type:'warning',message:'제단 의식 중... 3초 동안 움직이지 마세요.'});return;",
        "const now=this.now(),w=p.werewolf,ritualSeconds=this.gameMode==='openArena'?OPEN_ARENA_RITUAL_COMPLETION_SECONDS:WEREWOLF_BALANCE.ritualSeconds;w.ritualizing=true;w.ritualStartedAt=now;w.ritualCompletesAt=now+ritualSeconds;w.ritualOriginX=p.x;w.ritualOriginY=p.y;\n      c.send('notice',{type:'warning',message:`제단 의식 중... ${ritualSeconds.toFixed(0)}초 동안 움직이지 마세요.`});return;"
      ],
      [
        "season.curseOwnerId='';season.werewolfPlayerId=p.id;season.altarPhase='claimed';",
        "season.curseOwnerId='';season.werewolfPlayerId=p.id;season.altarPhase='claimed';if(this.gameMode==='openArena')this.openArenaRitualActiveEndsAt=0;"
      ],
      [
        "season.curseOwnerId=p.id;season.altarPhase='claimed';season.curseDropActive=false;",
        "season.curseOwnerId=p.id;season.altarPhase='claimed';season.curseDropActive=false;if(this.gameMode==='openArena')this.openArenaRitualActiveEndsAt=0;"
      ],
      [
        "season.altarPhase='recharging';season.altarReactivateAt=this.now()+WEREWOLF_BALANCE.rechargeSeconds;",
        "season.altarPhase='recharging';season.altarReactivateAt=this.now()+(this.gameMode==='openArena'?OPEN_ARENA_RITUAL_COOLDOWN_SECONDS:WEREWOLF_BALANCE.rechargeSeconds);if(this.gameMode==='openArena'){season.armoryActive=false;season.armoryOpened=true;this.openArenaRitualActiveEndsAt=0;}"
      ],
      [
        "const season=this.state.werewolfSeason;if(!season.enabled)return;const now=this.now();",
        "const season=this.state.werewolfSeason;const now=this.now();\n    if(!season.enabled){if(this.gameMode==='openArena'&&this.state.phase==='ACTIVE'&&this.openArenaRoundState==='active'&&this.openArenaNextRitualWarningAt>0&&now>=this.openArenaNextRitualWarningAt)this.startOpenArenaRitualWarning(now);return;}"
      ],
      [
        "if(season.altarPhase==='dormant'&&now>=season.altarActivatesAt){season.altarPhase='active';season.armoryActive=true;season.initialNoticeSent=true;this.system('늑대인간의 제단이 깨어났습니다.');this.system('누군가가 늑대인간이 될지 모릅니다.');this.system('은빛 사냥 무기가 나타났습니다.');this.emitAudioEvent('werewolf_altar_wake',{x:season.altarX,y:season.altarY,buildingId:'',variant:'werewolf'});this.ensureSilverCountermeasures(true);}",
        "if(season.altarPhase==='dormant'&&now>=season.altarActivatesAt){season.altarPhase='active';season.armoryActive=true;season.initialNoticeSent=true;if(this.gameMode==='openArena')this.openArenaRitualActiveEndsAt=now+OPEN_ARENA_RITUAL_ACTIVE_SECONDS;this.system('늑대인간의 제단이 깨어났습니다.');this.system('누군가가 늑대인간이 될지 모릅니다.');this.system('은빛 사냥 무기가 나타났습니다.');this.emitAudioEvent('werewolf_altar_wake',{x:season.altarX,y:season.altarY,buildingId:'',variant:'werewolf'});this.ensureSilverCountermeasures(true);}"
      ],
      [
        "if(season.altarPhase==='recharging'&&now>=season.altarReactivateAt&&!season.disabledForEndgame){season.altarPhase='active';season.cycle++;this.system('늑대인간의 제단이 다시 깨어났습니다.');this.ensureSilverCountermeasures(false);}",
        "if(season.altarPhase==='recharging'&&now>=season.altarReactivateAt&&!season.disabledForEndgame){if(this.gameMode==='openArena')this.startOpenArenaRitualWarning(now);else{season.altarPhase='active';season.cycle++;this.system('늑대인간의 제단이 다시 깨어났습니다.');this.ensureSilverCountermeasures(false);}}\n    if(this.gameMode==='openArena'&&season.altarPhase==='active'&&!season.curseOwnerId&&!season.werewolfPlayerId&&this.openArenaRitualActiveEndsAt>0&&now>=this.openArenaRitualActiveEndsAt)this.endOpenArenaRitualAttempt('늑대인간 의식이 실패했습니다. 제단이 다시 잠잠해집니다.');"
      ],
      [
        "}else{\n      const season=this.state.werewolfSeason;",
        "}else{\n      if(this.gameMode==='openArena'){this.aiWorldObjectives.delete(p.id);return undefined;}\n      const season=this.state.werewolfSeason;"
      ],
      [
        "const season=this.state.werewolfSeason;\n    if(season.altarPhase==='active'&&!season.curseOwnerId&&!season.werewolfPlayerId){",
        "const season=this.state.werewolfSeason;\n    if(this.gameMode!=='openArena'&&season.altarPhase==='active'&&!season.curseOwnerId&&!season.werewolfPlayerId){"
      ],
      [
        "if(!p.ai||!p.alive||p.phase!=='landed'||p.isDriving",
        "if(this.gameMode==='openArena'||!p.ai||!p.alive||p.phase!=='landed'||p.isDriving"
      ],
      [
        "for(const player of this.state.players.values()){this.cancelHeal(player);this.cancelReload(player);this.cancelThrow(player);player.isSniperScoped=false;}",
        "for(const player of this.state.players.values()){this.cancelHeal(player);this.cancelReload(player);this.cancelThrow(player);player.isSniperScoped=false;}this.disableWerewolfSeason();this.openArenaNextRitualWarningAt=0;this.openArenaRitualActiveEndsAt=0;"
      ],
      [
        "this.openArenaNextSupplyDropAt=this.now()+OPEN_ARENA_SUPPLY_DROP_FIRST_DELAY_SECONDS;\n    let index=0;",
        "this.openArenaNextSupplyDropAt=this.now()+OPEN_ARENA_SUPPLY_DROP_FIRST_DELAY_SECONDS;this.openArenaNextRitualWarningAt=this.now()+OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS;this.openArenaRitualActiveEndsAt=0;this.openArenaLastRitualPoint=null;\n    let index=0;"
      ]
    ]
  },
  {
    "path": "client/src/GameScene.ts",
    "replacements": [
      [
        "// DROP8_REFACTOR_025A_OPEN_ARENA_HUD_LAYOUT_HOTFIX\n",
        "// DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE\n// DROP8_REFACTOR_025A_OPEN_ARENA_HUD_LAYOUT_HOTFIX\n"
      ],
      [
        "this.pickupText.setText('E 유지  늑대의 제단 의식 (3초)').setVisible(true);return;",
        "this.pickupText.setText('E 유지  늑대의 제단 의식').setVisible(true);return;"
      ]
    ]
  },
  {
    "path": "docs/PATCH_NOTES.md",
    "replacements": [
      [
        "<!-- DROP8_REFACTOR_027_OPEN_ARENA_RECURRING_SUPPLY_DROPS -->\n",
        "<!-- DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE -->\n## Refactor 028 — Recurring Werewolf Ritual Cycle\n\n- Open Arena 전용 반복 늑대인간 의식 사이클을 추가했다.\n- 첫 예고 90초, 예고 15초, 활성 45초, 쿨다운 120초 상수로 관리한다.\n- 기존 늑대인간 제단/저주/변신/은빛 무기함 구조를 재사용한다.\n- 인간 플레이어만 Open Arena 반복 의식을 완료할 수 있고 AI는 기존 전투/루팅 행동을 유지한다.\n- Refactor 027 보급상자 기능은 변경하지 않는다.\n- Battle Royale 늑대인간·보급·비행기·자기장·전리품·라운드 로직은 보존한다.\n- 무기 데미지, 발사속도, 이동속도, AI 판단 주기, 서버 Tick, 네트워크 주기는 변경하지 않았다.\n\n<!-- DROP8_REFACTOR_027_OPEN_ARENA_RECURRING_SUPPLY_DROPS -->\n"
      ]
    ]
  },
  {
    "path": "server/tests/refactor027-open-arena-supply-drops-source.test.ts",
    "replacements": [
      [
        "expect(room).toContain('this.openArenaNextSupplyDropAt=0;for(const p of this.state.players.values())');",
        "expect(room).toContain('this.openArenaNextSupplyDropAt=0;this.openArenaNextRitualWarningAt=0;this.openArenaRitualActiveEndsAt=0;this.openArenaLastRitualPoint=null;for(const p of this.state.players.values())');"
      ],
      [
        "  it('documents constants and avoids unrelated 028/029 feature markers',()=>{expect(world).toContain('OPEN_ARENA_SUPPLY_DROP_FIRST_DELAY_SECONDS=60');expect(world).toContain('OPEN_ARENA_MAX_ACTIVE_SUPPLY_DROPS=3');expect(notes).toContain('Refactor 027 — Open Arena Recurring Supply Drops');expect(room).not.toContain('DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE');expect(room).not.toContain('DROP8_REFACTOR_029_ADHESIVE_FIRE_RATE_SUPPRESSION');});",
        "  it('documents constants and avoids unrelated 029 feature markers after later feature patches',()=>{expect(world).toContain('OPEN_ARENA_SUPPLY_DROP_FIRST_DELAY_SECONDS=60');expect(world).toContain('OPEN_ARENA_MAX_ACTIVE_SUPPLY_DROPS=3');expect(notes).toContain('Refactor 027 — Open Arena Recurring Supply Drops');expect(room).not.toContain('DROP8_REFACTOR_029_ADHESIVE_FIRE_RATE_SUPPRESSION');});"
      ]
    ]
  }
];
const newFiles:Record<string,string> = {
  "server/tests/refactor028-recurring-werewolf-ritual-cycle.test.ts": "// DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE\nimport { describe,expect,it } from 'vitest';\nimport { OPEN_ARENA_RITUAL_ACTIVE_SECONDS,OPEN_ARENA_RITUAL_COMPLETION_SECONDS,OPEN_ARENA_RITUAL_COOLDOWN_SECONDS,OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS,OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE,OPEN_ARENA_RITUAL_WARNING_SECONDS } from '../src/rooms/openArenaWorld.js';\n\ndescribe('Refactor 028 Open Arena recurring werewolf ritual constants',()=>{\n  it('keeps the ritual cadence bounded and separate from supply drops',()=>{\n    expect(OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS).toBe(90);\n    expect(OPEN_ARENA_RITUAL_WARNING_SECONDS).toBe(15);\n    expect(OPEN_ARENA_RITUAL_ACTIVE_SECONDS).toBe(45);\n    expect(OPEN_ARENA_RITUAL_COOLDOWN_SECONDS).toBe(120);\n    expect(OPEN_ARENA_RITUAL_COMPLETION_SECONDS).toBe(5);\n    expect(OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE).toBeGreaterThanOrEqual(500);\n  });\n});\n",
  "server/tests/refactor028-werewolf-ritual-source.test.ts": "// DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE\nimport { describe,expect,it } from 'vitest';import { readFileSync } from 'node:fs';import { resolve } from 'node:path';\nconst project=resolve(process.cwd(),'..');\nconst room=readFileSync(resolve(project,'server/src/rooms/Drop8Room.ts'),'utf8');\nconst world=readFileSync(resolve(project,'server/src/rooms/openArenaWorld.ts'),'utf8');\nconst scene=readFileSync(resolve(project,'client/src/GameScene.ts'),'utf8');\nconst notes=readFileSync(resolve(project,'docs/PATCH_NOTES.md'),'utf8');\ndescribe('Refactor 028 recurring werewolf ritual source contract',()=>{\n  it('is chained after 025A and 027 without adding 029',()=>{\n    expect(room).toContain('DROP8_REFACTOR_025_OPEN_ARENA_KILL_LIMIT_MATCH_CYCLE');\n    expect(room).toContain('DROP8_REFACTOR_027_OPEN_ARENA_RECURRING_SUPPLY_DROPS');\n    expect(room).toContain('DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE');\n    expect(room).not.toContain('DROP8_REFACTOR_029_ADHESIVE_FIRE_RATE_SUPPRESSION');\n  });\n  it('uses Open Arena-only ritual timers while preserving Battle Royale werewolf season initialization',()=>{\n    expect(world).toContain('OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS=90');\n    expect(world).toContain('OPEN_ARENA_RITUAL_ACTIVE_SECONDS=45');\n    expect(room).toContain('private openArenaNextRitualWarningAt=0');\n    expect(room).toContain('private startOpenArenaRitualWarning(now=this.now())');\n    expect(room).toContain('this.openArenaNextRitualWarningAt=this.now()+OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS');\n    expect(room).toContain('private initializeWerewolfSeason(firstDelaySeconds=WEREWOLF_BALANCE.altarWakeSeconds)');\n  });\n  it('keeps AI from completing Open Arena rituals and guards supply-drop proximity',()=>{\n    expect(room).toContain(\"if(this.gameMode==='openArena'||!p.ai\");\n    expect(room).toContain('this.openArenaRitualPositionClear(point)');\n    expect(room).toContain('OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE');\n    expect(room).toContain(\"if(this.gameMode!=='openArena'&&season.altarPhase==='active'\");\n  });\n  it('renders the existing altar marker and documents the scope',()=>{\n    expect(scene).toContain('DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE');\n    expect(scene).toContain(\"E 유지  늑대의 제단 의식\");\n    expect(notes).toContain('Refactor 028 — Recurring Werewolf Ritual Cycle');\n    expect(notes).toContain('Refactor 027 보급상자 기능은 변경하지 않는다');\n  });\n});\n"
};
const targetFiles=[...ops.map(op=>op.path),...Object.keys(newFiles)];
const args=new Set(process.argv.slice(2));

function log(message:string){console.log(`[${PATCH_NAME}] ${message}`);}
function die(message:string):never{throw new Error(`[${PATCH_NAME}] ${message}`);}
function findRoot(start:string){let dir=resolve(start);for(let i=0;i<8;i++){if(existsSync(join(dir,'package.json'))&&existsSync(join(dir,'server/src/rooms/Drop8Room.ts'))&&existsSync(join(dir,'client/src/GameScene.ts')))return dir;const next=dirname(dir);if(next===dir)break;dir=next;}die('프로젝트 루트를 찾지 못했습니다. DROP8_SOURCE 루트에서 실행하세요.');}
function readText(root:string,rel:string){return readFileSync(join(root,rel),'utf8').replace(/\r\n/g,'\n');}
function writeText(root:string,rel:string,text:string){const file=join(root,rel);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,text,'utf8');}
function count(haystack:string,needle:string){let n=0,idx=0;while((idx=haystack.indexOf(needle,idx))!==-1){n++;idx+=needle.length||1;}return n;}
function replaceOnce(text:string,from:string,to:string,rel:string){const n=count(text,from);if(n!==1)die(`${rel} 원본 문맥 검증 실패: expected 1, actual ${n} for ${JSON.stringify(from.slice(0,120))}`);return text.replace(from,to);}
function transform(root:string,rel:string){const op=ops.find(item=>item.path===rel);if(!op)die(`알 수 없는 변환 파일: ${rel}`);let text=readText(root,rel);for(const [from,to] of op.replacements)text=replaceOnce(text,from,to,rel);return text;}
function hasAllPrerequisites(root:string){const project=[readText(root,'server/src/rooms/Drop8Room.ts'),readText(root,'client/src/GameScene.ts'),readText(root,'client/src/style.css'),readText(root,'docs/PATCH_NOTES.md')].join('\n');return project.includes(PRE_025A)&&project.includes(PRE_027);}
function isApplied(root:string){try{const room=readText(root,'server/src/rooms/Drop8Room.ts');const world=readText(root,'server/src/rooms/openArenaWorld.ts');const scene=readText(root,'client/src/GameScene.ts');const notes=readText(root,'docs/PATCH_NOTES.md');const t027=readText(root,'server/tests/refactor027-open-arena-supply-drops-source.test.ts');return room.includes(MARKER)&&world.includes(MARKER)&&scene.includes(MARKER)&&notes.includes(MARKER)&&Object.keys(newFiles).every(rel=>existsSync(join(root,rel))&&readText(root,rel).includes(MARKER))&&!t027.includes("not.toContain('DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE')");}catch{return false;}}
function partialApplied(root:string){const signals:string[]=[];for(const rel of targetFiles){if(existsSync(join(root,rel))){const txt=readText(root,rel);if(rel!=='server/tests/refactor027-open-arena-supply-drops-source.test.ts'&&txt.includes(MARKER))signals.push(`${rel} marker`);}}try{const t027=readText(root,'server/tests/refactor027-open-arena-supply-drops-source.test.ts');if(!t027.includes("not.toContain('DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE')"))signals.push('027 source test updated');}catch{}return signals.length>0&&!isApplied(root)?signals:[];}
function verifyPreflight(root:string){if(isApplied(root)){log('이미 적용되어 있습니다.');return 'applied';}if(!hasAllPrerequisites(root))die('선행 패치 마커 확인 실패: Refactor 025A와 Refactor 027 적용 상태가 필요합니다.');const partial=partialApplied(root);if(partial.length)die(`부분 적용 상태 감지: ${partial.join(', ')}. 롤백 또는 최신 ZIP 확인 후 다시 실행하세요.`);for(const op of ops){if(!existsSync(join(root,op.path)))die(`대상 파일 없음: ${op.path}`);let text=readText(root,op.path);for(const [from,to] of op.replacements){const n=count(text,from);if(n!==1)die(`${op.path} 원본 문맥 검증 실패: expected 1, actual ${n} for ${JSON.stringify(from.slice(0,100))}`);text=text.replace(from,to);}}for(const rel of Object.keys(newFiles))if(existsSync(join(root,rel)))die(`신규 파일 충돌: ${rel}`);return 'ready';}
function makeBackup(root:string){const stamp=new Date().toISOString().replace(/[:]/g,'-');const backupDir=join(root,BACKUP_ROOT,stamp);mkdirSync(backupDir,{recursive:true});const entries:ManifestEntry[]=targetFiles.map(path=>({path,existed:existsSync(join(root,path))}));for(const entry of entries){if(!entry.existed)continue;const src=join(root,entry.path),dst=join(backupDir,entry.path);mkdirSync(dirname(dst),{recursive:true});cpSync(src,dst,{recursive:true});}writeFileSync(join(backupDir,'manifest.json'),JSON.stringify({patch:PATCH_NAME,createdAt:stamp,entries},null,2),'utf8');return backupDir;}
function restoreBackup(root:string,backupDir:string){const manifestPath=join(backupDir,'manifest.json');if(!existsSync(manifestPath))die(`manifest 없음: ${manifestPath}`);const manifest=JSON.parse(readFileSync(manifestPath,'utf8')) as {entries:ManifestEntry[]};for(const entry of manifest.entries){const dst=join(root,entry.path);if(entry.existed){const src=join(backupDir,entry.path);mkdirSync(dirname(dst),{recursive:true});cpSync(src,dst,{recursive:true});}else if(existsSync(dst))rmSync(dst,{recursive:true,force:true});}}
function latestBackup(root:string){const dir=join(root,BACKUP_ROOT);if(!existsSync(dir))die('롤백할 백업이 없습니다.');const items=readdirSync(dir).map(name=>join(dir,name)).filter(p=>statSync(p).isDirectory()).sort();const latest=items.at(-1);if(!latest)die('롤백할 백업이 없습니다.');return latest;}
function applyWrites(root:string){for(const op of ops)writeText(root,op.path,transform(root,op.path));for(const [rel,content] of Object.entries(newFiles))writeText(root,rel,content);}
function verifyAppliedIntegrity(root:string){if(!isApplied(root))die('적용 후 마커/파일 무결성 확인 실패');const room=readText(root,'server/src/rooms/Drop8Room.ts');const world=readText(root,'server/src/rooms/openArenaWorld.ts');const scene=readText(root,'client/src/GameScene.ts');const notes=readText(root,'docs/PATCH_NOTES.md');const required=[MARKER,'private startOpenArenaRitualWarning(now=this.now())','OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS','OPEN_ARENA_RITUAL_ACTIVE_SECONDS',"if(this.gameMode==='openArena'||!p.ai","if(this.gameMode!=='openArena'&&season.altarPhase==='active'",'this.openArenaRitualPositionClear(point)'];for(const token of required)if(!(room+world).includes(token))die(`적용 후 필수 토큰 누락: ${token}`);if(!scene.includes('E 유지  늑대의 제단 의식'))die('클라이언트 의식 안내 문구 확인 실패');if(!notes.includes('Refactor 028 — Recurring Werewolf Ritual Cycle'))die('패치 노트 확인 실패');}
function run(command:string,root:string){log(command);execSync(command,{cwd:root,stdio:'inherit',shell:true});}
function runVerification(root:string){if(args.has('--skip-verify')){log('검증 명령을 --skip-verify로 건너뜁니다. 일반 적용에는 권장하지 않습니다.');return;}run('pnpm run typecheck',root);run('pnpm run lint',root);run('pnpm --filter @drop8/server exec vitest run tests/refactor028-recurring-werewolf-ritual-cycle.test.ts tests/refactor028-werewolf-ritual-source.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --testTimeout=30000 --hookTimeout=30000 --reporter=verbose',root);run('pnpm --filter @drop8/server exec vitest run tests/refactor027-open-arena-recurring-supply-drops.test.ts tests/refactor027-open-arena-supply-drops-source.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --testTimeout=30000 --hookTimeout=30000 --reporter=verbose',root);run('pnpm --filter @drop8/server exec vitest run tests/refactor018-werewolf-season.test.ts tests/refactor018-werewolf-combat.test.ts tests/refactor018-werewolf-ritual-transform.test.ts tests/refactor020-werewolf-adhesive-balance.test.ts tests/refactor024a-open-arena-foundation.test.ts tests/refactor024b-open-arena-lifecycle.test.ts tests/refactor024c-open-arena-respawn.test.ts tests/refactor024d-arena-loot.test.ts tests/refactor024e-arena-scoreboard.test.ts tests/refactor025-open-arena-kill-limit.test.ts tests/refactor025-open-arena-round-source.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --testTimeout=30000 --hookTimeout=30000 --reporter=verbose',root);run('pnpm run test',root);run('pnpm run build',root);run(`git diff --check -- ${targetFiles.map(p=>`"${p}"`).join(' ')}`,root);}
function main(){const root=findRoot(process.cwd());log(`프로젝트 루트: ${root}`);if(args.has('--rollback')){const backup=latestBackup(root);restoreBackup(root,backup);log(`롤백 완료: ${backup}`);return;}const state=verifyPreflight(root);if(state==='applied')return;log('변경 예정 파일:');for(const rel of targetFiles)log(`- ${rel}`);if(args.has('--dry-run')){log('dry-run 완료: 실제 파일은 변경하지 않았습니다.');return;}const backup=makeBackup(root);try{applyWrites(root);verifyAppliedIntegrity(root);if(args.has('--force-fail-after-write'))die('강제 실패 테스트');runVerification(root);log('적용 성공');log(`백업: ${backup}`);log(`롤백 CMD: node --experimental-strip-types DROP8_refactor_028_recurring_werewolf_ritual_cycle_patch_FIXED_v2.ts --rollback`);}catch(error){console.error(error);console.error(`[${PATCH_NAME}] 실패: 자동 롤백을 시도합니다.`);restoreBackup(root,backup);console.error(`[${PATCH_NAME}] 자동 롤백 완료: ${backup}`);process.exitCode=1;}}

main();
