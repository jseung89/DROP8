// DROP8_REFACTOR_016_SOLO_AI_ITEM_INTERFACE_FIST
// DROP8_REFACTOR_015A_SUPPLY_DROP_FLAMETHROWER
// DROP8_REFACTOR_014_PLANE_VISIBILITY_BAZOOKA_SLOT_SWAP
// DROP8_REFACTOR_013H_FIXED_V3_VISIBILITY_ROOF_RIVER_ZONE_SNIPER_AI
// DROP8_REFACTOR_013H_VISIBILITY_ROOF_RIVER_ZONE_SNIPER
import Phaser from 'phaser';
import { AMMO_PRESENTATION, GAME_NAME, LOOT_LABELS, MAX_PLAYERS, MELEE_WEAPONS, MOTORCYCLE_MAX_SPEED, MOTORCYCLE_SCOPE_SPEED_RATIO, WEAPONS, isThrowableType, type AmmoType, type WeaponId, type ThrowableType } from '@drop8/shared';
import { GameScene } from './GameScene';
import { Network } from './network';
import { normalizeChatText, shouldSubmitChatKey } from './chatInput';
import { audio } from './audio';
import './style.css';
// DROP8_REFACTOR_013_INTERIOR_RIVER_DOCK8

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const net=new Network();
let game:Phaser.Game|null=null;
let chatting=false;
let lastHudAt=0;
let inventoryOpen=false;
let chatComposing=false;
let lobbyChatComposing=false;
let roomListTimer=0;
let pickupToastTimer=0;
let fieldChatCollapsed=localStorage.getItem('drop8-field-chat-collapsed')!=='false';
let fieldChatUnread=0;
let cachedRooms:PublicRoomInfo[]=[];
type GameNoticeType='info'|'warning'|'error';
const noticeLastShown=new Map<string,number>();
const pendingConfirmations=new Map<string,number>();

const audioUnlockHint=document.getElementById('audioUnlockHint');
async function unlockAudio(){if(await audio.unlock())audioUnlockHint?.classList.add('hidden');}
window.addEventListener('pointerdown',()=>void unlockAudio(),{once:true,capture:true});
window.addEventListener('keydown',()=>void unlockAudio(),{once:true,capture:true});
function setupAudioSettings(){
  const master=$<HTMLInputElement>('audioMaster'),effects=$<HTMLInputElement>('audioEffects'),environment=$<HTMLInputElement>('audioEnvironment'),music=$<HTMLInputElement>('audioMusic'),muted=$<HTMLInputElement>('audioMute');
  const settings=audio.getSettings();master.value=String(Math.round(settings.master*100));effects.value=String(Math.round(settings.effects*100));environment.value=String(Math.round(settings.environment*100));music.value=String(Math.round(settings.music*100));muted.checked=settings.muted;
  const apply=()=>{audio.updateSettings({master:Number(master.value)/100,effects:Number(effects.value)/100,environment:Number(environment.value)/100,music:Number(music.value)/100,muted:muted.checked});void unlockAudio();audio.playUi('ui_click');};
  for(const input of [master,effects,environment,music])input.addEventListener('input',apply);muted.addEventListener('change',apply);
}

function showGameNotice(message:unknown,type:GameNoticeType='warning',duration?:number){
  const text=String(message??'').trim();
  if(!text)return;
  if(type==='error')audio.playUi('ui_error');
  const now=performance.now(),key=`${type}:${text}`;
  if(now-(noticeLastShown.get(key)??-9999)<900)return;
  noticeLastShown.set(key,now);
  const container=document.getElementById('gameNotices');
  if(!container)return;
  while(container.children.length>=3)container.firstElementChild?.remove();
  const item=document.createElement('div');
  item.className=`game-notice ${type}`;
  item.textContent=text;
  container.append(item);
  window.setTimeout(()=>{item.classList.add('leaving');window.setTimeout(()=>item.remove(),190);},duration??(type==='error'?2400:1600));
}

function confirmWithoutPopup(key:string,message:string){
  const now=performance.now(),deadline=pendingConfirmations.get(key)??0;
  if(now<=deadline){pendingConfirmations.delete(key);return true;}
  pendingConfirmations.set(key,now+2200);
  showGameNotice(`${message} · 2초 안에 한 번 더 누르세요.`,'warning',2200);
  return false;
}

