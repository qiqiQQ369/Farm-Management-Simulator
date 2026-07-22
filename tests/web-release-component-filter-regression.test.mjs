import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const visualFilterFiles = [
    '../assets/_Scripts/ResourceFieldSystem.ts',
    '../assets/_Scripts/CornFieldProduction.ts',
    '../assets/_Scripts/CornHaulerBackpack.ts',
    '../assets/_Scripts/MultiResourceBackpack.ts',
];

test('Web Release 动态对象筛选不依赖会被压缩的构造函数名称', () => {
    const builder = JSON.parse(readFileSync(
        new URL('../profiles/v2/packages/builder.json', import.meta.url),
        'utf8',
    ));
    const buildTask = Object.values(builder.BuildTaskManager.taskMap)[0];
    assert.equal(buildTask.options.debug, false, 'regression must cover the release build');

    for (const relativePath of visualFilterFiles) {
        const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /constructor\.name/, `${relativePath} must survive class-name minification`);
        assert.match(source, /component instanceof Renderer/, `${relativePath} must preserve renderers by type`);
        assert.match(source, /component instanceof Animation/, `${relativePath} must preserve animations by type`);
    }
});

test('第二关员工筛选用稳定类型保留砍伐动作和音频', () => {
    const source = readFileSync(
        new URL('../assets/_Scripts/ResourceFieldSystem.ts', import.meta.url),
        'utf8',
    );

    assert.match(source, /component instanceof ChopAction/);
    assert.match(source, /component instanceof AudioSource/);
});
