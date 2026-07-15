import { _decorator, Component, Node, Vec3, AudioClip, AudioSource, SkeletalAnimation } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 砍伐动作控制器
 * 处理砍伐动作的视觉效果和音效
 */
@ccclass('ChopAction')
export class ChopAction extends Component {
    
    @property({ type: AudioClip, tooltip: "砍伐音效" })
    public chopSound: AudioClip = null!;
    
    @property({ type: AudioClip, tooltip: "砍伐完成音效" })
    public completeSound: AudioClip = null!;
    
    @property({ type: Node, tooltip: "特效节点" })
    public effectNode: Node = null!;
    
    @property({ tooltip: "动作持续时间" })
    public actionDuration: number = 0.5;

    @property({ type: SkeletalAnimation, tooltip: "骨骼动画" })
    public skeletonAnimation: SkeletalAnimation = null!;

    public chopingTreeNode: Node = null!;

    @property({ type: Node})
    public futouNode: Node = null!;
    
    // 私有属性
    private _audioSource: AudioSource = null!;
    private _isPlaying: boolean = false;

    protected onLoad(): void {
        this._audioSource = this.getComponent(AudioSource) || this.addComponent(AudioSource);
    }

    /**
     * 播放砍伐动作
     */
    public async playChopAction(targetPosition: Vec3): Promise<void> {
        if (this._isPlaying) return;
        
        this._isPlaying = true;
        if(this.futouNode)
            this.futouNode.active = true;
       
        if(this.skeletonAnimation != null){
            this.skeletonAnimation.play("KanMuTou");
            //this.skeletonAnimation.sockets[0].target.active = true;
            await new Promise(resolve => setTimeout(resolve, 300));
        }

         // 播放音效
         this.playChopSound();
        
         // 播放视觉效果
         this.playChopEffect(targetPosition);
        
        // Promise 只在动作真正结束后返回，供伐木工将一次挥斧与一次砍伐严格对应。
        await new Promise(resolve => setTimeout(resolve, 100));
        this._isPlaying = false;
        if(this.futouNode)
            this.futouNode.active = false;
        //this.skeletonAnimation.play("idle1");
    }

    /**
     * 播放砍伐完成动作
     */
    public playCompleteAction(): void {
        // 播放完成音效
        this.playCompleteSound();
        
        // 播放完成特效
        this.playCompleteEffect();
    }

    private playChopAnimation(): void {
        // if (animation) {
        //     animation.play();
        // }
    }

    /**
     * 播放砍伐音效
     */
    private playChopSound(): void {
        if (this.chopSound && this._audioSource) {
            this._audioSource.playOneShot(this.chopSound);
            console.log('playChopSound');
        }
    }

    /**
     * 播放完成音效
     */
    private playCompleteSound(): void {
        if (this.completeSound && this._audioSource) {
            this._audioSource.playOneShot(this.completeSound);
        }
    }

    /**
     * 播放砍伐特效
     */
    private playChopEffect(targetPosition: Vec3): void {
        if (this.effectNode) {
            this.effectNode.setPosition(targetPosition);
            this.effectNode.active = true;
            
            // 简单的特效动画
            this.scheduleOnce(() => {
                this.effectNode.active = false;
            }, 0.3);
        }
    }

    /**
     * 播放完成特效
     */
    private playCompleteEffect(): void {
        // 可以添加更复杂的完成特效
        console.log('播放砍伐完成特效');
    }

    public playIdleAnimation(): void {
        if(this.skeletonAnimation != null){
            this.skeletonAnimation.play("idle1_FuTou");
            if(this.futouNode)
                this.futouNode.active = false;
        }
    }

    /**
     * 检查是否在播放动作
     */
    public isPlaying(): boolean {
        return this._isPlaying;
    }
}