window.addEventListener('drop8-game-notice',(event)=>{
  const detail=(event as CustomEvent<{message?:unknown;type?:GameNoticeType;duration?:number}>).detail;
  showGameNotice(detail?.message,detail?.type??'warning',detail?.duration);
});
const home=$('home');
const lobby=$('lobby');
const gameEl=$('game');
const error=$('homeError');
const nickname=$<HTMLInputElement>('nickname');
const roomCode=$<HTMLInputElement>('roomCode');
const password=$<HTMLInputElement>('password');

nickname.value=localStorage.getItem('drop8-nick')??'';
roomCode.value=new URLSearchParams(location.search).get('room')??'';

function nick(){
  const n=nickname.value.trim()||`유저${Math.floor(Math.random()*99)+1}`;
  localStorage.setItem('drop8-nick',n);
  return n;
}

let soloStarting=false;
async function connect(create:boolean,solo=false){
  error.textContent='연결 중...';
  try{
    const selectedMap=solo?$<HTMLSelectElement>('soloMap').value:'small';
    const opts={nickname:nick(),password:password.value,roomPassword:password.value,publicRoom:solo?false:$<HTMLInputElement>('publicRoom').checked,fillAi:true,soloMode:solo,difficulty:'normal',zoneSpeed:'normal',mapSizeMode:selectedMap,mapId:selectedMap};
    if(create)await net.create(opts);
    else await net.join(roomCode.value.trim(),opts);
    home.classList.add('hidden');
    lobby.classList.remove('hidden');
    history.replaceState(null,'',`?room=${net.room?.roomId}`);
    error.textContent='';
    stopRoomListPolling();
    audio.playUi('ui_confirm');
    render();
  }catch(e){
    audio.playUi('ui_error');
    error.textContent=e instanceof Error?e.message:'방 연결 실패';
  }finally{
    if(solo){soloStarting=false;const button=$<HTMLButtonElement>('soloBtn');button.disabled=false;button.textContent='솔로 즉시 시작';}
  }
}

$('createBtn').onclick=()=>void connect(true);
$('soloBtn').onclick=()=>{if(soloStarting)return;soloStarting=true;const button=$<HTMLButtonElement>('soloBtn');button.disabled=true;button.textContent='솔로 경기 준비 중...';void connect(true,true);};
$('joinBtn').onclick=()=>void connect(false);
$('refreshRoomsBtn').onclick=()=>void refreshRooms();
$('readyBtn').onclick=()=>net.send('ready');
$('startBtn').onclick=()=>net.send('start');
async function copyInvite(){
  const code=net.snapshot?.roomCode;
  if(!code)return;
  await navigator.clipboard.writeText(`${location.origin}?room=${code}`);
  const toast=$('copyToast');toast.classList.remove('hidden');window.setTimeout(()=>toast.classList.add('hidden'),1400);
}
$('copyBtn').onclick=()=>void copyInvite();
$('gameCodeText').onclick=()=>void copyInvite();
$('fieldRoomBadge').onclick=()=>void copyInvite();
$('rematchBtn').onclick=()=>net.send('rematch');
$('fillAi').onchange=sendSettings;
$('difficulty').onchange=sendSettings;
$('zoneSpeed').onchange=sendSettings;
$('mapSizeMode').onchange=sendSettings;
$('roomMapFilter').onchange=()=>renderRoomList(cachedRooms);

function sendSettings(){
  net.send('settings',{
    fillAi:$<HTMLInputElement>('fillAi').checked,
    difficulty:$<HTMLSelectElement>('difficulty').value,
    zoneSpeed:$<HTMLSelectElement>('zoneSpeed').value,
    mapSizeMode:$<HTMLSelectElement>('mapSizeMode').value,
    mapId:$<HTMLSelectElement>('mapSizeMode').value,
  });
}

const lobbyChatForm=$<HTMLFormElement>('lobbyChat');
const lobbyChatInput=$<HTMLInputElement>('lobbyChatInput');
function submitLobbyChat(){
  const text=normalizeChatText(lobbyChatInput.value);
  if(text){net.send('chat',{text});audio.playUi('chat_send');}
  lobbyChatInput.value='';
}
lobbyChatForm.onsubmit=(event)=>{event.preventDefault();event.stopPropagation();submitLobbyChat();};
lobbyChatInput.addEventListener('compositionstart',()=>{lobbyChatComposing=true;});
lobbyChatInput.addEventListener('compositionend',()=>{lobbyChatComposing=false;});
lobbyChatInput.addEventListener('keydown',(event)=>{
  event.stopPropagation();
  if(shouldSubmitChatKey(event,lobbyChatComposing)){event.preventDefault();submitLobbyChat();return;}
  if(event.key==='Escape'&&!event.repeat){event.preventDefault();lobbyChatInput.value='';lobbyChatInput.blur();}
});
lobbyChatInput.addEventListener('keyup',(event)=>event.stopPropagation());

