import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(
    new URL(relativePath, import.meta.url),
    'utf8',
);

const animationSource = read('../assets/_Scripts/HaulerAnimation.ts');
const forestSource = read('../assets/_Scripts/CoinConsumer.ts');
const cornSource = read('../assets/_Scripts/ResourceFieldSystem.ts');
const forestBehaviorSource = read('../assets/_Scripts/HaulerNPC.ts');
const cornBehaviorSource = read('../assets/_Scripts/CornHauler.ts');

test('haulers use one fixed male customer model, texture, and carry animations', () => {
    assert.match(
        animationSource,
        /export function installFixedCustomerHaulerVisual\(root: Node\): SkeletalAnimation \| null/,
    );
    assert.match(animationSource, /appearance\.malePrefab/);
    assert.match(animationSource, /appearance\.maleTextures\[0\]/);
    assert.match(animationSource, /model\.name = 'FixedCustomerHaulerVisual'/);
    assert.match(animationSource, /model\.setPosition\(0,\s*-root\.worldPosition\.y \/ rootScaleY,\s*0\)/);
    assert.match(animationSource, /model\.setRotationFromEuler\(0,\s*appearance\.customerModelYaw,\s*0\)/);
    assert.match(animationSource, /Idle: 'idle'/);
    assert.match(animationSource, /Run: 'walk'/);
    assert.match(animationSource, /CarryIdle: 'idle2_NaHeZi'/);
    assert.match(animationSource, /CarryRun: 'walk_NaHeZi'/);
    assert.doesNotMatch(animationSource, /Math\.random/);
});

test('player fallback haulers remove every player-only vehicle visual before restoration', () => {
    assert.match(animationSource, /'PlayerVisual'/);
    assert.match(animationSource, /'SM_割草机_Player'/);
    assert.match(animationSource, /'SM_大型割草机_Player'/);
    assert.match(animationSource, /for \(const visualName of PlayerOnlyVisualNames\)/);
    assert.match(animationSource, /visual\.setParent\(null\)/);
    assert.match(animationSource, /visual\.destroy\(\)/);
});

test('haulers use normal customer movement while empty and carry movement while loaded', () => {
    for (const source of [forestBehaviorSource, cornBehaviorSource]) {
        assert.match(source, /this\.carryStorage\?\.amount > 0/);
        assert.match(source, /State\.Loading/);
        assert.match(source, /State\.Delivering/);
        assert.match(source, /State\.Unloading/);
        assert.match(
            source,
            /carrying \? HaulerAnimationName\.CarryIdle : HaulerAnimationName\.Idle/,
        );
        assert.match(
            source,
            /carrying \? HaulerAnimationName\.CarryRun : HaulerAnimationName\.Run/,
        );
    }
});

test('forest and corn haulers bind the fixed customer animation without changing behavior components', () => {
    assert.match(forestSource, /behavior\.skeletonAnimation = installFixedCustomerHaulerVisual\(hauler\)!/);
    assert.match(cornSource, /behavior\.skeletonAnimation = installFixedCustomerHaulerVisual\(actor\)!/);
    assert.match(forestSource, /hauler\.getComponent\(HaulerNPC\) \?\? hauler\.addComponent\(HaulerNPC\)/);
    assert.match(cornSource, /actor\.getComponent\(CornHauler\) \?\? actor\.addComponent\(CornHauler\)/);
});

test('forest and corn carried products use the authored customer hand transform', () => {
    for (const source of [forestSource, cornSource]) {
        assert.match(source, /carryNode\.setParent\((?:hauler|actor)\)/);
        assert.match(source, /-0\.199 \/ Math\.max\(Math\.abs\((?:hauler|actor)Scale\.x\), 0\.0001\)/);
        assert.match(source, /\(1\.384 - (?:hauler|actor)\.worldPosition\.y\) \/ Math\.max\(Math\.abs\((?:hauler|actor)Scale\.y\), 0\.0001\)/);
        assert.match(source, /-0\.426 \/ Math\.max\(Math\.abs\((?:hauler|actor)Scale\.z\), 0\.0001\)/);
        assert.match(source, /carryNode\.setRotationFromEuler\(0,\s*-90,\s*0\)/);
        assert.match(source, /carryNode\.setScale\(Vec3\.ONE\)/);
    }
});
