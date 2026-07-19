import { _decorator, Component, Node, Vec3, instantiate, Prefab, find, tween, Quat, Tween, AudioSource, HingeConstraint } from 'cc';
import { StoragePoint } from './StoragePoint';
const { ccclass, property } = _decorator;

/**
 * 资源管理器
 * 管理资源的取出、运输和存放
 */
@ccclass('ResourceManager')
export class ResourceManager {

    private static tweenDic: Map<Node, Tween<Node>> = new Map<Node, Tween<Node>>();

    public static tweenDicCoin: Map<Node, Tween<Node>> = new Map<Node, Tween<Node>>();

    public static async MoveResource(fromPoint: StoragePoint, toPoint: StoragePoint, loop: boolean = false, animationType: number = 2, rotation: Vec3 = Vec3.ZERO): Promise<boolean> {
        if (!fromPoint || !toPoint) {
            return false;
        }

        if (loop) {
            let moved = false;
            while (fromPoint.amount > 0 && toPoint.hasSpace(1)) {
                const resource = fromPoint.removeResource();
                if (!resource || !toPoint.addResource(resource)) {
                    break;
                }
                moved = true;
                console.log(`从${fromPoint.storageName}移动到${toPoint.storageName}，剩余资源数量：${fromPoint.amount}`);
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            return moved;
        } else {
            if (!toPoint.hasSpace(1)) {
                return false;
            }

            const resource = fromPoint.removeResource(animationType);
            if (resource == null) {
                return false;
            }

            return toPoint.addResource(resource, animationType, rotation);
        }
    }

    /**
     * 播放添加动画
     */
    public static playAddAnimation(woodNode: Node): void {
        // 从稍高的位置掉落
        const finalPos = woodNode.position.clone();
        woodNode.setPosition(finalPos.x, finalPos.y + 0.5, finalPos.z);
        
        // console.log('playAddAnimation', woodNode.position, finalPos);
        var tweenAnimation = tween(woodNode).to(0.1, { position: finalPos }, { easing: 'bounceOut' }).call(() =>{
            this.tweenDic.delete(woodNode);
        });
        this.tweenDic.set(woodNode, tweenAnimation);
        tweenAnimation.start();
    }

    public static playAddAnimation2(resource: Node, targetPosition: Vec3, stackAreaNode: Node, onComplete: () => void): void {
        // 从高处掉落
        const heightPos = targetPosition.clone();
        heightPos.y += 3.0;
        
        // 掉落动画
        tween(resource)
            .to(0.3, { position: heightPos}, { easing: 'linear' })
            .call(() => {
                resource.rotation = new Quat(0, 0, 0, 1);
            })
            .to(0.5, { position: targetPosition }, {easing: 'bounceOut'
            }).call(() => {
                resource.setPosition(targetPosition);
                onComplete();
                stackAreaNode.getComponent(StoragePoint).playAudio();
                // var audioSource = stackAreaNode.getComponent(AudioSource);
                // if(audioSource != null) {
                //     audioSource.playOneShot(audioSource.clip);
                // }
                // this.tweenDic.delete(resource);
            })
            .start();

        // this.tweenDic.set(resource, tween);
        // tween.start();
    }

    public static playAddAnimation3(resource: Node, targetPosition: Vec3, stackAreaNode: Node, onComplete: () => void): void {
        if(this.tweenDic.has(resource))
            {
                this.tweenDic.get(resource).stop();
                this.tweenDic.delete(resource);
            }

        // 从更高处掉落
        const heightPos = targetPosition.clone();
        heightPos.y += 6.0;
        heightPos.z -= 1;
        
        // 添加随机的水平偏移，让掉落轨迹更自然
        const randomOffset = (Math.random() - 0.5) * 2.0;
        heightPos.x += randomOffset;
        heightPos.z += randomOffset;
        
        // 设置初始旋转为随机值，增加掉落的真实感
        const randomRotation = new Quat();
        randomRotation.set(
            Math.random() * 360, 
            Math.random() * 360, 
            Math.random() * 360
        );
        resource.setRotationFromEuler(randomRotation.x, randomRotation.y, randomRotation.z);
        
        // 夸张的掉落动画
        tween(resource)
            // 第一阶段：快速上升到高点，同时旋转
            .parallel(
                tween().to(0.3, { position: heightPos }, { easing: 'quadOut' }),
                tween().by(0.2, { eulerAngles: new Vec3(180, 360, 90) })
            )
            .call(() => {
                
            })
            .delay(0.06)
            
            .parallel(
                tween().to(0.6, { position: targetPosition }, { easing: 'bounceOut' }),
                tween().by(0.6, { eulerAngles: new Vec3(360, 180, 270) })
            )
            .call(() => {
                // 落地时重置旋转并播放音效
                resource.rotation = new Quat(0, 0, 0, 1);
                resource.setPosition(targetPosition);
                
                // 落地冲击效果：短暂放大再恢复
                const originalScale = resource.scale.clone();
                resource.setScale(originalScale.x * 1.3, originalScale.y * 0.7, originalScale.z * 1.3);
                
                tween(resource)
                    .to(0.15, { scale: originalScale }, { easing: 'elasticOut' })
                    .start();
                
                onComplete();
                
                stackAreaNode.getComponent(StoragePoint).playAudio();

                // var audioSource = stackAreaNode.getComponent(AudioSource);
                // if(audioSource != null) {
                //     audioSource.playOneShot(audioSource.clip);
                // }
            })
            .start();
    }

    public static playAddAnimation4(resource: Node, targetPosition: Vec3, stackAreaNode: Node, rotation: Vec3, onComplete: () => void): void {
        const startPosition = resource.position.clone();
        const controlPoint = new Vec3();
        Vec3.lerp(controlPoint, startPosition, targetPosition, 0.5);
        const distance = Vec3.distance(startPosition, targetPosition);
        controlPoint.y += Math.max(1.5, distance * 0.6);

        const direction = new Vec3();
        Vec3.subtract(direction, targetPosition, startPosition);
        const perpendicular = new Vec3(-direction.z, 0, direction.x);
        if (perpendicular.lengthSqr() > 0.000001) {
            Vec3.normalize(perpendicular, perpendicular);
            Vec3.scaleAndAdd(controlPoint, controlPoint, perpendicular, distance * 0.2);
        }

        // Keep the whole transfer on Cocos' scheduler. Native requestAnimationFrame
        // callbacks can be discarded while the game is hidden or throttled,
        // leaving StoragePoint.CanMove false forever.
        const originalScale = resource.scale.clone();
        const raisedScale = new Vec3(originalScale.x * 1.17, originalScale.y * 1.17, originalScale.z * 1.17);
        const halfRotation = new Vec3(rotation.x * 0.5, rotation.y * 0.5, rotation.z * 0.5);

        tween(resource)
            .to(0.15, { position: controlPoint, eulerAngles: halfRotation }, { easing: 'sineOut' })
            .to(0.15, { position: targetPosition, eulerAngles: rotation }, { easing: 'sineIn' })
            .call(() => {
                resource.setPosition(targetPosition);
                resource.rotation = new Quat(0, 0, 0, 1);
            })
            .to(0.1, { scale: raisedScale }, { easing: 'bounceOut' })
            .to(0.2, { scale: originalScale }, { easing: 'bounceOut' })
            .call(() => {
                onComplete();
                stackAreaNode.getComponent(StoragePoint)?.playAudio();
            })
            .start();
    }

    /**
     * 播放移除动画
     */
    public static playRemoveAnimation(woodNode: Node, callback: () => void): void {
        const finalPos = new Vec3(woodNode.position.x, woodNode.position.y + 1, woodNode.position.z);
        
        tween(woodNode)
            .parallel(
                tween().to(0.3, { position: finalPos }),
                tween().to(0.3, { scale: new Vec3(0.1, 0.1, 0.1) })
            )
            .call(callback)
            .start();
    }
}
