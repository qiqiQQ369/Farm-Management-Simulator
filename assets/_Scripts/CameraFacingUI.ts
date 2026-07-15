import { _decorator, Camera, Component, find } from 'cc';

const { ccclass } = _decorator;

/** 让世界空间中的提示 UI 始终朝向当前主摄像机。 */
@ccclass('CameraFacingUI')
export class CameraFacingUI extends Component {
    private _camera: Camera | null = null;

    protected onLoad(): void {
        const cameraNode = find('Main Camera');
        this._camera = cameraNode ? cameraNode.getComponent(Camera) : null;
    }

    protected lateUpdate(): void {
        if (!this._camera || !this._camera.node.isValid) return;
        this.node.setWorldRotation(this._camera.node.worldRotation);
    }
}
