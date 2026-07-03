// DROP8_REFACTOR_023_AI_SAFE_ZONE_SWEEP_LIVE_SPECTATOR_DIALOGUE
import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { aiDialogueAudience } from '../src/rooms/aiNavigation.js';

describe('Refactor 023 live spectator dialogue',()=>{
  it('keeps the living-player radius rule while allowing dead spectators',()=>{
    expect(aiDialogueAudience({alive:true,phase:'landed'},200,450)).toBe('player');
    expect(aiDialogueAudience({alive:true,phase:'landed'},700,450)).toBe('none');
    expect(aiDialogueAudience({alive:false,phase:'dead'},5000,450)).toBe('spectator');
    expect(aiDialogueAudience({alive:false,phase:'plane'},10,450)).toBe('none');
    expect(aiDialogueAudience(undefined,10,450)).toBe('none');
  });

  it('sends spectator events without adding off-screen dialogue to the chat log',()=>{
    const source=readFileSync(new URL('../src/rooms/Drop8Room.ts',import.meta.url),'utf8');
    expect(source).toContain("else if(audience==='spectator')client.send('aiDialogue',{...payload,loggable:false});");
    expect(source).toContain("if(audience==='player')client.send('aiDialogue',payload);");
  });

  it('uses duration-based bubbles and removes the old permanent spectator condition',()=>{
    const source=readFileSync(new URL('../../client/src/GameScene.ts',import.meta.url),'utf8');
    expect(source).toContain('const showBubble=visible&&remaining>0;');
    expect(source).not.toContain('spectating&&overlay.bubbleText.text.length>0');
    expect(source).not.toContain('const bubbleAlpha=spectating?1:');
    expect(source).toContain("if(payload.channel==='ai'&&!this.local()?.alive)");
    expect(source).toContain('view.contains(player.x,player.y)');
  });
});
