import { _decorator, Camera, Component, find, Vec3, Quat } from 'cc';

const { ccclass } = _decorator;

/** 让世界空间中的提示 UI 始终朝向当前主摄像机。 */
@ccclass('CameraFacingUI')
export class CameraFacingUI extends Component {
    private _camera: Camera | null = null;
    private readonly _rotation = new Quat();
    private _tilt = -45;

    protected onLoad(): void {
        const cameraNode = find('Main Camera');
        this._camera = cameraNode ? cameraNode.getComponent(Camera) : null;
        // 提示框使用等距游戏常见的固定俯角，只跟随摄像机的水平旋转。
        this._tilt = this.node.eulerAngles.x || -45;
    }

    protected lateUpdate(): void {
        if (!this._camera || !this._camera.node.isValid) return;
        const cameraYaw = this._camera.node.eulerAngles.y;
        Quat.fromEuler(this._rotation, this._tilt, cameraYaw, 0);
        this.node.setWorldRotation(this._rotation);
    }
}
