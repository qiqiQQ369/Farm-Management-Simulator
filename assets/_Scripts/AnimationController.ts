import { _decorator, Component, Node, Tween, Enum, Vec3 } from 'cc';
const { ccclass, property } = _decorator;
import { AnimationLibrary } from './AnimationLibrary';

/**
 * 动画类型枚举
 */
export enum AnimationType {
    PUNCH = 'punch',
    BOUNCE = 'bounce',
    BREATHE = 'breathe',
    SHAKE = 'shake',
    PULSE = 'pulse',
    FADE_IN = 'fadeIn',
    FADE_OUT = 'fadeOut',
    FADE_IN_OUT = 'fadeInOut',
    FLICKER = 'flicker',
    BREATHEGROUP = 'breatheGroup',
    SCALE_FADE_OUT = 'scaleFadeOut',
    SCALE_FADE_IN = 'scaleFadeIn',
    SIN = 'sin',
}

@ccclass('AnimationController')
export class AnimationController extends Component {
    
    @property({ type: Node })
    targetNode: Node = null!;
    
    @property({ 
        type: Enum(AnimationType),
        displayName: "动画类型"
    })
    animationType: AnimationType = AnimationType.PUNCH;
    
    @property({
        displayName: "是否循环播放"
    })
    isLoop: boolean = false;
    
    @property({
        displayName: "自动播放"
    })
    autoPlay: boolean = false;
    
    @property({
        displayName: "动画持续时间"
    })
    duration: number = 1.0;

    @property({
        displayName: "开始延迟时间"
    })
    startDelay: number = 0;
    
    @property({
        displayName: "循环间隔时间"
    })
    loopInterval: number = 0.5;
    
    // Punch动画参数
    @property({
        displayName: "Punch缩放值",
        visible: function() { return this.animationType === AnimationType.PUNCH; }
    })
    punchScale: number = 1.2;
    
    // Bounce动画参数
    @property({
        displayName: "弹跳高度",
        visible: function() { return this.animationType === AnimationType.BOUNCE; }
    })
    bounceHeight: number = 50;
    
    @property({
        displayName: "弹跳次数",
        visible: function() { return this.animationType === AnimationType.BOUNCE; }
    })
    bounceCount: number = 3;
    
    // 呼吸动画参数
    @property({
        displayName: "呼吸缩放值",
        visible: function() { return this.animationType === AnimationType.BREATHE || this.animationType === AnimationType.BREATHEGROUP; }
    })
    breatheScale: number = 1.1;
    
    // 摇摆动画参数
    @property({
        displayName: "摇摆角度",
        visible: function() { return this.animationType === AnimationType.SHAKE; }
    })
    shakeAngle: number = 10;
    
    @property({
        displayName: "摇摆次数",
        visible: function() { return this.animationType === AnimationType.SHAKE; }
    })
    shakeCount: number = 4;
    
    // 脉冲动画参数
    @property({
        displayName: "脉冲缩放值",
        visible: function() { return this.animationType === AnimationType.PULSE; }
    })
    pulseScale: number = 1.15;
    
    @property({
        displayName: "脉冲次数",
        visible: function() { return this.animationType === AnimationType.PULSE; }
    })
    pulseCount: number = 2;

    @property({
        displayName: "呼吸组间隔",
        visible: function() { return this.animationType === AnimationType.BREATHEGROUP; }
    })
    breatheGroupInterval: number = 2;
    
    @property({
        type: [Node],
        displayName: "呼吸组节点",
        visible: function() { return this.animationType === AnimationType.BREATHEGROUP; }
    })
    breatheGroupNodes: Node[] = [];

    @property({
        displayName: "通用缩放值",
        visible: function() { return this.animationType === AnimationType.SCALE_FADE_OUT; }
    })
    commonScale: number = 1;
    
    @property({
        displayName: "目标位置",
        visible: function() { return this.animationType === AnimationType.SIN; }
    })
    targetPosition: Vec3 = new Vec3(0, 0, 0);
    
    private currentTween: Tween<Node> | null = null;
    private isPlaying: boolean = false;
    private loopTimeoutId: any = null;

    public callBack: () => void = null!;

    onLoad() {
        if (!this.targetNode) {
            this.targetNode = this.node;
        }
    }

    start() {
        if (this.autoPlay) {
            if(this.startDelay > 0) {
                this.scheduleOnce(() => {
                    this.playAnimation();
                }, this.startDelay);
            }
            else
                this.playAnimation();
        }
    }

