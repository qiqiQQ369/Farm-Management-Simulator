import { _decorator, Node, Vec3, tween, Tween, UIOpacity } from 'cc';

/**
 * 静态通用动画库
 * 提供常用的动画效果：punch、bounce、呼吸等
 */
export class AnimationLibrary {
    
    /**
     * Punch动画 - 快速放大后回弹
     * @param node 目标节点
     * @param duration 动画持续时间
     * @param scale 最大缩放值
     * @param onComplete 完成回调
     * @returns Tween对象
     */
    static punch(node: Node, duration: number = 0.6, scale: number = 1.2, onComplete?: () => void): Tween<Node> {
        const originalScale = node.scale.clone();
        
        return tween(node)
            .to(duration * 0.1, { scale: new Vec3(scale * 0.8, scale * 0.8, 1) }, { easing: 'backOut' })
            .to(duration * 0.2, { scale: new Vec3(scale, scale, 1) }, { easing: 'backOut' })
            .to(duration * 0.15, { scale: new Vec3(scale * 0.9, scale * 0.9, 1) }, { easing: 'backOut' })
            .to(duration * 0.15, { scale: new Vec3(scale * 1.05, scale * 1.05, 1) }, { easing: 'backOut' })
            .to(duration * 0.1, { scale: new Vec3(scale * 0.95, scale * 0.95, 1) }, { easing: 'backOut' })
            .to(duration * 0.15, { scale: new Vec3(scale * 1.02, scale * 1.02, 1) }, { easing: 'backOut' })
            .to(duration * 0.15, { scale: originalScale }, { easing: 'backOut' })
            .call(() => {
                if (onComplete) onComplete();
            });
    }

    /**
     * Bounce动画 - 弹跳效果
     * @param node 目标节点
     * @param duration 动画持续时间
     * @param height 弹跳高度
     * @param bounces 弹跳次数
     * @param onComplete 完成回调
     * @returns Tween对象
     */
    static bounce(node: Node, duration: number = 1.0, height: number = 50, bounces: number = 3, onComplete?: () => void): Tween<Node> {
        const originalPos = node.position.clone();
        let bounceSequence = tween(node);
        
        const bounceHeight = height;
        const bounceDuration = duration / (bounces * 2);
        
        for (let i = 0; i < bounces; i++) {
            const currentHeight = bounceHeight * (1 - i / bounces);
            const currentDuration = bounceDuration * (1 - i / (bounces * 2));
            
            bounceSequence = bounceSequence
                .to(currentDuration, { 
                    position: new Vec3(originalPos.x, originalPos.y + currentHeight, originalPos.z) 
                }, { easing: 'quartOut' })
                .to(currentDuration, { 
                    position: originalPos 
                }, { easing: 'quartIn' });
        }
        
        return bounceSequence.call(() => {
            if (onComplete) onComplete();
        });
    }

    /**
     * 呼吸动画 - 缓慢的放大缩小循环
     * @param node 目标节点
     * @param duration 一次呼吸的持续时间
     * @param scale 最大缩放值
     * @param onComplete 完成回调（一次呼吸完成）
     * @returns Tween对象
     */
    static breathe(node: Node, duration: number = 2.0, scale: number = 1.1, onComplete?: () => void): Tween<Node> {
        const originalScale = node.scale.clone();
        
        return tween(node)
            .to(duration / 2, { scale: new Vec3(scale, scale, 1) }, { easing: 'sineInOut' })
            .to(duration / 2, { scale: originalScale }, { easing: 'sineInOut' })
            .call(() => {
                if (onComplete) onComplete();
            });
    }

    /**
     * 摇摆动画 - 左右摇摆
     * @param node 目标节点
     * @param duration 动画持续时间
     * @param angle 最大摇摆角度（度）
     * @param swings 摇摆次数
     * @param onComplete 完成回调
     * @returns Tween对象
     */
    static shake(node: Node, duration: number = 0.5, angle: number = 10, swings: number = 4, onComplete?: () => void): Tween<Node> {
        const originalRotation = node.eulerAngles.clone();
        let shakeSequence = tween(node);
        
        const swingDuration = duration / (swings * 2);
        
        for (let i = 0; i < swings; i++) {
            const currentAngle = angle * (1 - i / swings);
            
            shakeSequence = shakeSequence
                .to(swingDuration, { 
                    eulerAngles: new Vec3(originalRotation.x, originalRotation.y, originalRotation.z + currentAngle) 
                }, { easing: 'sineInOut' })
                .to(swingDuration, { 
                    eulerAngles: new Vec3(originalRotation.x, originalRotation.y, originalRotation.z - currentAngle) 
                }, { easing: 'sineInOut' });
        }
        
        return shakeSequence
            .to(swingDuration, { eulerAngles: originalRotation }, { easing: 'sineInOut' })
            .call(() => {
                if (onComplete) onComplete();
            });
    }

    /**
     * 脉冲动画 - 快速的放大缩小
     * @param node 目标节点
     * @param duration 动画持续时间
     * @param scale 最大缩放值
     * @param pulses 脉冲次数
     * @param onComplete 完成回调
     * @returns Tween对象
     */
    static pulse(node: Node, duration: number = 0.8, scale: number = 1.15, pulses: number = 2, onComplete?: () => void): Tween<Node> {
        const originalScale = node.scale.clone();
        let pulseSequence = tween(node);
        
        const pulseDuration = duration / (pulses * 2);
        
        for (let i = 0; i < pulses; i++) {
            pulseSequence = pulseSequence
                .to(pulseDuration, { scale: new Vec3(scale, scale, 1) }, { easing: 'quadOut' })
                .to(pulseDuration, { scale: originalScale }, { easing: 'quadIn' });
        }
        
        return pulseSequence.call(() => {
            if (onComplete) onComplete();
        });
    }