const gameChatForm=$<HTMLFormElement>('gameChat');
const gameChatInput=$<HTMLInputElement>('gameChatInput');

function dispatchChatState(open:boolean){
  window.dispatchEvent(new CustomEvent('drop8-chat-state',{detail:{open}}));
}

function openChat(){
  if(chatting)return;
  chatting=true;
  setFieldChatCollapsed(false);
  inventoryOpen=false;
  $('inventoryPanel').classList.add('hidden');
  $('quickChat').classList.add('hidden');
  gameChatForm.classList.remove('hidden');
  gameChatInput.value='';
  dispatchChatState(true);
  requestAnimationFrame(()=>gameChatInput.focus());
}

function closeChat(clear=true){
  if(clear)gameChatInput.value='';
  chatting=false;
  chatComposing=false;
  gameChatInput.blur();
  gameChatForm.classList.add('hidden');
  dispatchChatState(false);
}

function submitChat(){
  const text=normalizeChatText(gameChatInput.value);
  if(text){net.send('chat',{text});audio.playUi('chat_send');}
  closeChat();
}

function cancelChat(){closeChat();}

gameChatForm.onsubmit=(e)=>{
  e.preventDefault();
  e.stopPropagation();
  submitChat();
};

gameChatInput.addEventListener('compositionstart',()=>{chatComposing=true;});
gameChatInput.addEventListener('compositionend',()=>{chatComposing=false;});
gameChatInput.addEventListener('keydown',(e)=>{
  e.stopPropagation();
  if(shouldSubmitChatKey(e,chatComposing)){
    e.preventDefault();
    submitChat();
    return;
  }
  if(e.key==='Escape'&&!e.repeat){
    e.preventDefault();
    cancelChat();
  }
});
gameChatInput.addEventListener('keyup',(e)=>e.stopPropagation());

function isEditableTarget(target:EventTarget|null){
  return target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLSelectElement||(target instanceof HTMLElement&&target.isContentEditable);
}

window.addEventListener('keydown',(e)=>{
  if(e.repeat||isEditableTarget(e.target))return;
  if(e.key==='Enter'&&!lobby.classList.contains('hidden')){e.preventDefault();lobbyChatInput.focus();return;}
  if(e.key==='Enter'&&!gameEl.classList.contains('hidden')&&!chatting){
    e.preventDefault();
    openChat();
    return;
  }
  if(e.key==='Tab'&&!gameEl.classList.contains('hidden')&&!chatting){
    e.preventDefault();inventoryOpen=!inventoryOpen;$('inventoryPanel').classList.toggle('hidden',!inventoryOpen);return;
  }
  if((e.key==='t'||e.key==='T')&&!gameEl.classList.contains('hidden')&&!chatting){
    e.preventDefault();$('quickChat').classList.toggle('hidden');
  }
});

for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('#quickChat button'))){
  button.onclick=()=>{
    net.send('chat',{text:button.dataset.msg??''});
    $('quickChat').classList.add('hidden');
  };
}

net.listeners.add(render);
net.messages.add((type,p)=>{
  if(type==='chat')addMessage(p);
  if(type==='killfeed')addKill(p);
  if(type==='result'){
    $('result').classList.remove('hidden');
    $('resultTitle').textContent=p.winner?`${p.winner} 우승!`:'경기 종료';
    $('resultStats').textContent=(p.placements??[]).map((n:string,i:number)=>`${i+1}위 ${n}`).join(' · ');
    const me=net.snapshot?.players.find((player)=>player.id===net.sessionId);audio.playLocal(p.winner&&p.winner===me?.name?'victory':'defeat');
  }
  if(type==='pickupResult')showPickupResult(p);
  if(type==='kicked')void exitRoom(String(p?.message??'방장에 의해 방에서 나갔습니다.'),false);
  if(type==='notice')showGameNotice(p?.message??p,p?.type??'warning',Number(p?.duration)||undefined);
  if(type==='error'){const message=String(p?.message??p??'오류가 발생했습니다.');if(gameEl.classList.contains('hidden')&&lobby.classList.contains('hidden'))error.textContent=message;else showGameNotice(message,'error');}
});

