import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
    new URL('../assets/_Scripts/HaulerNPC.ts', import.meta.url),
    'utf8',
);

assert.match(
    source,
    /game\.on\(Game\.EVENT_SHOW,\s*this\.onApplicationShow,\s*this\)/,
    'hauler must listen for the Cocos application-show event',
);

assert.match(
    source,
    /game\.off\(Game\.EVENT_SHOW,\s*this\.onApplicationShow,\s*this\)/,
    'hauler must remove its application-show listener when disabled',
);

const resumeHandlerStart = source.indexOf('private onApplicationShow(');
const nextMethodStart = source.indexOf('\n    private ', resumeHandlerStart + 1);
assert.ok(resumeHandlerStart >= 0, 'hauler must define an application-show handler');

const resumeHandler = source.slice(
    resumeHandlerStart,
    nextMethodStart >= 0 ? nextMethodStart : source.length,
);
assert.match(
    resumeHandler,
    /this\.recoverAfterSceneTransition\(\)/,
    'returning to the page must rebuild interrupted transfers and resume from inventory state',
);

console.log('PASS: hauler repairs interrupted transfers when the application resumes');
