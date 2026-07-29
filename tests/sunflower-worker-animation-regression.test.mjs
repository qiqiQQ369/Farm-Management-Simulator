import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(
    new URL(relativePath, import.meta.url),
    'utf8',
);

const fieldSource = read('../assets/_Scripts/ResourceFieldSystem.ts');
const workerSource = read('../assets/_Scripts/CornWorker.ts');
const woodcutterSource = read('../assets/_Scripts/Woodcutter.ts');

test('side-field workers bind the visible protagonist worker animation', () => {
    const spawnMethod = fieldSource.match(
        /private spawnWorkers[\s\S]*?\n    private spawnVehicle/,
    )?.[0] ?? '';

    assert.match(
        spawnMethod,
        /this\.ensureProtagonistWorkerVisual\(actor\)/,
        'worker spawning must not depend on the forest Woodcutter onLoad lifecycle',
    );
    assert.match(fieldSource, /private findVisibleWorkerAnimation\(actor: Node\): SkeletalAnimation \| null/);
    assert.match(fieldSource, /getChildByName\('WoodcutterVisual'\)/);
    assert.match(spawnMethod, /controller\.skeletalAnimation = this\.findVisibleWorkerAnimation\(actor\)!/);
    assert.ok(
        spawnMethod.indexOf('this.ensureProtagonistWorkerVisual(actor)')
            < spawnMethod.indexOf('controller.skeletalAnimation = this.findVisibleWorkerAnimation(actor)!'),
        'the protagonist visual must exist before its animation is resolved',
    );
    assert.match(fieldSource, /private ensureProtagonistWorkerVisual[\s\S]*?instantiate\(sourceVisual\)/);
    assert.match(fieldSource, /if \(inheritedAnimation\) child\.active = false/);
    assert.match(fieldSource, /skeletalAnimation\.enabled = true/);
});

test('side-field worker states use the protagonist animation clips', () => {
    assert.match(workerSource, /Idle: 'idle'/);
    assert.match(workerSource, /Run: 'run'/);
    assert.match(workerSource, /Harvest: 'sickle_harvest'/);
    assert.match(workerSource, /this\.skeletalAnimation\?\.getState\(clipName\)/);
    assert.match(workerSource, /this\.skeletalAnimation\.play\(clipName\)/);
});

test('side-field worker restores the sickle even when the live player has hidden it', () => {
    const visualMethod = fieldSource.match(
        /private ensureProtagonistWorkerVisual[\s\S]*?\n    private findVisibleWorkerAnimation/,
    )?.[0] ?? '';

    assert.match(visualMethod, /this\.ensureWorkerSickleVisible\(visibleWorker\)/);
    assert.match(fieldSource, /node\.name === 'SM_镰刀'/);
    assert.match(fieldSource, /node\.active = true/);
    assert.match(fieldSource, /renderer\.enabled = true/);
});

test('forest and side-field lifecycle cannot install two protagonist models', () => {
    const installMethod = woodcutterSource.match(
        /private installProtagonistVisual[\s\S]*?\n    start\(\)/,
    )?.[0] ?? '';
    assert.match(installMethod, /getChildByName\('WoodcutterVisual'\)/);
    assert.ok(
        installMethod.indexOf("getChildByName('WoodcutterVisual')")
            < installMethod.indexOf('instantiate(sourceVisual)'),
        'Woodcutter onLoad must reuse a model already installed by ResourceFieldSystem',
    );
    assert.match(
        installMethod,
        /if \(existingVisual\)[\s\S]*?return/,
        'an existing protagonist visual must stop a second clone from being created',
    );
});
