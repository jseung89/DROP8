// DROP8_REFACTOR_021_AI_PERSONA_DIALOGUE
import { describe,expect,it } from 'vitest';
import { createAiMemory,createAiProfile } from '../src/rooms/aiHumanization.js';
import {
  AI_DIALOGUE_PROFILES,
  AI_PERSONA_NAMES,
  aiDialogueProfileForName,
  aiPersonaLineCount,
  selectAiPersonaLine,
  selectAiPersonaResponse,
} from '../src/rooms/aiDialogueProfiles.js';

describe('Refactor 021 fixed AI personas and fast dialogue',()=>{
  it('uses the seven fixed cast names in stable order',()=>{
    expect(AI_PERSONA_NAMES).toEqual(['준희커','대성(빅생)','양정횬','페이커','케리아','윤석10','락승타']);
    expect(AI_PERSONA_NAMES).not.toContain('손흥민');
  });

  it('provides at least 150 persona-specific lines for every AI',()=>{
    for(const name of AI_PERSONA_NAMES){
      const profile=aiDialogueProfileForName(`AI-${name}`);
      expect(profile?.displayName).toBe(name);
      expect(aiPersonaLineCount(name)).toBeGreaterThanOrEqual(150);
      const unique=new Set(Object.values(profile!.dialoguePacks).flat().map((line)=>line.text));
      expect(unique.size).toBeGreaterThanOrEqual(150);
    }
  });

  it('contains the requested signature phrases',()=>{
    const texts=(name:string)=>Object.values(aiDialogueProfileForName(name)!.dialoguePacks).flat().map((line)=>line.text);
    expect(texts('준희커')).toEqual(expect.arrayContaining(['바주카포 재밌다.','스나이퍼 재밌다.','드롭 8 재밌다.','패치 해주세요.','디버그 해주세요.']));
    expect(texts('대성(빅생)')).toEqual(expect.arrayContaining(['안녕하세요 대성입니다.','날봐 날봐 귀순.','그냥 지금 날봐요~~','다 꼼짝마라.','다 꼼짝마.']));
    expect(texts('양정횬')).toEqual(expect.arrayContaining(['난 멋쟁이바지를 입었어.','아 예?','날 매장 시키려고?','소개팅좀.','난 사랑하고 싶어.','EXID 정혀닙니다.']));
    expect(texts('페이커')).toEqual(expect.arrayContaining(['잡았죠?','불 좀 꺼줄래?','피했죠?','음 야미~','증명하세요.']));
    expect(texts('케리아')).toContain('캐리용~');
    expect(texts('윤석10')).toContain('개엄하게 다루겠어.');
    expect(texts('락승타')).toEqual(expect.arrayContaining(['난 락스타가 될꺼야.','샷발 펑키하네.','끼야야야야야앾!','소리질러!!!','락에 잘어울리는 무기군.']));
  });

  it('keeps fixed personality traits while preserving difficulty influence',()=>{
    const rock=createAiProfile('ai-rock','normal','AI-락승타');
    const faker=createAiProfile('ai-faker','normal','AI-페이커');
    expect(rock.personality).toBe(AI_DIALOGUE_PROFILES.rock.traits.personality);
    expect(faker.personality).toBe(AI_DIALOGUE_PROFILES.faker.traits.personality);
    expect(rock.talkativeness).toBeGreaterThan(faker.talkativeness);
    expect(rock.aggression).toBeGreaterThan(faker.aggression);
  });

  it('avoids recent lines and supports fixed nearby response combinations',()=>{
    const first=selectAiPersonaLine('준희커','idle','first');
    expect(first).toBeDefined();
    const second=selectAiPersonaLine('준희커','idle','second',[first!.id]);
    expect(second?.id).not.toBe(first!.id);
    const response=selectAiPersonaResponse('락승타','윤석10','noise-reply');
    expect(response?.text).toBe('고성은 자제하십시오.');
  });

  it('initializes per-match repeat prevention and casual timing memory',()=>{
    const memory=createAiMemory(100,200,'',0,10);
    expect(memory.recentDialogueIds).toEqual([]);
    expect(memory.nextCasualDialogueAt).toBe(0);
    expect(memory.lastDialogueEvent).toBe('');
  });
});
