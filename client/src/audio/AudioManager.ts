import { DEFAULT_AUDIO_SETTINGS, audioCategoryGain, audioDistanceGain, audioOcclusionProfile, audioStereoPan, normalizeAudioSettings, type AudioCategory, type AudioSettings } from '@drop8/shared';
import { soundDefinition } from './SoundRegistry';
import { playSynthSound } from './synthSounds';
import type { LoopSoundOptions, SoundId, WorldSoundOptions } from './audioTypes';

type LoopHandle={
  id:string;soundId:SoundId;oscillators:OscillatorNode[];gain:GainNode;panner:StereoPannerNode;filter:BiquadFilterNode;
  baseFrequencies:number[];options:LoopSoundOptions;
};

const SETTINGS_KEY='drop8_audio_settings_v1';

export class Drop8AudioManager{
  private context?:AudioContext;
  private masterGain?:GainNode;
  private globalFilter?:BiquadFilterNode;
  private noiseBuffer?:AudioBuffer;
  private listenerX=0;
  private listenerY=0;
  private unlocked=false;
  private settings:AudioSettings=this.loadSettings();
  private lastPlayedAt=new Map<string,number>();
  private activeVoices=new Map<string,number>();
  private seenEvents=new Map<string,number>();
  private loops=new Map<string,LoopHandle>();
  private loopSeq=0;
  private assetBuffers=new Map<string,AudioBuffer>();
  private assetLoads=new Map<string,Promise<void>>();

  isUnlocked(){return this.unlocked&&this.context?.state==='running';}
  getSettings(){return{...this.settings};}

  async unlock(){
    if(typeof window==='undefined'||typeof AudioContext==='undefined')return false;
    this.context??=new AudioContext();
    if(!this.masterGain){
      this.globalFilter=this.context.createBiquadFilter();this.globalFilter.type='lowpass';this.globalFilter.frequency.value=22000;
      this.masterGain=this.context.createGain();this.globalFilter.connect(this.masterGain).connect(this.context.destination);
      this.noiseBuffer=this.createNoiseBuffer(this.context);
      this.applyMasterGain();
    }
    if(this.context.state==='suspended')await this.context.resume();
    this.unlocked=this.context.state==='running';
    return this.unlocked;
  }

  playUi(soundId:SoundId){this.playLocal(soundId);}
  playLocal(soundId:SoundId,volume=1,eventId=''){this.play(soundId,{volume,eventId});}
  playWorld(soundId:SoundId,options:WorldSoundOptions){this.play(soundId,options);}

  private play(soundId:SoundId,options:Partial<WorldSoundOptions>){
    const context=this.context,master=this.globalFilter,definition=soundDefinition(soundId);
    if(!this.isUnlocked()||!context||!master||!this.noiseBuffer||!definition)return false;
    const now=performance.now();
    if(options.eventId&&this.seen(options.eventId,now))return false;
    const cooldownKey=`${soundId}:${options.sourceId??''}`;
    const cooldown=definition.cooldownMs??0;
    if(now-(this.lastPlayedAt.get(cooldownKey)??-Infinity)<cooldown)return false;
    const voices=this.activeVoices.get(soundId)??0;
    if(voices>=definition.maxVoices)return false;

    let spatialGain=1,pan=0,lowpassHz=22000;
    if(Number.isFinite(options.x)&&Number.isFinite(options.y)){
      const maxDistance=Math.max(1,options.maxDistance??definition.maxDistance);
      const dx=Number(options.x)-this.listenerX,dy=Number(options.y)-this.listenerY;
      const distance=Math.hypot(dx,dy);
      spatialGain=audioDistanceGain(distance,maxDistance);
      if(spatialGain<=.001)return false;
      pan=audioStereoPan(this.listenerX,Number(options.x),maxDistance);
      const profile=audioOcclusionProfile(options.occlusion??'direct');
      spatialGain*=profile.volume;lowpassHz=profile.lowpassHz;
    }
    const category=options.category??definition.category;
    const gainValue=definition.volume*(options.volume??1)*spatialGain*audioCategoryGain(this.settings,category);
    if(gainValue<=.001)return false;

    this.lastPlayedAt.set(cooldownKey,now);
    this.activeVoices.set(soundId,voices+1);
    const gain=context.createGain();gain.gain.value=gainValue;
    const panner=context.createStereoPanner();panner.pan.value=pan;
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=lowpassHz;
    gain.connect(filter).connect(panner).connect(master);

    const asset=definition.assetUrl?this.assetBuffers.get(definition.assetUrl):undefined;
    let duration=.25;
    if(asset){
      const source=context.createBufferSource();source.buffer=asset;source.connect(gain);source.start();duration=asset.duration;
    }else{
      if(definition.assetUrl)void this.loadAsset(definition.assetUrl);
      const pitch=.96+Math.random()*.08;
      duration=playSynthSound(context,soundId,gain,this.noiseBuffer,pitch);
    }
    window.setTimeout(()=>this.activeVoices.set(soundId,Math.max(0,(this.activeVoices.get(soundId)??1)-1)),Math.ceil((duration+.08)*1000));
    return true;
  }