    // /**
    //  * 渐现动画 - 透明度从0到1
    //  * @param node 目标节点
    //  * @param duration 动画持续时间
    //  * @param onComplete 完成回调
    //  * @returns Tween对象
    //  */
    static fadeIn(node: Node, duration: number = 0.5, onComplete?: () => void): Tween<Node> {
        // 设置初始透明度为0
        const uiOpacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        if (uiOpacity) {
            uiOpacity.opacity = 0;
            return tween(node)
                .update(duration, (t, v) => {
                    uiOpacity.opacity =  255 * (v / duration);
                }, { easing: 'quartOut' })
                .call(() => {
                    if (onComplete) onComplete();
                });
        }
        return tween(node).call(() => {
            if (onComplete) onComplete();
        });
    }

    // /**
    //  * 渐隐动画 - 透明度从1到0
    //  * @param node 目标节点
    //  * @param duration 动画持续时间
    //  * @param onComplete 完成回调
    //  * @returns Tween对象
    //  */
    static fadeOut(node: Node, duration: number = 0.5, onComplete?: () => void): Tween<Node> {
        const uiOpacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        if (uiOpacity) {
            return tween(node)
                .update(duration, (t, v) => {
                    uiOpacity.opacity = 255 * (1 - v / duration);
                }, { easing: 'quartIn' })
                .call(() => {
                    if (onComplete) onComplete();
                });
        }
        return tween(node).call(() => {
            if (onComplete) onComplete();
        });
    }

    static fadeInOut(node: Node, duration: number = 0.5, onComplete?: () => void): Tween<Node> {
        const uiOpacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        return tween(node)
            .update(duration * 0.5, (t, v) => {
                uiOpacity.opacity = 255 * (v / duration);
            }, { easing: 'quartOut' })
            .update(duration * 0.5, (t, v) => {
                uiOpacity.opacity = 255 * (1 - v / duration);
            }, { easing: 'quartOut' })
            .call(() => {
                if (onComplete) onComplete();
            });
    }

    static flicker(node: Node, duration: number = 0.5, onComplete?: () => void): Tween<Node> {
        const uiOpacity = node.getComponent(UIOpacity);
        uiOpacity.opacity = 0;

        return tween(node)
        .to(duration * 0.5, { opacity: 255 }, { easing: 'quartIn' })
        .to(duration * 0.5, { opacity: 0 }, { easing: 'quartOut' })
        .call(() => {
            if (onComplete) onComplete();
        });
    }

    static breatheGroup(node: Node, duration: number = 2.0, interval: number = 2, nodes: Node[] = [], scale: number = 1.1, onComplete?: () => void): Tween<Node> {
        const originalScale = nodes[0].scale.clone();
        return tween(node)
        .call(() => {
            var tweenNodes = nodes.map((node, index) => tween(node)
            .delay(interval * index)
            .to(duration, { scale: new Vec3(scale, scale, 1) }, { easing: 'sineInOut' })
            .to(duration, { scale: originalScale }, { easing: 'sineInOut' })
            .start()
            );
        }).delay(duration + interval * nodes.length)
        .call(() => {
            if (onComplete) onComplete();
        });
    }

    public static scaleFadeOut(node: Node, duration: number = 0.5, scale: number = 1, onComplete?: () => void): Tween<Node> {
        const uiOpacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        uiOpacity.opacity = 255;
        // var originalScale = node.scale.clone();
        return tween(node)
            .to(duration, { scale: new Vec3(scale, scale, scale) }, { easing: 'sineInOut' })
            .update(duration * 0.5, (t, v) => {
                uiOpacity.opacity = 255 * (1 - v / duration);
            }, { easing: 'quartOut' })
            .call(() => {
                // node.scale = originalScale;
                if (onComplete) onComplete();
            });
    }

    public static scaleFadeIn(node: Node, duration: number = 0.5, scale: number = 1, onComplete?: () => void): Tween<Node> {
        const uiOpacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        uiOpacity.opacity = 255;
        var originalScale = node.scale.clone();
        return tween(node)
            .to(duration, { scale: new Vec3(scale, scale, scale) }, { easing: 'sineInOut' })
            .call(() => {
                if (onComplete) onComplete();
            });
    }

    /**
     * 循环上下移动动画
     * @param node 目标节点
     * @param duration 单次上下移动的总时长
     * @param targetPosition 目标位置（y轴偏移量）
     * @param onComplete 完成回调（只在第一次完成后调用）
     * @returns Tween对象
     */
    static sin(node: Node, duration: number = 0.5, targetPosition: Vec3 = new Vec3(0, 30, 0), onComplete?: () => void): Tween<Node> {
        const originalPos = node.position.clone();
        // 只在第一次完成后调用onComplete
        let called = false;
        return tween(node)
            .repeatForever(
                tween()
                    .to(duration / 2, { position: targetPosition }, { easing: 'sineInOut' })
                    .to(duration / 2, { position: originalPos }, { easing: 'sineInOut' })
                    .call(() => {
                        if (!called && onComplete) {
                            onComplete();
                            called = true;
                        }
                        node.position = originalPos;
                    })
            );
    }
}
