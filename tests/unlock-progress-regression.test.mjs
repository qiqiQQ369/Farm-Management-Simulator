import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../assets/_Scripts/CoinConsumer.ts', import.meta.url),
    'utf8',
);

test('unlock progress binds its nested UI before the first refresh', () => {
    const onLoad = source.match(
        /protected onLoad\(\): void \{[\s\S]*?\n    \}/,
    )?.[0] ?? '';

    assert.match(onLoad, /this\.bindUnlockUI\(\)/);
    assert.ok(onLoad.indexOf('this.bindUnlockUI()') < onLoad.indexOf('this.updateUI()'));
});

test('unlock progress discovers both legacy and current prefab node names', () => {
    const binding = source.match(
        /private bindUnlockUI\(\): void \{[\s\S]*?\n    \}/,
    )?.[0] ?? '';

    assert.match(binding, /\['ShuZi', 'amount'\]/);
    assert.match(binding, /\['JinDuTiao', 'fill', 'splash2'\]/);
    assert.match(binding, /this\.findFirstNamedSprite/);
});

test('fill progress does not depend on the remaining-label reference', () => {
    const updateUI = source.match(
        /private updateUI\(\): void \{[\s\S]*?\n    \}/,
    )?.[0] ?? '';
    const animation = source.match(
        /private animateRemainingCount\(targetRemaining: number\): void \{[\s\S]*?\n    \}/,
    )?.[0] ?? '';

    assert.match(updateUI, /if \(!currentConfig\) \{\s*return;\s*\}/);
    assert.doesNotMatch(updateUI, /!this\.remainingLabel/);
    assert.match(updateUI, /this\.animateRemainingCount\(remaining\)/);
    assert.doesNotMatch(animation, /!this\.remainingLabel/);
    assert.match(animation, /this\.applyUnlockLevel3FillRange\(/);
});

test('unlock consumption has a distance fallback when trigger events are unavailable', () => {
    const update = source.match(
        /protected update\(deltaTime: number\): void \{[\s\S]*?\n    \}/,
    )?.[0] ?? '';
    const fallback = source.match(
        /private refreshPlayerPresenceByDistance\(\): void \{[\s\S]*?\n    \}/,
    )?.[0] ?? '';

    assert.match(update, /this\.refreshPlayerPresenceByDistance\(\)/);
    assert.match(fallback, /this\.playerCoinBackpack\?\.node/);
    assert.match(fallback, /getChildByName\('pos'\)/);
    assert.match(fallback, /getComponent\(BoxCollider\)/);
    assert.match(fallback, /this\._isPlayerInTrigger \|\| isWithinDistance/);
});

test('every unlock-point variant updates all nested filled sprites', () => {
    const applyFill = source.match(
        /private applyUnlockLevel3FillRange\(fillRange: number\): void \{[\s\S]*?\n    \}/,
    )?.[0] ?? '';

    assert.match(applyFill, /this\.node\.getComponentsInChildren\(Sprite\)/);
    assert.match(applyFill, /sprite\.type === Sprite\.Type\.FILLED/);
    assert.doesNotMatch(applyFill, /this\.node\.name !== 'unlockLevel3'/);
});