function addMessage(p:any){
  const lobbyChannel=p.channel==='lobby'||(p.channel==='system'&&net.snapshot?.phase==='LOBBY');
  const box=lobbyChannel?$('lobbyMessages'):$('gameMessages');
  const d=document.createElement('div');
  d.className=`message ${p.channel==='system'?'system':''}`;
  const channel=p.channel==='nearby'?'근거리':p.channel==='spectator'?'관전':p.channel==='system'?'시스템':'';
  d.textContent=`${channel?`[${channel}] `:''}${p.sender}: ${p.text}`;
  box.append(d);
  const limit=box.id==='gameMessages'?8:30;
  while(box.children.length>limit)box.firstChild?.remove();
  box.scrollTop=box.scrollHeight;
  if(box.id==='gameMessages'&&fieldChatCollapsed&&!chatting){fieldChatUnread++;updateFieldChatToggle();}
}

function addKill(p:any){
  const d=document.createElement('div');
  d.className='kill';
  d.textContent=`${p.killer} → ${p.victim}`;
  $('killfeed').append(d);
  setTimeout(()=>d.remove(),6000);
}

function createGame(){
  game=new Phaser.Game({
    type:Phaser.WEBGL,
    parent:'gameCanvas',
    width:window.innerWidth,
    height:window.innerHeight,
    backgroundColor:'#153424',
    render:{antialias:false,roundPixels:true,powerPreference:'high-performance'},
    fps:{target:60,smoothStep:true},
    scene:new GameScene(net),
    scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},
  });
}

function reserveAmmo(me:any,equipped:string){
  const ammoType=WEAPONS[equipped as WeaponId]?.ammoType as AmmoType|undefined;
  if(ammoType==='pistol_ammo')return me?.pistolAmmo??0;
  if(ammoType==='standard_ammo')return me?.standardAmmo??0;
  if(ammoType==='shotgun_ammo')return me?.shotgunAmmo??0;
  if(ammoType==='rocket_ammo')return me?.rocketAmmo??0;
  if(ammoType==='fuel_ammo')return me?.fuelAmmo??0;
  return 0;
}
function ammoLabel(equipped:string){const type=WEAPONS[equipped as WeaponId]?.ammoType as Exclude<AmmoType,'none'>|undefined;return type?AMMO_PRESENTATION[type].label:'';}
function ammoTypeForWeapon(equipped:string){return WEAPONS[equipped as WeaponId]?.ammoType as Exclude<AmmoType,'none'>|undefined;}

function magazineFor(me:any,id:string){
  if(id==='pistol')return me?.pistolMagazine??0;
  if(id==='smg')return me?.smgMagazine??0;
  if(id==='rifle')return me?.rifleMagazine??0;
  if(id==='shotgun')return me?.shotgunMagazine??0;
  if(id==='sniper')return me?.sniperMagazine??0;
  if(id==='bazooka')return me?.bazookaMagazine??0;
  if(id==='flamethrower')return me?.flamethrowerMagazine??0;
  return 0;
}

function weaponName(id:string){return WEAPONS[id as WeaponId]?.name??MELEE_WEAPONS[id as keyof typeof MELEE_WEAPONS]?.name??'비어 있음';}

function setSlot(id:string,name:string,sub:string,active:boolean,empty:boolean){
  const slot=$(id);slot.classList.toggle('active',active);slot.classList.toggle('empty',empty);
  const b=slot.querySelector('b');const small=slot.querySelector('small');if(b)b.textContent=name;if(small)small.textContent=sub;
}

