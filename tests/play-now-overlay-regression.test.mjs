import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const logoPrefab = JSON.parse(readFileSync(
    new URL('../assets/_Assets/Effects/Prefabs/logo-001.prefab', import.meta.url),
    'utf8',
));
const logoController = readFileSync(
    new URL('../assets/_Scripts/LogoController.ts', import.meta.url),
    'utf8',
);

test('the logo overlay does not show a Play Now button', () => {
    const playNowButton = logoPrefab.find((entry) =>
        entry?.__type__ === 'cc.Node' && entry?._name === 'btnGo',
    );

    assert.ok(playNowButton, 'logo prefab must retain its named CTA node for scene compatibility');
    assert.equal(playNowButton._active, false, 'the Play Now CTA must not be displayed or clickable');
});

test('the logo stays visible from game start', () => {
    assert.match(logoController, /protected onLoad\(\): void \{\s*this\.node\.active = true;/);
    assert.doesNotMatch(logoController, /this\.node\.active = false/);
    assert.doesNotMatch(logoController, /scheduleOnce/);
});
