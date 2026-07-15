import { _decorator, Component, Node, MeshRenderer, Sprite, Label, Renderable2D, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RenderOrderManager')
export class RenderOrderManager extends Component {

    // 在编辑器中拖入你的 3D 模型节点
    @property(MeshRenderer)
    modelMeshRenderer: MeshRenderer | null = null;

    // 在编辑器中拖入你的 UI 节点（例如，一个带有 Sprite 组件的节点）
    @property(Label)
    label: Label | null = null;

    @property(Number)
    priority: number = 0;

    start() {

        // 获取 3D 模型的渲染优先级
        if (this.modelMeshRenderer) {
            const modelPriority = this.modelMeshRenderer.priority;  
            console.log('3D 模型的默认渲染优先级:', modelPriority);
        }

        // 获取 UI 节点的渲染优先级
        if (this.label) {
            this.label.getComponent(UITransform).priority = this.priority;
            console.log('UI 节点的渲染优先级已设置为:', this.label.getComponent(UITransform).priority);
        }

    }

    protected update(dt: number): void {
        if (this.label) {
            this.label.getComponent(UITransform).priority = this.priority;
        }
    }
}