let weaponSlotDragFrom=0;
let suppressWeaponSlotClickUntil=0;
const weaponSlotElements=Array.from(document.querySelectorAll<HTMLElement>('.weapon-slot'));
for(const slot of weaponSlotElements){
  const slotNumber=Number(slot.dataset.weaponSlot);
  slot.addEventListener('click',()=>{if(performance.now()<suppressWeaponSlotClickUntil)return;net.send('switch',{slot:slotNumber});slot.blur();});
  slot.addEventListener('keydown',(event)=>{if(event.key==='Enter'){event.preventDefault();net.send('switch',{slot:slotNumber});slot.blur();}});
  slot.addEventListener('dragstart',(event)=>{weaponSlotDragFrom=slotNumber;slot.classList.add('dragging');event.dataTransfer?.setData('text/plain',String(slotNumber));if(event.dataTransfer)event.dataTransfer.effectAllowed='move';});
  slot.addEventListener('dragover',(event)=>{event.preventDefault();if(weaponSlotDragFrom&&weaponSlotDragFrom!==slotNumber)slot.classList.add('drop-target');if(event.dataTransfer)event.dataTransfer.dropEffect='move';});
  slot.addEventListener('dragleave',()=>slot.classList.remove('drop-target'));
  slot.addEventListener('drop',(event)=>{event.preventDefault();const from=Number(event.dataTransfer?.getData('text/plain')||weaponSlotDragFrom);slot.classList.remove('drop-target');if((from===1||from===2)&&from!==slotNumber){net.send('swapWeaponSlots',{from,to:slotNumber});suppressWeaponSlotClickUntil=performance.now()+350;}weaponSlotDragFrom=0;weaponSlotElements.forEach((item)=>item.classList.remove('dragging','drop-target'));});
  slot.addEventListener('dragend',()=>{weaponSlotDragFrom=0;suppressWeaponSlotClickUntil=performance.now()+250;weaponSlotElements.forEach((item)=>item.classList.remove('dragging','drop-target'));});
  slot.addEventListener('contextmenu',(event)=>{event.preventDefault();net.send('dropWeapon',{slot:slotNumber});});
}
for(const slot of Array.from(document.querySelectorAll<HTMLElement>('.heal-slot'))){
  const select=()=>net.send('selectHeal',{kind:slot.dataset.healKind});
  slot.addEventListener('click',select);
  slot.addEventListener('keydown',(event)=>{if(event.key==='Enter'){event.preventDefault();select();slot.blur();}});
}

function renderInventory(me:any){
  const primary=me?.primary??'',secondary=me?.secondary??'',melee=me?.melee??'fists',equipped=me?.equipped??'fists';
  setSlot('slotPrimary',weaponName(primary),primary?`${AMMO_PRESENTATION[ammoTypeForWeapon(primary)!]?.glyph??''} ${magazineFor(me,primary)} / ${reserveAmmo(me,primary)}발 · ${ammoLabel(primary)}`:'주무기 없음',equipped===primary, !primary);
  setSlot('slotSecondary',weaponName(secondary),secondary?`${AMMO_PRESENTATION[ammoTypeForWeapon(secondary)!]?.glyph??''} ${magazineFor(me,secondary)} / ${reserveAmmo(me,secondary)}발 · ${ammoLabel(secondary)}`:'보조무기 없음',equipped===secondary,!secondary);
  for(const [slotId,weaponId] of [['slotPrimary',primary],['slotSecondary',secondary]] as const){const slot=$(slotId);for(const config of Object.values(AMMO_PRESENTATION))slot.classList.remove(config.cssClass);const type=ammoTypeForWeapon(weaponId);if(type)slot.classList.add(AMMO_PRESENTATION[type].cssClass);}
  setSlot('slotMelee',weaponName(melee),'근접 무기',equipped===melee||(!melee&&equipped==='fists'),false);
  for(const [slotId,weaponId] of [['slotPrimary',primary],['slotSecondary',secondary]] as const){
    const slot=$(slotId);const active=Boolean(me?.reloading&&me?.reloadWeapon===weaponId);
    slot.classList.toggle('reloading',active);slot.style.setProperty('--reload-progress',`${Math.round((me?.reloadProgress??0)*100)}%`);
    if(active){const small=slot.querySelector('small');if(small)small.textContent=`재장전 ${Math.round((me.reloadProgress??0)*100)}%`;}
  }
  const selectedHeal=me?.selectedHealKind==='medkit'?'medkit':'bandage';
  const throwable:ThrowableType|''=isThrowableType(me?.throwableType)?me.throwableType:'';
  setSlot('slotThrowable',throwable?LOOT_LABELS[throwable]: '투척물 없음',throwable?`수량 ${me?.throwableCount??0}개`:'파편탄 · 연막탄 · 화염탄',equipped===throwable,!throwable);
  $('bandageCount').textContent=`${me?.bandages??0}개 · 25HP · 2초`;
  $('medkitCount').textContent=`${me?.medkits??0}개 · 60HP · 4초`;
  $('slotBandage').classList.toggle('selected',selectedHeal==='bandage');$('slotBandage').classList.toggle('unavailable',(me?.bandages??0)<=0);
  $('slotMedkit').classList.toggle('selected',selectedHeal==='medkit');$('slotMedkit').classList.toggle('unavailable',(me?.medkits??0)<=0);
  $('armorText').textContent=String(Math.ceil(me?.armor??0));
  ($('armorBar') as HTMLElement).style.width=`${Math.max(0,Math.min(100,me?.armor??0))}%`;
  const details=[
    ['주무기',primary?`${weaponName(primary)} · ${magazineFor(me,primary)} / ${reserveAmmo(me,primary)}발`:'비어 있음'],
    ['보조무기',secondary?`${weaponName(secondary)} · ${magazineFor(me,secondary)} / ${reserveAmmo(me,secondary)}발`:'비어 있음'],
    ['근접',weaponName(melee)],['권총탄',String(me?.pistolAmmo??0)],['일반 총알',String(me?.standardAmmo??0)],['샷건탄',String(me?.shotgunAmmo??0)],['로켓탄',String(me?.rocketAmmo??0)],['연료',String(me?.fuelAmmo??0)],
    ['투척무기',throwable?`${LOOT_LABELS[throwable]} ×${me?.throwableCount??0}`:'비어 있음'],['방탄조끼',`${Math.ceil(me?.armor??0)}%`],['붕대',String(me?.bandages??0)],['구급상자',String(me?.medkits??0)],
  ];
  $('inventoryDetails').innerHTML=details.map(([label,value])=>`<div class="inventory-detail"><b>${label}</b><span>${value}</span></div>`).join('');
}

