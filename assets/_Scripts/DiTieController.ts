import { _decorator, Component, Node, Label, Vec4, math, Collider, ITriggerEvent } from 'cc';
import { MeshRenderer } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('DiTieController')
export class DiTieController extends Component {

    //@property({ type: Node, tooltip: "资源移动的目标位置" })
    public targetNode: Node = null!;
    
    //@property({ type: Label, tooltip: "显示消耗数量的标签" })
    public countLabel: Label = null!;
    
    //@property({ type: MeshRenderer, tooltip: "进度条填充节点" })
    public fillMeshRenderer: MeshRenderer = null!;

    private collider: Collider = null!;

    private _tilingOffset: Vec4 = new Vec4(1, 1, 0, 0);

    onLoad() {
        this.targetNode = this.node.getChildByName("ShangCeng/Qian");
        this.fillMeshRenderer = this.node.getChildByName("fill").getComponent(MeshRenderer);
        this.countLabel = this.node.getChildByName("ShuZi").getComponent(Label);
    }

    start() {
        this.collider = this.node.getComponent(Collider);
        this.collider.on('onTriggerEnter', this.onTriggerEnter, this);
        this.collider.on('onTriggerExit', this.onTriggerExit, this);
    }

    public setProgress(progress: number, progressText: string) {
        progress = math.clamp(progress / 2, 0, 0.5);
        this._tilingOffset.w = progress;
        this.fillMeshRenderer.materials[0].setProperty('tilingOffset', this._tilingOffset, 0);
        this.countLabel.string = progressText;
    }

    private onTriggerEnter(event: ITriggerEvent) {
        this.node.getChildByPath("XiaCeng/DiBan1").active = false;
        this.node.getChildByPath("XiaCeng/DiBan2").active = true;
    }

    private onTriggerExit(event: ITriggerEvent) {
        this.node.getChildByPath("XiaCeng/DiBan1").active = true;
        this.node.getChildByPath("XiaCeng/DiBan2").active = false;
    }
}


