/**
 * 杨宗宝
 * 2024/4/9
 */
export class Audio {
    /**
     * 设置为单例类
     */
    private static _instance: Audio = null!;
    public static get instance() {
        if (!this._instance) {
            this._instance = new Audio();
        }
        return this._instance;
    }
    play(path: string): void {
        
    }
}