function render(){
  const s=net.snapshot;
  if(!s)return;
  $('codeText').textContent=`#${s.roomCode}`;
  $('gameCodeText').textContent=`#${s.roomCode}`;
  $('fieldRoomCodeText').textContent=`#${s.roomCode}`;
  if(s.phase==='LOBBY'){
    lobby.classList.remove('hidden');
    gameEl.classList.add('hidden');
    renderLobby(s);
    return;
  }

  lobby.classList.add('hidden');
  gameEl.classList.remove('hidden');
  if(!game)createGame();
  const now=performance.now();
  if(now-lastHudAt<100)return;
  lastHudAt=now;
  const me=s.players.find((p)=>p.id===net.sessionId);
  $('phaseText').textContent=me&&!me.alive?'관전 중 · ← → 대상 변경':s.phase;
  $('aliveText').textContent=String(s.aliveCount);
  $('killsText').textContent=String(me?.kills??0);
  const zoneSeconds=Math.max(0,Math.ceil(s.zoneTimer));
  $('zoneText').textContent=s.zoneState==='FREE'?`없음 · ${zoneSeconds}초`:s.zoneState==='ANNOUNCING'?`예고 · ${zoneSeconds}초`:`${zoneSeconds}초`;
  $('hpText').textContent=String(Math.ceil(me?.hp??0));
  $('mapModeText').textContent=s.mapId==='dock8'||s.mapSizeMode==='dock8'?'8번 부두':s.mapId==='large'||s.mapSizeMode==='large'?'큰 맵':'작은 맵';
  const motorcycle=me?.vehicleId?s.motorcycles.find((item:any)=>item.id===me.vehicleId):undefined;
  const vehicleHud=$('vehicleHud');
  vehicleHud.classList.toggle('hidden',!me?.isDriving||!motorcycle);
  if(me?.isDriving&&motorcycle){
    const ratio=Math.min(1,Math.abs(Number(motorcycle.speed||0))/MOTORCYCLE_MAX_SPEED);
    const stage=ratio<.02?'정지':ratio<.28?'출발':ratio<.58?'가속 중':ratio<.82?'순항':'고속';
    $('vehicleSpeed').textContent=`${stage} · 속도 ${Math.round(ratio*100)}`;
    const hp=Math.max(0,Math.ceil(Number(motorcycle.hp??0))),maxHp=Math.max(1,Math.ceil(Number(motorcycle.maxHp??180)));
    $('vehicleDurability').textContent=`내구도 ${hp} / ${maxHp}`;
    vehicleHud.classList.toggle('critical',Boolean(motorcycle.critical));
    vehicleHud.classList.toggle('exploding',Boolean(motorcycle.exploding));
    const warning=me.equipped==='sniper'&&ratio>MOTORCYCLE_SCOPE_SPEED_RATIO?'속도를 줄이고 이동키를 놓아야 스코프 사용 가능':ratio>.8?'고속 이동 중 · 명중률 크게 감소':ratio>.4?'이동 사격 · 명중률 감소':'WASD · 이동 · E · 내리기';
    $('vehicleWarning').textContent=warning;
  }else{$('vehicleWarning').textContent='';vehicleHud.classList.remove('critical','exploding');}
  gameEl.classList.toggle('scope-active',Boolean(me?.isSniperScoped));
  renderInventory(me);
  if(me?.healingKind){
    const name=me.healingKind==='medkit'?'구급상자':'붕대';
    $('healText').textContent=`${name} 회복 중 ${Math.round((me.healingProgress??0)*100)}% · 이동/공격 시 취소`;
  }else $('healText').textContent='';
  if(me?.reloading){
    $('reloadText').textContent=`${weaponName(me.reloadWeapon)} 재장전 중 ${Math.round((me.reloadProgress??0)*100)}%`;
  }else $('reloadText').textContent='';
  if(s.phase==='FINISHED')$('result').classList.remove('hidden');
}

