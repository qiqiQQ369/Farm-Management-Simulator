import { _decorator, Collider, Component, ITriggerEvent, Node, Vec3 } from "cc";
import { WoodDrop } from "./WoodDrop";
import { ResourceManager } from "./Resource/ResourceManager";
import { StoragePoint } from "./Resource/StoragePoint";
import { WoodBackpack } from "./WoodBackpack";
import { MaxTip } from "./UI/MaxTip";
import { CoinBackpack } from "./CoinBackpack";
const { ccclass, property } = _decorator;


@ccclass('PickupDetector')
export class PickupDetector extends Component {

    @property({ type: Node, tooltip: "玩家节点" })
    public playerNode: Node = null;

    @property({ type: Node, tooltip: "目标收集区域节点" })
    public targetCollectionArea: Node = null!;

    @property({ tooltip: "收集间隔" })
    public collectionInterval: number = 0.05;    

    private playerStay: boolean = false;

    private interval: any;


    protected start(): void {
        this.setupCollisionDetection();
    }

    private setupCollisionDetection(): void {
        const collider = this.node.getComponent(Collider);
        if (collider) {
            collider.on('onTriggerEnter', this.onPlayerEnter, this);
            collider.on('onTriggerExit', this.onPlayerExit, this);
        } else {
            console.warn('PlayerDetectionZone: 未找到Collider组件');
        }
    }

    private onPlayerEnter(event: ITriggerEvent): void {
        console.log('玩家进入');
        if(!this.isPlayerNode(event.otherCollider.node)) return;
        this.playerStay = true;

        //每间隔collectionInterval秒，收集一次木头
        this.interval = setInterval(() => {
            //this.collectWood();
            var storagePoint = this.playerNode.getComponent(WoodBackpack).backpackMount.getComponent(StoragePoint);
            var woodStackArea = this.targetCollectionArea.getComponent(StoragePoint);
            if(woodStackArea.amount == 0) return;

            if(storagePoint.hasSpace(1) == false){
                MaxTip.showMaxTip();
                return;
            }
            
            ResourceManager.MoveResource(woodStackArea, storagePoint, false, 4, new Vec3(0, 0, 0));
        }, this.collectionInterval * 500);
    }

    private collectWood(): void {

        // if(!this.playerStay) {
        //     clearInterval(this.interval);
        //     return;
        // }

        var children = this.targetCollectionArea.children;
        if(children.length == 0) return;
        var woodDrop = children[children.length - 1].getComponent(WoodDrop);
        if (woodDrop) {
            woodDrop.isForcePickup = true;
        }
        else{
            woodDrop =  children[children.length - 1].addComponent(WoodDrop);
            woodDrop.isForcePickup = true;
        }
    }

    private onPlayerExit(event: ITriggerEvent): void {
        console.log('玩家离开');
        if(!this.isPlayerNode(event.otherCollider.node)) return;
        clearInterval(this.interval);
        this.playerStay = false;
    }

    private isPlayerNode(node: Node): boolean {
        return node.name.includes('Player') || 
               node.getComponent('PlayerController') !== null ||
               node.parent?.name.includes('Player');
    }

}