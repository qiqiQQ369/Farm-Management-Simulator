import { _decorator, Camera, Canvas, Component, Node, find, Vec3 } from 'cc';

const { ccclass } = _decorator;

/** 将世界对象上的提示框转换为跟随目标的屏幕 UI。 */
@ccclass('CameraFacingUI')
export class CameraFacingUI extends Component {
    private _camera: Camera | null = null;
    private _canvasCamera: Camera | null = null;
    private _target: Node | null = null;
    private readonly _screenPosition = new Vec3();
    private readonly _uiWorldPosition = new Vec3();
    private readonly _targetOffset = new Vec3(0, 2.4, 0);
    private readonly _screenOffset = new Vec3(0, 38, 0);

    protected onLoad(): void {
        const cameraNode = find('Main Camera');
        this._camera = cameraNode ? cameraNode.getComponent(Camera) : null;
        this._target = this.node.parent;

        const canvasNode = find('Canvas');
        const canvas = canvasNode ? canvasNode.getComponent(Canvas) : null;
        this._canvasCamera = canvas?.cameraComponent ?? this._camera;

        if (canvasNode && this.node.parent !== canvasNode) {
            this.node.setParent(canvasNode, true);
        }
        this.node.setScale(0.75, 0.75, 0.75);
    }

    protected lateUpdate(): void {
        if (!this._target || !this._target.isValid || !this._canvasCamera || !this._canvasCamera.node.isValid) return;

        const anchor = this._target.worldPosition.clone().add(this._targetOffset);
        this._canvasCamera.worldToScreen(anchor, this._screenPosition);
        this._screenPosition.add(this._screenOffset);
        this._canvasCamera.screenToWorld(this._screenPosition, this._uiWorldPosition);
        this.node.setWorldPosition(this._uiWorldPosition);
        this.node.setRotation(0, 0, 0, 1);
    }
}