function renderLobby(s:any){
  $('result').classList.add('hidden');
  const me=s.players.find((p:any)=>p.id===net.sessionId);
  const slots=$('slots');
  slots.innerHTML='';
  for(let i=0;i<MAX_PLAYERS;i++){
    const player=s.players[i];
    const card=document.createElement('div');
    card.className=`slot ${player?'':'empty'}`;
    if(!player){card.textContent=`빈 슬롯 ${i+1}`;slots.append(card);continue;}
    const badge=document.createElement('span');badge.className='badge';badge.textContent=`${player.host?'👑 방장 · ':''}${player.ai?'AI':'PLAYER'}`;
    const name=document.createElement('b');name.textContent=String(player.name??'이름 없음');
    card.append(badge,document.createElement('br'),name,document.createTextNode(` · ${player.ready?'준비':'대기'}`));
    if(me?.host&&!player.ai&&player.id!==me.id){
      const kick=document.createElement('button');kick.type='button';kick.className='kick-button danger';kick.textContent='강퇴';
      kick.onclick=()=>{if(confirmWithoutPopup(`kick:${player.id}`,`${player.name}님을 방에서 내보낼까요?`))net.send('kick',{targetPlayerId:player.id});};
      card.append(kick);
    }
    slots.append(card);
  }
  $('startBtn').classList.toggle('hidden',!me?.host);
  $('hostSettings').classList.toggle('hidden',!me?.host);
  $<HTMLInputElement>('fillAi').checked=s.fillAi;
  $<HTMLSelectElement>('difficulty').value=s.difficulty;
  $<HTMLSelectElement>('zoneSpeed').value=s.zoneSpeed;
  $<HTMLSelectElement>('mapSizeMode').value=s.mapId??s.mapSizeMode??'small';
}

type PublicRoomInfo={roomId:string;roomCode:string;hostName:string;players:number;humans:number;maxPlayers:number;phase:string;fillAi:boolean;publicRoom:boolean;mapSizeMode:'small'|'large'|'dock8';mapDisplayName:string};

