import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const joystickPath = new URL('../assets/_Scripts/JoystickController.ts', import.meta.url);
const mainUIPath = new URL('../assets/_Scripts/MainUI.ts', import.meta.url);
const devScenePath = new URL('../assets/Scenes/DevScene.scene', import.meta.url);
const hintPrefabPath = new URL(
    '../assets/_Assets/Effects/Prefabs/moveHit-001.prefab',
    import.meta.url,
);

test('JoystickController owns the MNJY-style hint lifecycle', async () => {
    const [joystick, mainUI, devSceneSource] = await Promise.all([
        readFile(joystickPath, 'utf8'),
        readFile(mainUIPath, 'utf8'),
        readFile(devScenePath, 'utf8'),
    ]);
    const joystickSceneComponent = JSON.parse(devSceneSource).find(
        (entry) => entry.joystickRadius === 110 && 'delayShowHintTime' in entry,
    );

    assert.match(joystick, /public hintNode: Node = null!/);
    assert.match(joystick, /public delayShowHintTime: number = 3/);
    assert.match(joystick, /public hintJoystickOffsetY: number = 30/);
    assert.equal(joystickSceneComponent.hintJoystickOffsetY, 30);
    assert.match(joystick, /onLoad\(\)[\s\S]*this\.setHintVisible\(false\)[\s\S]*this\.delayShowHint\(\)/);
    assert.match(joystick, /onTouchStart[\s\S]*this\.setHintVisible\(false\)/);
    assert.match(joystick, /onTouchEnd[\s\S]*this\.delayShowHint\(\)/);
    assert.match(joystick, /public setHintEnabled\(enabled: boolean\): void/);
    assert.match(joystick, /private hideJoystick\(\): void \{[\s\S]*this\.joystickBg\.active = false;[\s\S]*this\.joystickHandle\.active = false;/);
    assert.match(joystick, /private showHintJoystick\(\): void \{[\s\S]*this\.joystickBg\.active = true;[\s\S]*this\.joystickHandle\.active = true;/);
    assert.match(joystick, /private showHintJoystick\(\): void \{[\s\S]*getComponent\(Widget\)\?\.updateAlignment\(\)[\s\S]*hintAnchor\.updateWorldTransform\(\)/);
    assert.match(joystick, /convertToNodeSpaceAR\(hintAnchor\.worldPosition, localPos\);[\s\S]*localPos\.y \+= this\.hintJoystickOffsetY;/);
    assert.match(joystick, /private startHintAnimation\(\): void \{[\s\S]*tween\(this\.joystickHandle\)[\s\S]*repeatForever/);
    assert.match(joystick, /private stopHintAnimation\(\): void \{[\s\S]*this\._hintTween\?\.stop\(\)/);
    assert.match(joystick, /private onTouchStart[\s\S]*this\.stopHintAnimation\(\)/);
    assert.doesNotMatch(joystick, /this\.node\.active = false/);

    assert.doesNotMatch(mainUI, /this\.node\.on\(Input\.EventType\.TOUCH_START/);
    assert.doesNotMatch(mainUI, /noTouchTime/);
    assert.doesNotMatch(mainUI, /private onTouchStart/);
});

test('the hint reuses the active joystick background and handle art', async () => {
    const hintPrefab = JSON.parse(await readFile(hintPrefabPath, 'utf8'));
    const oldHintBackground = hintPrefab.find(
        (entry) => entry.__type__ === 'cc.Node' && entry._name === 'SpriteSplash-001',
    );
    const oldHintHandle = hintPrefab.find(
        (entry) => entry.__type__ === 'cc.Node' && entry._name === 'SpriteSplash',
    );
    const sprites = hintPrefab.filter((entry) => entry.__type__ === 'cc.Sprite');
    const transforms = new Map(
        hintPrefab
            .map((entry, index) => [index, entry])
            .filter(([, entry]) => entry.__type__ === 'cc.UITransform'),
    );

    const background = sprites.find(
        (sprite) =>
            sprite._spriteFrame?.__uuid__ ===
            '37ce4d9c-4ad3-4fc0-9d22-3a9476975652@f9941',
    );
    const handle = sprites.find(
        (sprite) =>
            sprite._spriteFrame?.__uuid__ ===
            '2bf951fb-7bb5-45ea-87db-b0006ba838ff@f9941',
    );

    assert.ok(background, 'hint should use the active joystick background sprite');
    assert.ok(handle, 'hint should use the active joystick handle sprite');
    assert.equal(oldHintBackground._active, false, 'the duplicate hint background must not render');
    assert.equal(oldHintHandle._active, false, 'the duplicate hint handle must not render');

    const backgroundNode = hintPrefab[background.node.__id__];
    const handleNode = hintPrefab[handle.node.__id__];
    const backgroundTransform = transforms.get(backgroundNode._components[0].__id__);
    const handleTransform = transforms.get(handleNode._components[0].__id__);

    assert.deepEqual(backgroundTransform._contentSize, {
        __type__: 'cc.Size',
        width: 210,
        height: 210,
    });
    assert.deepEqual(handleTransform._contentSize, {
        __type__: 'cc.Size',
        width: 90,
        height: 90,
    });
});
