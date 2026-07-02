// DROP8_REFACTOR_014_PLANE_VISIBILITY_BAZOOKA_SLOT_SWAP
import type { SoundId } from './audioTypes';

function tone(context:AudioContext,destination:AudioNode,frequency:number,start:number,duration:number,volume:number,type:OscillatorType='sine',endFrequency?:number){
  const oscillator=context.createOscillator();
  const gain=context.createGain();
  oscillator.type=type;
  oscillator.frequency.setValueAtTime(Math.max(20,frequency),start);
  if(endFrequency&&endFrequency>0)oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),start+duration);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+.004);
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);oscillator.stop(start+duration+.02);
}

function noise(context:AudioContext,destination:AudioNode,buffer:AudioBuffer,start:number,duration:number,volume:number,lowpass=7000,highpass=20){
  const source=context.createBufferSource();source.buffer=buffer;
  const low=context.createBiquadFilter();low.type='lowpass';low.frequency.value=lowpass;
  const high=context.createBiquadFilter();high.type='highpass';high.frequency.value=highpass;
  const gain=context.createGain();
  gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+.003);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  source.connect(high).connect(low).connect(gain).connect(destination);source.start(start);source.stop(start+duration+.02);
}

function chord(context:AudioContext,destination:AudioNode,frequencies:number[],start:number,duration:number,volume:number,type:OscillatorType='sine'){
  frequencies.forEach((frequency,index)=>tone(context,destination,frequency,start+index*.035,duration,volume/Math.max(1,frequencies.length)*1.55,type));
}