async function refreshRooms(){
  if(home.classList.contains('hidden'))return;
  const list=$('roomList');
  try{
    const response=await fetch('/api/rooms',{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json() as {rooms?:PublicRoomInfo[]};
    cachedRooms=data.rooms??[];renderRoomList(cachedRooms);
  }catch{
    if(!list.children.length)list.innerHTML='<p class="empty-note">방 목록을 불러오지 못했습니다.</p>';
  }
}

function renderRoomList(rooms:PublicRoomInfo[]){
  const filter=$<HTMLSelectElement>('roomMapFilter').value;
  const filtered=filter==='all'?rooms:rooms.filter((room)=>room.mapSizeMode===filter);
  const list=$('roomList');list.innerHTML='';
  if(!filtered.length){list.innerHTML='<p class="empty-note">현재 공개 대기방이 없습니다.</p>';return;}
  for(const room of filtered){
    const row=document.createElement('div');row.className='room-row';
    const info=document.createElement('div');
    const status=room.phase==='LOBBY'?(room.players>=room.maxPlayers?'인원 가득 참':'대기 중'):room.phase==='FINISHED'?'종료 중':'게임 중';
    info.innerHTML=`<b>#${escapeText(room.roomCode)}</b><span>${escapeText(room.hostName)} · ${room.players}/${room.maxPlayers} · ${escapeText(room.mapDisplayName||'작은 맵')} · ${status}${room.fillAi?' · AI':''}</span>`;
    const join=document.createElement('button');join.type='button';join.textContent='참가';
    join.disabled=room.phase!=='LOBBY'||room.players>=room.maxPlayers;
    join.onclick=()=>{roomCode.value=room.roomCode;void connect(false);};
    row.append(info,join);list.append(row);
  }
}

function startRoomListPolling(){
  window.clearInterval(roomListTimer);
  void refreshRooms();
  roomListTimer=window.setInterval(()=>void refreshRooms(),2500);
}
function stopRoomListPolling(){window.clearInterval(roomListTimer);roomListTimer=0;}

function setFieldChatCollapsed(collapsed:boolean){
  fieldChatCollapsed=collapsed;
  localStorage.setItem('drop8-field-chat-collapsed',String(collapsed));
  $('fieldChatPanel').classList.toggle('collapsed',collapsed);
  if(!collapsed)fieldChatUnread=0;
  updateFieldChatToggle();
}
function updateFieldChatToggle(){
  const button=$<HTMLButtonElement>('toggleFieldChat');
  button.firstChild!.textContent=fieldChatCollapsed?'▲ ':'▼ ';
  const unread=$('chatUnread');unread.textContent=String(fieldChatUnread);unread.classList.toggle('hidden',fieldChatUnread<=0);
}
$('toggleFieldChat').onclick=()=>setFieldChatCollapsed(!fieldChatCollapsed);
setFieldChatCollapsed(fieldChatCollapsed);

async function exitRoom(message='',ask=false){
  if(ask&&net.snapshot?.phase!=='LOBBY'&&!confirmWithoutPopup('leave-game','진행 중인 게임에서 나가면 현재 캐릭터가 탈락합니다.'))return;
  closeChat();
  inventoryOpen=false;
  $('inventoryPanel').classList.add('hidden');
  audio.stopAllLoops(80);
  await net.leave(true);
  game?.destroy(true);game=null;
  lobby.classList.add('hidden');gameEl.classList.add('hidden');home.classList.remove('hidden');
  $('result').classList.add('hidden');$('scopeOverlay').classList.add('hidden');$('vehicleHud').classList.add('hidden');gameEl.classList.remove('scope-active');$('lobbyMessages').innerHTML='';$('gameMessages').innerHTML='';$('killfeed').innerHTML='';
  history.replaceState(null,'',location.pathname);
  error.textContent=message;
  startRoomListPolling();
}
$('leaveLobbyBtn').onclick=()=>void exitRoom('',false);
$('leaveGameBtn').onclick=()=>void exitRoom('',true);

function showPickupResult(payload:any){
  const kind=String(payload?.kind??'');
  if(kind.includes('ammo'))audio.playUi('ammo_pickup');else if(kind==='vest')audio.playUi('armor_equip');else if(kind in WEAPONS||kind in MELEE_WEAPONS)audio.playUi(payload?.autoEquipped?'weapon_equip':'item_pickup');else audio.playUi('item_pickup');
  if(!payload?.autoEquipped)return;
  const label=weaponName(kind);
  const droppedKind=String(payload?.droppedKind??'');
  const droppedText=droppedKind?` · ${weaponName(droppedKind)} 바닥에 드롭`:'';
  const toast=$('pickupToast');toast.textContent=`${label} 획득 · 즉시 장착${droppedText}`;
  toast.classList.remove('hidden');
  window.clearTimeout(pickupToastTimer);
  pickupToastTimer=window.setTimeout(()=>toast.classList.add('hidden'),1600);
  const me=net.snapshot?.players.find((player)=>player.id===net.sessionId);
  const slot=me?.primary===kind?'slotPrimary':me?.secondary===kind?'slotSecondary':'slotMelee';
  const element=$(slot);element.classList.remove('pickup-flash');void element.offsetWidth;element.classList.add('pickup-flash');
  window.setTimeout(()=>element.classList.remove('pickup-flash'),520);
}

function escapeText(v:string){
  const d=document.createElement('div');
  d.textContent=v;
  return d.innerHTML;
}

setupAudioSettings();
document.addEventListener('click',(event)=>{const target=event.target;if(target instanceof HTMLButtonElement){void unlockAudio();audio.playUi('ui_click');}},true);
startRoomListPolling();
document.title=GAME_NAME;
