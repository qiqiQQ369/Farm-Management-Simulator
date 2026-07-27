import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const animatorUrl = new URL(
    '../assets/_Scripts/MoneyUIRewardAnimator.ts',
    import.meta.url,
);
const forestCollectorUrl = new URL(
    '../assets/_Scripts/CoinCollector.ts',
    import.meta.url,
);
const cornCollectorUrl = new URL(
    '../assets/_Scripts/CornCoinCollector.ts',
    import.meta.url,
);

class FakeVec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    set(value) {
        this.x = value.x;
        this.y = value.y;
        this.z = value.z;
        return this;
    }

    static multiplyScalar(out, value, scalar) {
        out.x = value.x * scalar;
        out.y = value.y * scalar;
        out.z = value.z * scalar;
        return out;
    }
}

async function createAnimatorHarness() {
    const tweens = [];
    const source = (await readFile(animatorUrl, 'utf8'))
        .replace(/import \{[^;]+from 'cc';/, '')
        .replace(/@ccclass\('[^']+'\)\s*/, '')
        .replace(
            'export class MoneyUIRewardAnimator',
            'class MoneyUIRewardAnimator',
        )
        .concat('\nglobalThis.MoneyUIRewardAnimator = MoneyUIRewardAnimator;');

    class FakeTween {
        constructor(node) {
            this.node = node;
            this.steps = [];
            this.completion = null;
            this.stopped = false;
        }

        to(duration, properties) {
            this.steps.push({ duration, properties });
            return this;
        }

        call(completion) {
            this.completion = completion;
            return this;
        }

        start() {
            tweens.push(this);
            return this;
        }

        stop() {
            this.stopped = true;
        }

        finish() {
            const finalScale = this.steps.at(-1)?.properties.scale;
            if (finalScale) this.node.setScale(finalScale);
            this.completion?.();
        }
    }

    class FakeNode {
        constructor() {
            this.isValid = true;
            this.scale = new FakeVec3(1, 1, 1);
            this.scaleWrites = [];
        }

        setScale(value) {
            this.scale.set(value);
            this.scaleWrites.push(new FakeVec3(value.x, value.y, value.z));
        }
    }

    const context = {
        _decorator: { ccclass: () => (target) => target },
        Component: class {},
        find: () => null,
        Node: FakeNode,
        tween: (node) => new FakeTween(node),
        Tween: FakeTween,
        Vec3: FakeVec3,
    };
    runInNewContext(
        stripTypeScriptTypes(source, { mode: 'transform' }),
        context,
    );

    const node = new FakeNode();
    const animator = new context.MoneyUIRewardAnimator();
    animator.node = node;
    animator.onLoad();
    return { animator, node, tweens };
}

test('money UI animator owns a restartable whole-node punch animation', async () => {
    const source = await readFile(animatorUrl, 'utf8');

    assert.match(source, /find\('Canvas\/CoinLabel'\)/);
    assert.match(source, /stop\(\)/);
    assert.match(source, /this\._baseScale/);
    assert.match(source, /\.to\(0\.067,/);
    assert.match(source, /\.to\(0\.10,/);
    assert.doesNotMatch(source, /constructor\.name/);
});

test('both money reward paths trigger the shared whole-UI animation', async () => {
    const [forestSource, cornSource] = await Promise.all([
        readFile(forestCollectorUrl, 'utf8'),
        readFile(cornCollectorUrl, 'utf8'),
    ]);

    for (const source of [forestSource, cornSource]) {
        assert.match(
            source,
            /import \{ MoneyUIRewardAnimator \} from '\.\/MoneyUIRewardAnimator';/,
        );
        assert.match(
            source,
            /coinAmountLabel\.string = String\(currentAmount \+ delta\);\s*MoneyUIRewardAnimator\.playForCurrentScene\(\);/,
        );
    }
});

test('continuous rewards queue one smooth follow-up pulse without hard resets', async () => {
    const { animator, node, tweens } = await createAnimatorHarness();

    animator.play();
    const firstTween = tweens[0];
    const writesAfterFirstPulseStarts = node.scaleWrites.length;

    animator.play();
    animator.play();

    assert.equal(firstTween.stopped, false);
    assert.equal(tweens.length, 1);
    assert.equal(node.scaleWrites.length, writesAfterFirstPulseStarts);
    assert.equal(firstTween.steps[0].properties.scale.x, 1.12);

    firstTween.finish();
    assert.equal(tweens.length, 2);

    const secondTween = tweens[1];
    animator.play();
    animator.play();
    secondTween.finish();
    assert.equal(tweens.length, 3);

    tweens[2].finish();
    assert.equal(tweens.length, 3);
    assert.deepEqual(
        [node.scale.x, node.scale.y, node.scale.z],
        [1, 1, 1],
    );
});

test('continuous money UI feedback completes about six pulses per second', async () => {
    const { animator, tweens } = await createAnimatorHarness();

    animator.play();
    const durations = tweens[0].steps.map((step) => step.duration);
    const totalDuration = durations.reduce(
        (total, duration) => total + duration,
        0,
    );

    assert.deepEqual(durations, [0.067, 0.10]);
    assert.ok(Math.abs(totalDuration - 1 / 6) < 0.001);
});
