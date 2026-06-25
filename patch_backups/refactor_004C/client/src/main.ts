import Phaser from 'phaser';
import { GAME_NAME, MAX_PLAYERS, MELEE_WEAPONS, WEAPONS, type WeaponId } from '@drop8/shared';
import { GameScene } from './GameScene';
import { Network } from './network';
import './style.css';

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const net=new Network();
let game:Phaser.Game|null=null;
let chatting=false;
let lastHudAt=0;
let inventoryOpen=false;
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

async function connect(create:boolean){
  error.textContent='연결 중...';
  try{
    const opts={nickname:nick(),password:password.value,roomPassword:password.value,fillAi:true,difficulty:'normal',zoneSpeed:'normal'};
    if(create)await net.create(opts);
    else await net.join(roomCode.value.trim(),opts);
    home.classList.add('hidden');
    lobby.classList.remove('hidden');
    history.replaceState(null,'',`?room=${net.room?.roomId}`);
    error.textContent='';
    render();
  }catch(e){
    error.textContent=e instanceof Error?e.message:'방 연결 실패';
  }
}

$('createBtn').onclick=()=>void connect(true);
$('joinBtn').onclick=()=>void connect(false);
$('readyBtn').onclick=()=>net.send('ready');
$('startBtn').onclick=()=>net.send('start');
$('copyBtn').onclick=()=>void navigator.clipboard.writeText(location.href);
$('gameCodeText').onclick=()=>{
  const code=net.snapshot?.roomCode;
  if(code)void navigator.clipboard.writeText(`${location.origin}?room=${code}`);
};
$('rematchBtn').onclick=()=>net.send('rematch');
$('fillAi').onchange=sendSettings;
$('difficulty').onchange=sendSettings;
$('zoneSpeed').onchange=sendSettings;

function sendSettings(){
  net.send('settings',{
    fillAi:$<HTMLInputElement>('fillAi').checked,
    difficulty:$<HTMLSelectElement>('difficulty').value,
    zoneSpeed:$<HTMLSelectElement>('zoneSpeed').value,
  });
}

$('lobbyChat').onsubmit=(e)=>{
  e.preventDefault();
  const input=$<HTMLInputElement>('lobbyChatInput');
  net.send('chat',{text:input.value});
  input.value='';
};

$('gameChat').onsubmit=(e)=>{
  e.preventDefault();
  const input=$<HTMLInputElement>('gameChatInput');
  net.send('chat',{text:input.value});
  input.value='';
  toggleChat(false);
};

