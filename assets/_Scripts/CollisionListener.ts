import { _decorator, Component, Collider, ICollisionEvent, ITriggerEvent } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CollisionListener')
export class CollisionListener extends Component {
    start() {
        const collider = this.getComponent(Collider);
        if (collider) {
            console.log("CollisionListener start");
            // 监听碰撞事件
            collider.on('onCollisionEnter', this.onCollisionEnter, this);
            
            // 监听触发事件（如果你的碰撞体是触发器）
            collider.on('onTriggerEnter', this.onTriggerEnter, this);
        } else {
            console.warn("当前节点没有找到 Collider 组件！");
        }
    }

    onCollisionEnter(event: ICollisionEvent) {
        // event.otherCollider 就是与本物体碰撞的另一个碰撞体
        console.log("碰撞开始！碰撞到的物体是：", event.otherCollider.node.name);
    }
    
    onTriggerEnter(event: ITriggerEvent) {
        console.log("触发开始！进入触发器的物体是：", event.otherCollider.node.name);
    }

    onDestroy() {
        // 在组件销毁时，移除监听器是一个好习惯
        const collider = this.getComponent(Collider);
        if (collider) {
            collider.off('onCollisionEnter', this.onCollisionEnter, this);
            collider.off('onTriggerEnter', this.onTriggerEnter, this);
        }
    }
}