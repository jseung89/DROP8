// DROP8_REFACTOR_013H_FIXED_V3_VISIBILITY_ROOF_RIVER_ZONE_SNIPER_AI
// DROP8_REFACTOR_013H_VISIBILITY_ROOF_RIVER_ZONE_SNIPER
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../../client/src/GameScene.ts',import.meta.url),'utf8');

function methodBody(name:string,nextName:string){
  const start=source.indexOf(`  private ${name}`);
  const end=source.indexOf(`  private ${nextName}`,start+1);
  expect(start,`${name} exists`).toBeGreaterThanOrEqual(0);
  expect(end,`${nextName} follows ${name}`).toBeGreaterThan(start);
  return source.slice(start,end);
}

describe('Refactor 013H1 local roof, nested-room and Dock 8 render invariants',()=>{
  it('creates one roof per building and rejects duplicate building ids',()=>{
    const body=methodBody('createBuildingRoofs','updateActivePortal');
    expect(body).toContain('const seen=new Set<string>()');
    expect(body).toContain('Duplicate roof for building');
    expect(body.match(/buildingRoofs\.set\(zone\.id,roof\)/g)).toHaveLength(1);
    expect(body).not.toMatch(/buildingRoofs\.set\([^)]*room/i);
  });

  it('changes existing roof visibility without recreating roofs during room transitions',()=>{
    const body=methodBody('updateBuildingPresentation','fillCanvasPolygon');
    expect(body).toContain('buildingZonesAt');
    expect(body).toContain('containingIds.has');
    expect(body).toContain('roof.setAlpha');
    expect(body).not.toContain('createBuildingRoofs');
    expect(body).not.toContain('this.add.graphics');
  });

  it('restores an indoor world mask, cuts only the current room and opens a directional portal cone',()=>{
    const body=methodBody('updateWindowVisionOverlay','viewerEntity');
    expect(body).toContain("fillStyle='rgba(2,7,11,.80)'");
    expect(body).toContain('cutRectFromVisionOverlay');
    expect(body).toContain('cutViewerFromVisionOverlay');
    expect(body).toContain('angleAwarePortalPolygon');
    expect(body).toContain("'outside'");
    expect(body).not.toContain('this.add.graphics');
  });

  it('uses cross-space openings before room traces for entity visibility',()=>{
    const body=methodBody('worldEntityVisible','spaceVisible');
    expect(body).toContain('crossSpaceOpening');
    expect(body).toContain('traceSpaceVisibility');
    expect(body.indexOf('crossSpaceOpening')).toBeLessThan(body.indexOf('traceSpaceVisibility'));
  });

  it('prefers position-resolved nested space over a stale network room index',()=>{
    const body=methodBody('resolvedViewerSpace','updateBuildingPresentation');
    expect(body).toContain('spaceAt');
    expect(body.indexOf('if(inferred.buildingId)')).toBeLessThan(body.indexOf('if(Boolean(viewer?.isVaulting)'));
  });

  it('joins only Dock 8 river strokes so visual water matches server capsule geometry',()=>{
    expect(source).toContain("if(this.mapConfig.id==='dock8')");
    expect(source).toContain('drawJoinedLayer');
    expect(source).toContain('fillCircle(a.x,a.y,width/2)');
    expect(source).toContain("if(this.mapConfig.id==='dock8')g.fillStyle(0x2b82a8");
  });

});
