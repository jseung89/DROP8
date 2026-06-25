import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isCompositionKey, normalizeChatText, shouldSubmitChatKey } from '../../client/src/chatInput.js';

describe('004C chat input helpers',()=>{
  it('preserves spaces inside Korean chat while trimming the edges',()=>{
    expect(normalizeChatText('  병원에 두 명 있어  ')).toBe('병원에 두 명 있어');
  });

  it('submits Enter exactly once outside IME composition',()=>{
    expect(shouldSubmitChatKey({key:'Enter'},false)).toBe(true);
    expect(shouldSubmitChatKey({key:'Enter',repeat:true},false)).toBe(false);
    expect(shouldSubmitChatKey({key:'Enter',isComposing:true},false)).toBe(false);
    expect(shouldSubmitChatKey({key:'Enter',keyCode:229},false)).toBe(false);
    expect(isCompositionKey({key:'Enter'},true)).toBe(true);
  });
});


describe('Refactor 010 non-blocking game notices',()=>{
  it('contains no browser-blocking alert, confirm, or prompt calls in the game client',()=>{
    const source=readFileSync(new URL('../../client/src/main.ts',import.meta.url),'utf8');
    expect(source).not.toMatch(/(?:window\.)?alert\s*\(/);
    expect(source).not.toMatch(/(?:window\.)?confirm\s*\(/);
    expect(source).not.toMatch(/(?:window\.)?prompt\s*\(/);
    expect(source).toContain('showGameNotice');
  });
});
