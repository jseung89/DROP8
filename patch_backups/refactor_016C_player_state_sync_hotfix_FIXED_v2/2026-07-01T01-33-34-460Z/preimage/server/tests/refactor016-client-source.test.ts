// DROP8_REFACTOR_016_SOLO_AI_ITEM_INTERFACE_FIST
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';
const root=resolve(process.cwd(),'..');
const html=readFileSync(resolve(root,'client/index.html'),'utf8');
const main=readFileSync(resolve(root,'client/src/main.ts'),'utf8');
const scene=readFileSync(resolve(root,'client/src/GameScene.ts'),'utf8');
const css=readFileSync(resolve(root,'client/src/style.css'),'utf8');
describe('Refactor 016 client interface source',()=>{
  it('provides one-click solo start with duplicate-click locking',()=>{expect(html).toContain('id="soloBtn"');expect(main).toContain('soloStarting');expect(main).toContain('soloMode:solo');});
  it('provides explicit bandage and medkit selection without chat conflicts',()=>{expect(html).toContain('id="slotBandage"');expect(html).toContain('id="slotMedkit"');expect(scene).toContain("this.keys.Z.on('down'");expect(scene).toContain("this.keys.X.on('down'");expect(scene).toContain("this.net.send('heal')");});
  it('distinguishes dedicated ammunition by class and shape',()=>{for(const value of ['ammo-pistol','ammo-standard','ammo-shotgun','ammo-rocket','ammo-fuel'])expect(css+main).toContain(value);expect(scene).toContain("kind==='rocket_ammo'");expect(scene).toContain("kind==='fuel_ammo'");});
});
