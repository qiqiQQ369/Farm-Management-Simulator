"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Audio = void 0;
/**
 * 杨宗宝
 * 2024/4/9
 */
class Audio {
    static get instance() {
        if (!this._instance) {
            this._instance = new Audio();
        }
        return this._instance;
    }
    play(path) {
    }
}
exports.Audio = Audio;
/**
 * 设置为单例类
 */
Audio._instance = null;
