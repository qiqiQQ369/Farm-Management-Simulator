// Billboard.ts
import { _decorator, Component, Node, Camera, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Billboard')
export class Billboard extends Component {
    @property(Node)
    targetNode: Node = null; // Sprite 需要跟随的目标节点

    @property(Camera)
    mainCamera: Camera = null; // 主相机

    lateUpdate(dt: number) {
        if (this.targetNode && this.mainCamera) {

            try {
                if(this.targetNode == null || this.node == null) return;
                this.node.worldPosition = this.targetNode.worldPosition;
                // 让 Sprite 的旋转和摄像机的旋转保持一致
                this.node.worldRotation = this.mainCamera.node.worldRotation;
            } catch (error) {
                console.log("error:", error);
            }
            
            // 让 Sprite 节点始终朝向相机
            //const cameraPosition = this.mainCamera.node.worldPosition;
            //this.node.lookAt(cameraPosition, new Vec3(0, 1, 0));
        }
    }
}