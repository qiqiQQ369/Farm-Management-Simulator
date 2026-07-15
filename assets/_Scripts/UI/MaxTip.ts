import { _decorator, Component, Node, Sprite, Label, tween, Tween, Vec3, Color, find, Canvas, screen } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 背包满提示UI组件
 * 显示背包已满提示信息，支持渐隐渐显和往上飘动的动画
 */
@ccclass('MaxTip')
export class MaxTip extends Component {
    
    @property({ type: Sprite, tooltip: "提示背景精灵" })
    public tipBackground: Sprite = null!;
    
    @property({ type: Label, tooltip: "提示文本标签" })
    public tipLabel: Label = null!;
    
    @property({ tooltip: "提示文本内容" })
    public tipText: string = "背包已满！";
    
    @property({ tooltip: "淡入动画时间（秒）" })
    public fadeInDuration: number = 0.3;
    
    @property({ tooltip: "淡出动画时间（秒）" })
    public fadeOutDuration: number = 0.5;
    
    @property({ tooltip: "提示显示时间（秒）" })
    public showDuration: number = 2.0;
    
    @property({ tooltip: "向上飘动距离" })
    public floatDistance: number = 100;
    
    @property({ tooltip: "是否自动隐藏" })
    public autoHide: boolean = true;

    @property
    public fixable: boolean = false;

    private showInterval: number = 0;
    
    // 静态实例，方便全局访问
    public static instance: MaxTip | null = null;
    
    // 私有属性
    private _isVisible: boolean = false;
    private _fadeTween: Tween<Node> | null = null;
    private _floatTween: Tween<Node> | null = null;
    private _autoHideTimer: number = 0;
    private _originalColor: Color = new Color();
    private _originalLabelColor: Color = new Color();
    private _originalPosition: Vec3 = new Vec3();

    private _initScale: Vec3;
    
    protected onLoad(): void {

        this._initScale = this.node.scale.clone();
        this.onWindowResize();

        screen.on('window-resize', this.onWindowResize, this);

        this.setupComponents();
        this.setupInitialState();
        
        // 设置静态实例
        MaxTip.instance = this;
    }

    protected onEnable(): void {
        this.onWindowResize();
    }

    private onWindowResize(){
        if(!this.fixable){
            let divceRatio = window.innerWidth / window.innerHeight;

            // var designRatio = 720 / 1280;
            // var scale = designRatio / divceRatio;
            // var scale = innerWidth / 720;
            var scale = divceRatio;
            console.log("fix maxtip: " + scale + " " + divceRatio)
            if(divceRatio < 1) return;
            // var canvasScale = find("Canvas").scale.x;
            this.node.scale = this._initScale.clone().divide(new Vec3(scale, scale, scale));
        }
    }
    
    protected onDestroy(): void {
        if (MaxTip.instance === this) {
            MaxTip.instance = null;
        }
        this.stopAllAnimations();
    }
    
    protected update(deltaTime: number): void {
        if (this.autoHide && this._isVisible) {
            this._autoHideTimer += deltaTime;
            this.showInterval += deltaTime;
            if (this._autoHideTimer >= this.showDuration) {
                this.hide();
            }
        }
    }
    
    /**
     * 设置组件引用
     */
    private setupComponents(): void {
        if (!this.tipBackground) {
            this.tipBackground = this.getComponent(Sprite);
        }
        
        if (!this.tipLabel) {
            this.tipLabel = this.getComponentInChildren(Label);
        }
        
        if (this.tipBackground) {
            this._originalColor = this.tipBackground.color.clone();
        }
        
        if (this.tipLabel) {
            this._originalLabelColor = this.tipLabel.color.clone();
        }
    }
    
    /**
     * 设置初始状态
     */
    private setupInitialState(): void {
        this.node.active = false;
        this._originalPosition.set(this.node.position);
        
        if (this.tipLabel && this.tipText) {
            this.tipLabel.string = this.tipText;
        }
    }
    
