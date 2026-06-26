import { audioCategoryGain, audioDistanceGain, audioOcclusionProfile, audioStereoPan, type AudioCategory, type AudioSettings, type SoundOcclusion } from '@drop8/shared';

export interface SpatialAudioProfile {
  gain: number;
  pan: number;
  lowpassHz: number;
  audible: boolean;
}

export function spatialAudioProfile(
  listenerX:number,listenerY:number,sourceX:number,sourceY:number,maxDistance:number,
  settings:AudioSettings,category:AudioCategory,occlusion:SoundOcclusion,
):SpatialAudioProfile{
  const distance=Math.hypot(sourceX-listenerX,sourceY-listenerY);
  const distanceGain=audioDistanceGain(distance,maxDistance);
  const obstruction=audioOcclusionProfile(occlusion);
  const gain=distanceGain*obstruction.volume*audioCategoryGain(settings,category);
  return{gain,pan:audioStereoPan(listenerX,sourceX,maxDistance),lowpassHz:obstruction.lowpassHz,audible:gain>.001};
}
