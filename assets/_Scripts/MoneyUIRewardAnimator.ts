import { _decorator, Component, find, Node, tween, Tween, Vec3 } from 'cc';

const { ccclass } = _decorator;

/** 每次获得金钱时，为整个钱 UI 播放可连续触发的缩放回弹动效。 */
@ccclass('MoneyUIRewardAnimator')
export class MoneyUIRewardAnimator extends Component {
    private readonly _baseScale = new Vec3();
    private readonly _punchScale = new Vec3();
    private _rewardTween: Tween<Node> | null = null;

    protected onLoad(): void {
        this._baseScale.set(this.node.scale);
    }

    protected onDisable(): void {
        this.stopAndRestore();
    }

    protected onDestroy(): void {
        this.stopAndRestore();
    }

    public static playForCurrentScene(): void {
        const moneyUI = find('Canvas/CoinLabel');
        if (!moneyUI?.isValid) return;

        const animator = moneyUI.getComponent(MoneyUIRewardAnimator)
            ?? moneyUI.addComponent(MoneyUIRewardAnimator);
        animator.play();
    }

    public play(): void {
        if (!this.node.isValid) return;

        this._rewardTween?.stop();
        this.node.setScale(this._baseScale);
        Vec3.multiplyScalar(this._punchScale, this._baseScale, 1.2);

        this._rewardTween = tween(this.node)
            .to(0.1, { scale: this._punchScale }, { easing: 'quadOut' })
            .to(0.15, { scale: this._baseScale }, { easing: 'backOut' })
            .call(() => {
                this._rewardTween = null;
                this.node.setScale(this._baseScale);
            })
            .start();
    }

    private stopAndRestore(): void {
        this._rewardTween?.stop();
        this._rewardTween = null;
        if (this.node.isValid) this.node.setScale(this._baseScale);
    }
}
