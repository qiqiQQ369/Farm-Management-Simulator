import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const script = (name) => new URL(`../assets/_Scripts/${name}`, import.meta.url);

test('customer schedulers remove emoji while preserving demand tips', async () => {
    const [forest, corn, randomizer, vehicle] = await Promise.all([
        readFile(script('NPCScheduler.ts'), 'utf8'),
        readFile(script('CornCustomerScheduler.ts'), 'utf8'),
        readFile(script('CustomerAppearanceRandomizer.ts'), 'utf8'),
        readFile(script('VehicleCollector.ts'), 'utf8'),
    ]);

    for (const source of [forest, corn]) {
        assert.doesNotMatch(source, /getNpcEmoji|resetEmoji|emoji\.active/);
        assert.match(source, /showFillTipForNpc/);
        assert.match(source, /hideFillTip/);
    }

    assert.doesNotMatch(forest, /checkEmoji|checkEmojiUpdate/);
    assert.doesNotMatch(corn, /completionEmojiFrame|prepareNpcCompletionEmojis|new Node\('emoji'\)/);
    assert.doesNotMatch(randomizer, /child\.name !== 'emoji'/);
    assert.match(randomizer, /child\.name !== 'StoragePoint'/);
    assert.match(vehicle, /emojiPrefab/);
});
