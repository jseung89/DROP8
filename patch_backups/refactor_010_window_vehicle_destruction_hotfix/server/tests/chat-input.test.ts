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
