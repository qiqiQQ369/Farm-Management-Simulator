import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const configUrl = new URL('../build-configs/web-mobile-safe.json', import.meta.url);
const scriptUrl = new URL('../scripts/build-web-mobile-safe.ps1', import.meta.url);

test('安全 Web 构建保留本地游戏脚本结构', () => {
    assert.ok(existsSync(configUrl), 'safe web build config must exist');
    const config = JSON.parse(readFileSync(configUrl, 'utf8'));

    assert.equal(config.platform, 'web-mobile');
    assert.equal(config.debug, true);
    assert.equal(config.inlineEnum, false);
    assert.equal(config.mangleProperties, false);
    assert.equal(config.experimentalEraseModules, false);
    assert.equal(config.sourceMaps, true);
    assert.equal(config.startScene, '855f715d-5f70-4f12-8b99-d294cb838a5b');
    assert.equal(config.buildPath, 'project://build');
    assert.equal(config.outputName, 'web-mobile-safe');
    assert.equal(config.taskName, 'web-mobile-safe');
    assert.equal(config.polyfills?.asyncFunctions, true);
    assert.equal(config.overwriteProjectSettings?.includeModules?.physics, 'inherit-project-setting');
});

test('一键构建只操作构建配置和输出目录', () => {
    assert.ok(existsSync(scriptUrl), 'safe web build script must exist');
    const source = readFileSync(scriptUrl, 'utf8');

    assert.match(source, /CocosCreator\.exe/);
    assert.match(source, /configPath=/);
    assert.match(source, /web-mobile-safe\.json/);
    assert.match(source, /WaitForBuildSeconds/);
    assert.match(source, /ResourceFieldSystem/);
    assert.match(source, /CornWorker/);
    assert.match(source, /CornStoragePoint/);
    assert.match(source, /CornCustomerScheduler/);
    assert.doesNotMatch(source, /Set-Content[^\n]*assets[\\\/]_Scripts/i);
    assert.doesNotMatch(source, /DevScene\.scene[^\n]*(Set-Content|Copy-Item)/i);
});
