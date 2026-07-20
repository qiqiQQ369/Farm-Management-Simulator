import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
    new URL('../assets/_Scripts/WoodDropManager.ts', import.meta.url),
    'utf8',
);

const animationStart = source.indexOf('private startDropAnimation(');
const animationEnd = source.indexOf('private onLanded(', animationStart);
assert.ok(animationStart >= 0 && animationEnd > animationStart, 'drop animation method must exist');

const animation = source.slice(animationStart, animationEnd);
const hiddenScaleIndex = animation.indexOf('scale: new Vec3(0, 0, 0)');
const normalScaleIndex = animation.indexOf('scale: new Vec3(1, 1, 1)');
const exposeToStorageIndex = animation.indexOf('storagePoint.addResource(woodNode)');

assert.ok(hiddenScaleIndex >= 0, 'drop animation must contain its hide phase');
assert.ok(normalScaleIndex >= 0, 'drop animation must restore the normal wood scale');
assert.ok(exposeToStorageIndex >= 0, 'drop animation must add the wood to storage');

// PickupDetector is allowed to remove a resource as soon as addResource marks it
// movable. Exposing it before the scale tween finishes lets MoveResource capture
// an intermediate scale (0..1) and permanently creates a smaller carried log.
assert.ok(
    exposeToStorageIndex > normalScaleIndex,
    'wood must reach its normal scale before storage exposes it for pickup',
);

console.log('PASS: storage cannot expose wood while its scale is still animating');