export function playSynthSound(context:AudioContext,id:SoundId,destination:AudioNode,noiseBuffer:AudioBuffer,pitch=1){
  const now=context.currentTime+.004;
  const f=(value:number)=>value*pitch;
  switch(id){
    case'ui_click':tone(context,destination,f(720),now,.055,.22,'square',f(540));return .09;
    case'ui_confirm':chord(context,destination,[f(520),f(760)],now,.12,.3,'sine');return .2;
    case'ui_error':tone(context,destination,f(240),now,.18,.34,'sawtooth',f(120));return .22;
    case'chat_send':tone(context,destination,f(620),now,.07,.22,'sine',f(840));return .12;
    case'countdown_tick':tone(context,destination,f(660),now,.1,.32,'square');return .14;
    case'match_start':chord(context,destination,[f(420),f(620),f(900)],now,.28,.56,'triangle');return .48;
    case'victory':chord(context,destination,[f(392),f(523),f(659),f(784)],now,.8,.72,'triangle');return 1.05;
    case'defeat':chord(context,destination,[f(330),f(277),f(220)],now,.68,.62,'sine');return .95;
    case'weapon_pistol_fire':noise(context,destination,noiseBuffer,now,.055,.5,5200,400);tone(context,destination,f(170),now,.09,.5,'square',f(85));return .13;
    case'weapon_smg_fire':noise(context,destination,noiseBuffer,now,.045,.36,6500,600);tone(context,destination,f(210),now,.06,.35,'square',f(110));return .09;
    case'weapon_rifle_fire':noise(context,destination,noiseBuffer,now,.075,.58,5000,250);tone(context,destination,f(135),now,.12,.52,'sawtooth',f(58));return .17;
    case'weapon_shotgun_fire':noise(context,destination,noiseBuffer,now,.18,.85,3600,80);tone(context,destination,f(92),now,.25,.72,'sawtooth',f(35));return .32;
    case'weapon_sniper_fire':noise(context,destination,noiseBuffer,now,.12,.92,4800,80);tone(context,destination,f(118),now,.42,.78,'sawtooth',f(32));return .5;
    case'weapon_bazooka_fire':noise(context,destination,noiseBuffer,now,.24,.88,3200,45);tone(context,destination,f(92),now,.34,.74,'sawtooth',f(28));return .42;
    case'weapon_dry_fire':tone(context,destination,f(920),now,.025,.25,'square',f(610));tone(context,destination,f(430),now+.032,.04,.18,'square');return .09;
    case'reload_start':noise(context,destination,noiseBuffer,now,.055,.2,2400,500);tone(context,destination,f(300),now+.025,.05,.2,'square');return .12;
    case'reload_complete':tone(context,destination,f(340),now,.05,.26,'square');tone(context,destination,f(670),now+.045,.06,.24,'square');return .14;
    case'impact_wall':noise(context,destination,noiseBuffer,now,.07,.38,2400,700);tone(context,destination,f(155),now,.07,.22,'triangle');return .12;
    case'impact_ground':noise(context,destination,noiseBuffer,now,.09,.3,1100,80);return .13;
    case'impact_frame':noise(context,destination,noiseBuffer,now,.08,.4,5200,900);tone(context,destination,f(860),now,.1,.25,'square',f(340));return .15;
    case'impact_vehicle':noise(context,destination,noiseBuffer,now,.11,.55,6000,650);tone(context,destination,f(520),now,.14,.35,'square',f(160));return .19;
    case'impact_player':noise(context,destination,noiseBuffer,now,.055,.32,900,40);tone(context,destination,f(90),now,.08,.25,'sine');return .12;
    case'local_damage':noise(context,destination,noiseBuffer,now,.09,.45,1200,30);tone(context,destination,f(74),now,.16,.32,'sine',f(46));return .2;
    case'low_health':tone(context,destination,f(62),now,.13,.38,'sine',f(48));tone(context,destination,f(52),now+.17,.16,.3,'sine',f(42));return .38;
    case'hit_confirm':tone(context,destination,f(980),now,.045,.25,'sine',f(680));return .08;
    case'kill_confirm':chord(context,destination,[f(740),f(980)],now,.16,.45,'triangle');return .25;
    case'player_death':noise(context,destination,noiseBuffer,now,.18,.5,900,30);tone(context,destination,f(120),now,.45,.44,'sine',f(38));return .52;
    case'footstep_outdoor':noise(context,destination,noiseBuffer,now,.065,.25,700,35);tone(context,destination,f(76),now,.06,.16,'sine');return .1;
    case'footstep_indoor':noise(context,destination,noiseBuffer,now,.045,.23,1700,180);tone(context,destination,f(125),now,.07,.18,'triangle');return .11;
    case'bush_move':noise(context,destination,noiseBuffer,now,.13,.32,6500,1200);return .17;
    case'item_pickup':chord(context,destination,[f(460),f(620)],now,.11,.3,'sine');return .18;
    case'ammo_pickup':tone(context,destination,f(420),now,.045,.22,'square');tone(context,destination,f(520),now+.035,.045,.2,'square');return .11;
    case'weapon_equip':noise(context,destination,noiseBuffer,now,.06,.24,2800,300);tone(context,destination,f(250),now+.025,.08,.26,'square');return .15;
    case'armor_equip':noise(context,destination,noiseBuffer,now,.09,.28,1900,120);tone(context,destination,f(180),now,.12,.3,'triangle');return .17;
    case'heal_start':tone(context,destination,f(420),now,.12,.22,'sine',f(520));return .16;
    case'heal_complete':chord(context,destination,[f(520),f(660),f(840)],now,.22,.36,'sine');return .34;
    case'action_denied':tone(context,destination,f(180),now,.13,.3,'square',f(130));return .17;
    case'window_vault_start':noise(context,destination,noiseBuffer,now,.12,.28,2400,250);return .16;
    case'window_vault_land':noise(context,destination,noiseBuffer,now,.12,.42,900,30);tone(context,destination,f(72),now,.12,.25,'sine');return .18;
    case'motorcycle_mount':tone(context,destination,f(110),now,.16,.35,'sawtooth',f(165));return .2;
    case'motorcycle_collision':noise(context,destination,noiseBuffer,now,.2,.72,4200,80);tone(context,destination,f(72),now,.25,.55,'square',f(35));return .32;
    case'motorcycle_hit':noise(context,destination,noiseBuffer,now,.09,.48,5200,800);tone(context,destination,f(480),now,.12,.24,'square',f(170));return .16;
    case'motorcycle_critical':tone(context,destination,f(145),now,.28,.42,'sawtooth',f(90));noise(context,destination,noiseBuffer,now,.2,.22,1700,70);return .34;
    case'motorcycle_warning':tone(context,destination,f(880),now,.08,.38,'square');return .11;
    case'motorcycle_explosion':noise(context,destination,noiseBuffer,now,.42,1,3200,20);tone(context,destination,f(84),now,.52,.85,'sawtooth',f(24));tone(context,destination,f(430),now+.04,.18,.35,'square',f(110));return .62;
    case'zone_warning':tone(context,destination,f(520),now,.16,.34,'triangle',f(430));tone(context,destination,f(520),now+.22,.16,.3,'triangle',f(430));return .44;
    case'zone_start':tone(context,destination,f(180),now,.42,.48,'sawtooth',f(70));return .48;
    case'zone_damage':noise(context,destination,noiseBuffer,now,.09,.35,1500,180);tone(context,destination,f(250),now,.12,.25,'sawtooth',f(110));return .18;
    case'zone_final':chord(context,destination,[f(82),f(110)],now,.85,.5,'sawtooth');return 1.1;
    case'throwable_select':tone(context,destination,f(360),now,.055,.24,'square');tone(context,destination,f(610),now+.045,.065,.22,'square');return .14;
    case'throwable_prepare':noise(context,destination,noiseBuffer,now,.08,.18,2200,240);tone(context,destination,f(280),now+.025,.09,.2,'triangle',f(350));return .16;
    case'throwable_throw':noise(context,destination,noiseBuffer,now,.11,.34,2700,100);tone(context,destination,f(165),now,.14,.25,'sine',f(90));return .2;
    case'throwable_bounce':noise(context,destination,noiseBuffer,now,.075,.38,3300,420);tone(context,destination,f(410),now,.09,.28,'triangle',f(180));return .14;
    case'frag_explosion':noise(context,destination,noiseBuffer,now,.46,1,3500,18);tone(context,destination,f(96),now,.58,.9,'sawtooth',f(24));tone(context,destination,f(560),now+.025,.14,.34,'square',f(130));return .66;
    case'bazooka_explosion':noise(context,destination,noiseBuffer,now,.52,1,3000,14);tone(context,destination,f(78),now,.66,.95,'sawtooth',f(20));tone(context,destination,f(440),now+.03,.18,.4,'square',f(95));return .74;
    case'smoke_deploy':noise(context,destination,noiseBuffer,now,.55,.7,5200,220);tone(context,destination,f(118),now,.28,.22,'sine',f(72));return .62;
    case'fire_ignite':noise(context,destination,noiseBuffer,now,.34,.74,6800,180);tone(context,destination,f(130),now,.26,.36,'sawtooth',f(64));return .42;
    case'throwable_pickup':chord(context,destination,[f(420),f(590),f(760)],now,.13,.32,'sine');return .22;
    case'throwable_swap':noise(context,destination,noiseBuffer,now,.08,.24,2500,280);chord(context,destination,[f(330),f(510)],now+.04,.12,.28,'square');return .22;
    case'water_enter':noise(context,destination,noiseBuffer,now,.22,.38,4200,150);tone(context,destination,f(150),now,.16,.2,'sine',f(82));return .28;
    case'water_exit':noise(context,destination,noiseBuffer,now,.16,.3,3600,180);tone(context,destination,f(190),now,.12,.16,'sine',f(260));return .22;
    case'water_steam':noise(context,destination,noiseBuffer,now,.3,.35,7200,1200);return .35;
    case'water_extinguish':noise(context,destination,noiseBuffer,now,.28,.46,5000,400);tone(context,destination,f(120),now,.2,.2,'triangle',f(65));return .32;
    case'motorcycle_idle':case'motorcycle_engine':return .1;
  }
}