    /**
     * 显示提示
     */
    public show(): void {
        if(this._isVisible && this.showInterval < 3) 
            return;

        if (this._isVisible) {
            // 如果已经在显示，重置计时器
            //this._autoHideTimer = 0;
            this.showInterval = 0;
            return;
        }

        //console.error('showMaxTip');
        
        this.node.active = true;
        this._isVisible = true;
        this._autoHideTimer = 0;
        this.showInterval = 0;

        
        // 重置位置
        this.node.setPosition(this._originalPosition);
        
        this.playShowAnimation();
    }
    
    /**
     * 隐藏提示
     */
    public hide(): void {
        if (!this._isVisible) return;
        //console.log('hideMaxTip');
        this._autoHideTimer = 0;
        this.playHideAnimation();
    }
    
    /**
     * 播放显示动画
     */
    private playShowAnimation(): void {
        this.stopAllAnimations();
        
        // 设置初始状态
        this.setAlpha(0);
        
        // 淡入动画
        this._fadeTween = tween(this.node)
            .to(this.fadeInDuration, {}, {
                onUpdate: (target, ratio) => {
                    this.setAlpha(ratio);
                },
                easing: 'sineOut'
            })
            .start();
        
        // 向上飘动动画
        const targetPosition = new Vec3(
            this._originalPosition.x,
            this._originalPosition.y + this.floatDistance,
            this._originalPosition.z
        );
        
        this._floatTween = tween(this.node)
            .to(this.fadeInDuration + this.showDuration + this.fadeOutDuration, {
                position: targetPosition
            }, {
                easing: 'sineOut'
            })
            .start();
    }
    
    /**
     * 播放隐藏动画
     */
    private playHideAnimation(): void {
        if (this._fadeTween) {
            this._fadeTween.stop();
        }
        
        // 淡出动画
        this._fadeTween = tween(this.node)
            .to(this.fadeOutDuration, {}, {
                onUpdate: (target, ratio) => {
                    this.setAlpha(1 - ratio);
                },
                easing: 'sineIn'
            })
            .call(() => {
                this.node.active = false;
                this._isVisible = false;
                this.resetPosition();
            })
            .start();
    }
    
    /**
     * 设置透明度
     */
    private setAlpha(alpha: number): void {
        if (this.tipBackground) {
            const color = this.tipBackground.color.clone();
            color.a = this._originalColor.a * alpha;
            this.tipBackground.color = color;
        }
        
        if (this.tipLabel) {
            const color = this.tipLabel.color.clone();
            color.a = this._originalLabelColor.a * alpha;
            this.tipLabel.color = color;
        }
    }
    
    /**
     * 重置位置
     */
    private resetPosition(): void {
        this.node.setPosition(this._originalPosition);
    }
    
    /**
     * 停止所有动画
     */
    private stopAllAnimations(): void {
        if (this._fadeTween) {
            this._fadeTween.stop();
            this._fadeTween = null;
        }
        
        if (this._floatTween) {
            this._floatTween.stop();
            this._floatTween = null;
        }
    }
    
    /**
     * 设置提示文本
     */
    public setTipText(text: string): void {
        this.tipText = text;
        if (this.tipLabel) {
            this.tipLabel.string = text;
        }
    }
    
    /**
     * 设置显示时间
     */
    public setShowDuration(duration: number): void {
        this.showDuration = duration;
    }
    
    /**
     * 强制隐藏（跳过动画）
     */
    public forceHide(): void {
        this.stopAllAnimations();
        this.node.active = false;
        this._isVisible = false;
        this._autoHideTimer = 0;
        this.resetPosition();
    }
    
    /**
     * 静态方法：显示背包满提示
     */
    public static showMaxTip(text?: string): void {
        if (MaxTip.instance) {
            if (text) {
                MaxTip.instance.setTipText(text);
            }
            MaxTip.instance.show();
        } else {
            console.warn('MaxTip实例未找到，请确保已在场景中添加MaxTip组件');
        }
    }
    
    /**
     * 静态方法：隐藏背包满提示
     */
    public static hideMaxTip(): void {
        if (MaxTip.instance) {
            MaxTip.instance.hide();
        }
    }
}