window.addEventListener('keydown',(e)=>{
  if(e.key==='Enter'&&!lobby.classList.contains('hidden'))return;
  if(e.key==='Enter'&&!gameEl.classList.contains('hidden')){
    e.preventDefault();toggleChat(!chatting);return;
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

function toggleChat(on:boolean){
  chatting=on;
  $('gameChat').classList.toggle('hidden',!on);
  if(on)$<HTMLInputElement>('gameChatInput').focus();
}

net.listeners.add(render);
net.messages.add((type,p)=>{
  if(type==='chat')addMessage(p);
  if(type==='killfeed')addKill(p);
  if(type==='result'){
    $('result').classList.remove('hidden');
    $('resultTitle').textContent=p.winner?`${p.winner} 우승!`:'경기 종료';
    $('resultStats').textContent=(p.placements??[]).map((n:string,i:number)=>`${i+1}위 ${n}`).join(' · ');
  }
  if(type==='error')alert(p);
});

function addMessage(p:any){
  const box=net.snapshot?.phase==='LOBBY'?$('lobbyMessages'):$('gameMessages');
  const d=document.createElement('div');
  d.className=`message ${p.channel==='system'?'system':''}`;
  d.textContent=`[${p.sender}] ${p.text}`;
  box.append(d);
  while(box.children.length>30)box.firstChild?.remove();
  box.scrollTop=box.scrollHeight;
  setTimeout(()=>{if(box.id==='gameMessages')d.remove();},6500);
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
  if(equipped==='pistol'||equipped==='smg')return me?.smallAmmo??0;
  if(equipped==='rifle')return me?.rifleAmmo??0;
  if(equipped==='shotgun')return me?.shells??0;
  return 0;
}

function magazineFor(me:any,id:string){
  if(id==='pistol')return me?.pistolMagazine??0;
  if(id==='smg')return me?.smgMagazine??0;
  if(id==='rifle')return me?.rifleMagazine??0;
  if(id==='shotgun')return me?.shotgunMagazine??0;
  return 0;
}

function weaponName(id:string){return WEAPONS[id as WeaponId]?.name??MELEE_WEAPONS[id as keyof typeof MELEE_WEAPONS]?.name??'비어 있음';}

function setSlot(id:string,name:string,sub:string,active:boolean,empty:boolean){
  const slot=$(id);slot.classList.toggle('active',active);slot.classList.toggle('empty',empty);
  const b=slot.querySelector('b');const small=slot.querySelector('small');if(b)b.textContent=name;if(small)small.textContent=sub;
}

function renderInventory(me:any){
  const primary=me?.primary??'',secondary=me?.secondary??'',melee=me?.melee??'fists',equipped=me?.equipped??'fists';
  setSlot('slotPrimary',weaponName(primary),primary?`${magazineFor(me,primary)} / ${reserveAmmo(me,primary)}발`:'주무기 없음',equipped===primary, !primary);
  setSlot('slotSecondary',weaponName(secondary),secondary?`${magazineFor(me,secondary)} / ${reserveAmmo(me,secondary)}발`:'보조무기 없음',equipped===secondary,!secondary);
  setSlot('slotMelee',weaponName(melee),'근접 무기',equipped===melee||(!melee&&equipped==='fists'),false);
  const missing=Math.max(0,100-(me?.hp??100));
  const autoHeal=(me?.medkits??0)>0&&(missing>25||(me?.bandages??0)<=0)?'구급상자':(me?.bandages??0)>0?'붕대':(me?.medkits??0)>0?'구급상자':'회복 없음';
  setSlot('slotHeal',autoHeal,`붕대 ${me?.bandages??0} · 키트 ${me?.medkits??0}`,false,autoHeal==='회복 없음');
  $('armorText').textContent=String(Math.ceil(me?.armor??0));
  ($('armorBar') as HTMLElement).style.width=`${Math.max(0,Math.min(100,me?.armor??0))}%`;
  const details=[
    ['주무기',primary?`${weaponName(primary)} · ${magazineFor(me,primary)} / ${reserveAmmo(me,primary)}발`:'비어 있음'],
    ['보조무기',secondary?`${weaponName(secondary)} · ${magazineFor(me,secondary)} / ${reserveAmmo(me,secondary)}발`:'비어 있음'],
    ['근접',weaponName(melee)],['소형탄',String(me?.smallAmmo??0)],['소총탄',String(me?.rifleAmmo??0)],['산탄',String(me?.shells??0)],
    ['방탄조끼',`${Math.ceil(me?.armor??0)}%`],['붕대',String(me?.bandages??0)],['구급상자',String(me?.medkits??0)],
  ];
  $('inventoryDetails').innerHTML=details.map(([label,value])=>`<div class="inventory-detail"><b>${label}</b><span>${value}</span></div>`).join('');
}

function render(){
  const s=net.snapshot;
  if(!s)return;
  $('codeText').textContent=`#${s.roomCode}`;
  $('gameCodeText').textContent=`#${s.roomCode}`;
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
  $('zoneText').textContent=String(Math.max(0,Math.ceil(s.zoneTimer)));
  $('hpText').textContent=String(Math.ceil(me?.hp??0));
  renderInventory(me);
  if(me?.healingKind){
    const name=me.healingKind==='medkit'?'구급상자':'붕대';
    $('healText').textContent=`${name} 회복 중 ${Math.round((me.healingProgress??0)*100)}% · 이동/공격 시 취소`;
  }else $('healText').textContent='';
  if(s.phase==='FINISHED')$('result').classList.remove('hidden');
}

function renderLobby(s:any){
  $('result').classList.add('hidden');
  const me=s.players.find((p:any)=>p.id===net.sessionId);
  const slots=$('slots');
  slots.innerHTML='';
  for(let i=0;i<MAX_PLAYERS;i++){
    const p=s.players[i];
    const d=document.createElement('div');
    d.className=`slot ${p?'':'empty'}`;
    d.innerHTML=p
      ?`<span class="badge">${p.host?'방장 · ':''}${p.ai?'AI':'PLAYER'}</span><br><b>${escapeText(p.name)}</b> · ${p.ready?'준비':'대기'}`
      :`빈 슬롯 ${i+1}`;
    slots.append(d);
  }
  $('startBtn').classList.toggle('hidden',!me?.host);
  $('hostSettings').classList.toggle('hidden',!me?.host);
  $<HTMLInputElement>('fillAi').checked=s.fillAi;
  $<HTMLSelectElement>('difficulty').value=s.difficulty;
  $<HTMLSelectElement>('zoneSpeed').value=s.zoneSpeed;
}

function escapeText(v:string){
  const d=document.createElement('div');
  d.textContent=v;
  return d.innerHTML;
}

document.title=GAME_NAME;
