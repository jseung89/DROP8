// DROP8_REFACTOR_017_ADHESIVE_STRIP_LOBBY_BAZOOKA_WATER
import { aggregateVehicleSlowEffects, type VehicleSlowAggregate, type VehicleSlowEffect, type VehicleSlowKind, type VehicleSlowProfile } from '@drop8/shared';

type ApplyOptions={kind:VehicleSlowKind;sourceId:string;profile:VehicleSlowProfile;now:number;maxDurationSeconds?:number;};

export class VehicleStatusManager{
  private effects=new Map<string,Map<VehicleSlowKind,VehicleSlowEffect>>();

  apply(vehicleId:string,options:ApplyOptions){
    let vehicle=this.effects.get(vehicleId);
    if(!vehicle){vehicle=new Map();this.effects.set(vehicleId,vehicle);}
    const existing=vehicle.get(options.kind);
    if(existing){
      existing.sourceId=options.sourceId;
      existing.speedMultiplier=options.profile.speedMultiplier;
      existing.accelerationMultiplier=options.profile.accelerationMultiplier;
      existing.steeringMultiplier=options.profile.steeringMultiplier;
      const cap=existing.maxExpiresAt;
      existing.expiresAt=Math.min(cap,Math.max(existing.expiresAt,options.now+options.profile.durationSeconds));
      return existing;
    }
    const maxDuration=Math.max(options.profile.durationSeconds,options.maxDurationSeconds??options.profile.durationSeconds);
    const effect:VehicleSlowEffect={
      kind:options.kind,sourceId:options.sourceId,
      speedMultiplier:options.profile.speedMultiplier,
      accelerationMultiplier:options.profile.accelerationMultiplier,
      steeringMultiplier:options.profile.steeringMultiplier,
      durationSeconds:options.profile.durationSeconds,
      startedAt:options.now,
      expiresAt:options.now+options.profile.durationSeconds,
      maxExpiresAt:options.now+maxDuration,
    };
    vehicle.set(options.kind,effect);
    return effect;
  }

  aggregate(vehicleId:string,now:number):VehicleSlowAggregate{
    const vehicle=this.effects.get(vehicleId);
    if(!vehicle)return aggregateVehicleSlowEffects([],now);
    for(const [kind,effect] of vehicle)if(effect.expiresAt<=now)vehicle.delete(kind);
    if(!vehicle.size){this.effects.delete(vehicleId);return aggregateVehicleSlowEffects([],now);}
    return aggregateVehicleSlowEffects([...vehicle.values()],now);
  }

  deleteVehicle(vehicleId:string){this.effects.delete(vehicleId);}

  deleteSource(sourceId:string){
    for(const [vehicleId,vehicle] of this.effects){
      for(const [kind,effect] of vehicle)if(effect.sourceId===sourceId)vehicle.delete(kind);
      if(!vehicle.size)this.effects.delete(vehicleId);
    }
  }

  clear(){this.effects.clear();}
}
