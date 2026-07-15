import { _decorator, Camera, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MainCamera')
export class MainCamera extends Component {    
    // 单例实例（外部通过 PlayerController.inst 访问）
    public static inst: MainCamera;
    public curCamera:Camera;
    
    // 组件加载时初始化单例
    protected onLoad() {
        // 防止重复创建实例
        if (MainCamera.inst) {
            console.error("PlayerController实例已存在，请勿重复创建");
            this.destroy();
            return;
        }
        MainCamera.inst = this;
        this.setCamera(null)
    }
    start() {

    }

    update(deltaTime: number) {
        
    }

    public setCamera(camera:Camera) {
        if (camera == null) {
            this.curCamera = this.getComponent(Camera);
        } else {
            this.curCamera = camera;
        }
    }
}