  startLoop(soundId:SoundId,options:LoopSoundOptions){
    const context=this.context,master=this.globalFilter,definition=soundDefinition(soundId);
    if(!this.isUnlocked()||!context||!master||!definition)return'';
    const id=`loop-${++this.loopSeq}`;
    const gain=context.createGain();gain.gain.value=0;
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;
    const panner=context.createStereoPanner();
    gain.connect(filter).connect(panner).connect(master);
    const baseFrequencies=soundId==='motorcycle_idle'?[48,96]:[58,116];
    const oscillators=baseFrequencies.map((frequency,index)=>{
      const oscillator=context.createOscillator();oscillator.type=index===0?'sawtooth':'triangle';oscillator.frequency.value=frequency;oscillator.connect(gain);oscillator.start();return oscillator;
    });
    const handle={id,soundId,oscillators,gain,panner,filter,baseFrequencies,options:{...options}};
    this.loops.set(id,handle);this.updateLoop(id,options);return id;
  }

  updateLoop(handleId:string,updates:Partial<LoopSoundOptions>){
    const handle=this.loops.get(handleId),context=this.context;if(!handle||!context)return;
    Object.assign(handle.options,updates);
    const definition=soundDefinition(handle.soundId),options=handle.options;
    const maxDistance=Math.max(1,options.maxDistance??definition.maxDistance);
    const distance=Math.hypot(options.x-this.listenerX,options.y-this.listenerY);
    const profile=audioOcclusionProfile(options.occlusion??'direct');
    const gain=definition.volume*(options.volume??1)*audioDistanceGain(distance,maxDistance)*profile.volume*audioCategoryGain(this.settings,options.category??definition.category);
    const pitch=Math.max(.35,Math.min(2.2,options.pitch??1));
    const now=context.currentTime;
    handle.gain.gain.setTargetAtTime(gain,now,.045);
    handle.panner.pan.setTargetAtTime(audioStereoPan(this.listenerX,options.x,maxDistance),now,.06);
    handle.filter.frequency.setTargetAtTime(profile.lowpassHz,now,.08);
    handle.oscillators.forEach((oscillator,index)=>oscillator.frequency.setTargetAtTime(handle.baseFrequencies[index]!*pitch,now,.055));
  }

  stopLoop(handleId:string,fadeMs=120){
    const handle=this.loops.get(handleId),context=this.context;if(!handle||!context)return;
    this.loops.delete(handleId);
    const now=context.currentTime,end=now+Math.max(0,fadeMs)/1000;
    handle.gain.gain.cancelScheduledValues(now);handle.gain.gain.setValueAtTime(Math.max(.0001,handle.gain.gain.value),now);handle.gain.gain.exponentialRampToValueAtTime(.0001,Math.max(now+.01,end));
    handle.oscillators.forEach((oscillator)=>{try{oscillator.stop(Math.max(now+.02,end+.02));}catch{/* already stopped */}});
  }

  stopAllLoops(fadeMs=80){for(const id of [...this.loops.keys()])this.stopLoop(id,fadeMs);}
  setListenerPosition(x:number,y:number){this.listenerX=x;this.listenerY=y;}
  setMasterVolume(value:number){this.updateSettings({master:value});}
  setCategoryVolume(category:AudioCategory,value:number){
    if(category==='music')this.updateSettings({music:value});
    else if(category==='movement'||category==='environment')this.updateSettings({environment:value});
    else this.updateSettings({effects:value});
  }
  setMuted(muted:boolean){this.updateSettings({muted});}
  updateSettings(next:Partial<AudioSettings>){this.settings=normalizeAudioSettings({...this.settings,...next});this.saveSettings();this.applyMasterGain();for(const handle of this.loops.values())this.updateLoop(handle.id,{});}
  applyTemporaryMuffle(durationMs=320){
    const context=this.context,filter=this.globalFilter;if(!context||!filter)return;
    const now=context.currentTime;filter.frequency.cancelScheduledValues(now);filter.frequency.setTargetAtTime(780,now,.018);filter.frequency.setTargetAtTime(22000,now+Math.max(100,durationMs)/1000,.09);
  }
  dispose(){this.stopAllLoops(0);if(this.context&&this.context.state!=='closed')void this.context.close();this.context=undefined;this.masterGain=undefined;this.globalFilter=undefined;this.noiseBuffer=undefined;this.unlocked=false;}

  private seen(eventId:string,now:number){
    if(this.seenEvents.has(eventId))return true;
    this.seenEvents.set(eventId,now);
    if(this.seenEvents.size>256){const oldest=[...this.seenEvents.entries()].sort((a,b)=>a[1]-b[1]).slice(0,this.seenEvents.size-220);for(const [id] of oldest)this.seenEvents.delete(id);}
    return false;
  }
  private applyMasterGain(){if(this.masterGain)this.masterGain.gain.value=this.settings.muted?0:this.settings.master;}
  private loadSettings(){
    try{return normalizeAudioSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)??'{}'));}catch{return{...DEFAULT_AUDIO_SETTINGS};}
  }
  private saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(this.settings));}catch{/* storage unavailable */}}
  private createNoiseBuffer(context:AudioContext){
    const length=Math.max(1,Math.floor(context.sampleRate));const buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
    for(let index=0;index<length;index++)data[index]=Math.random()*2-1;
    return buffer;
  }
  private async loadAsset(url:string){
    if(this.assetBuffers.has(url)||this.assetLoads.has(url)||!this.context)return;
    const task=fetch(url).then((response)=>{if(!response.ok)throw new Error(String(response.status));return response.arrayBuffer();}).then((data)=>this.context!.decodeAudioData(data)).then((buffer)=>{this.assetBuffers.set(url,buffer);}).catch(()=>undefined).finally(()=>this.assetLoads.delete(url));
    this.assetLoads.set(url,task);await task;
  }
}