    /**
     * 播放动画
     */
    playAnimation() {
        if (this.isPlaying && !this.isLoop) {
            return;
        }

        this.stopAnimation();
        this.isPlaying = true;

        const onComplete = () => {
            this.isPlaying = false;
            if (this.isLoop) {
                this.scheduleLoop();
            }

            this.callBack?.();
        };

        switch (this.animationType) {
            case AnimationType.PUNCH:
                this.currentTween = AnimationLibrary.punch(this.targetNode, this.duration, this.punchScale, onComplete);
                break;
            case AnimationType.BOUNCE:
                this.currentTween = AnimationLibrary.bounce(this.targetNode, this.duration, this.bounceHeight, this.bounceCount, onComplete);
                break;
            case AnimationType.BREATHE:
                this.currentTween = AnimationLibrary.breathe(this.targetNode, this.duration, this.breatheScale, onComplete);
                break;
            case AnimationType.SHAKE:
                this.currentTween = AnimationLibrary.shake(this.targetNode, this.duration, this.shakeAngle, this.shakeCount, onComplete);
                break;
            case AnimationType.PULSE:
                this.currentTween = AnimationLibrary.pulse(this.targetNode, this.duration, this.pulseScale, this.pulseCount, onComplete);
                break;
            case AnimationType.FADE_IN:
                this.currentTween = AnimationLibrary.fadeIn(this.targetNode, this.duration, onComplete);
                break;
            case AnimationType.FADE_OUT:
                this.currentTween = AnimationLibrary.fadeOut(this.targetNode, this.duration, onComplete);
                break;
            case AnimationType.FADE_IN_OUT:
                this.currentTween = AnimationLibrary.fadeInOut(this.targetNode, this.duration, onComplete);
                break;
            case AnimationType.FLICKER:
                this.currentTween = AnimationLibrary.flicker(this.targetNode, this.duration, onComplete);
                break;
            case AnimationType.BREATHEGROUP:
                this.currentTween = AnimationLibrary.breatheGroup(this.targetNode, this.duration, this.breatheGroupInterval, this.breatheGroupNodes, this.breatheScale, onComplete);
                break;
            case AnimationType.SCALE_FADE_OUT:
                this.currentTween = AnimationLibrary.scaleFadeOut(this.targetNode, this.duration, this.commonScale, onComplete);
                break;
            case AnimationType.SCALE_FADE_IN:
                this.currentTween = AnimationLibrary.scaleFadeIn(this.targetNode, this.duration, this.commonScale, onComplete);
                break;
            case AnimationType.SIN:
                this.currentTween = AnimationLibrary.sin(this.targetNode, this.duration, this.targetPosition, onComplete);
                break;
        }

        if (this.currentTween) {
            this.currentTween.start();
        }
    }

    /**
     * 停止动画
     */
    stopAnimation() {
        if (this.currentTween) {
            this.currentTween.stop();
            this.currentTween = null;
        }
        
        if (this.loopTimeoutId) {
            clearTimeout(this.loopTimeoutId);
            this.loopTimeoutId = null;
        }
        
        this.isPlaying = false;
    }

    restartAnimation() {
        this.isPlaying = false;
        this.playAnimation();
    }

    /**
     * 暂停动画
     */
    pauseAnimation() {
        if (this.currentTween) {
            // Cocos Creator的tween没有直接的pause方法，所以通过停止来实现
            this.currentTween.stop();
        }
        this.isPlaying = false;
    }

    /**
     * 安排下一次循环
     */
    private scheduleLoop() {
        if (this.isLoop) {
            this.loopTimeoutId = setTimeout(() => {
                this.playAnimation();
            }, this.loopInterval * 1000);
        }
    }

    /**
     * 设置动画类型
     * @param type 动画类型
     */
    setAnimationType(type: AnimationType) {
        this.stopAnimation();
        this.animationType = type;
    }

    /**
     * 设置是否循环
     * @param loop 是否循环
     */
    setLoop(loop: boolean) {
        this.isLoop = loop;
        if (!loop) {
            this.stopAnimation();
        }
    }

    /**
     * 设置动画持续时间
     * @param duration 持续时间
     */
    setDuration(duration: number) {
        this.duration = duration;
    }

    /**
     * 获取动画播放状态
     * @returns 是否正在播放
     */
    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    onDestroy() {
        this.stopAnimation();
    }
}
