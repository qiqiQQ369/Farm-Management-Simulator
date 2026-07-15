// Utils.ts
import { _decorator, director, Component } from 'cc';
const { ccclass } = _decorator;

@ccclass('Utils')
export class Utils extends Component {
    public static waitNextFrame(): Promise<void> {
        return new Promise(resolve => {
            // 使用 scheduleOnce 调度一个函数，在下一帧的 update 开始前执行
            director.getScheduler().scheduleOnce(() => {
                resolve();
            }, 0);
        });
    }
}

