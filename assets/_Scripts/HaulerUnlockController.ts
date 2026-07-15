import { _decorator, Collider, Component, ITriggerEvent, Label, Node } from 'cc';
import { CoinBackpack } from './CoinBackpack';
import { PlayerController } from './PlayerController';
import { StoragePoint } from './Resource/StoragePoint';

const { ccclass, property } = _decorator;

@ccclass('HaulerUnlockController')
export class HaulerUnlockController extends Component {
    @property({ type: Node, tooltip: '已解锁后的拖拉机节点' })
    public tractorNode: Node = null!;

    @property({ type: Node, tooltip: '搬运工解锁地块' })
    public unlockPad: Node = null!;

    @property({ tooltip: '将解锁点定位到拖拉机解锁点的世界坐标' })
    public anchorToTractorUnlockPoint = true;

    @property({ type: Node, tooltip: '搬运工 NPC 节点' })
    public haulerNode: Node = null!;

    @property({ type: CoinBackpack, tooltip: '玩家金币背包' })
    public playerCoinBackpack: CoinBackpack = null!;

    @property({ type: Label, tooltip: '解锁地块剩余金币文本' })
    public remainingLabel: Label = null!;

    @property({ tooltip: '搬运工解锁费用' })
    public requiredCoins = 170;

    @property({ tooltip: '扣除金币间隔（秒）' })
    public consumeInterval = 0.15;

    private _remainingCoins = 0;
    private _playerInside = false;
    private _unlocked = false;
    private _consumeTimer = 0;

    protected onLoad(): void {
        this._remainingCoins = this.requiredCoins;
        this.unlockPad.active = false;
        this.haulerNode.active = false;
        this.updateLabel();

        const collider = this.unlockPad.getComponent(Collider);
        collider?.on('onTriggerEnter', this.onTriggerEnter, this);
        collider?.on('onTriggerExit', this.onTriggerExit, this);
    }

    protected onDestroy(): void {
        const collider = this.unlockPad?.getComponent(Collider);
        collider?.off('onTriggerEnter', this.onTriggerEnter, this);
        collider?.off('onTriggerExit', this.onTriggerExit, this);
    }

    protected update(deltaTime: number): void {
        if (!this._unlocked && !this.unlockPad.active && this.tractorNode.activeInHierarchy) {
            this.alignUnlockPadToTractor();
            this.unlockPad.active = true;
        }

        if (!this._playerInside || this._unlocked) return;

        this._consumeTimer += deltaTime;
        if (this._consumeTimer < this.consumeInterval) return;
        this._consumeTimer = 0;
        this.consumeCoin();
    }

    private onTriggerEnter(event: ITriggerEvent): void {
        if (this.isPlayer(event.otherCollider.node)) {
            this._playerInside = true;
        }
    }

    private onTriggerExit(event: ITriggerEvent): void {
        if (this.isPlayer(event.otherCollider.node)) {
            this._playerInside = false;
            this._consumeTimer = 0;
        }
    }

    private isPlayer(node: Node): boolean {
        return node.name === 'Player' || node.getComponent(PlayerController) !== null || node.parent?.getComponent(PlayerController) !== null;
    }

    private consumeCoin(): void {
        const storage = this.playerCoinBackpack?.coinBackpackMount?.getComponent(StoragePoint);
        if (!storage || storage.amount < 1) return;

        storage.removeResourceWithAnimation(this.unlockPad.worldPosition, 'parabola');
        this._remainingCoins = Math.max(0, this._remainingCoins - 5);
        this.updateLabel();

        if (this._remainingCoins === 0) {
            this.completeUnlock();
        }
    }

    private completeUnlock(): void {
        this._unlocked = true;
        this._playerInside = false;
        this.unlockPad.active = false;
        this.haulerNode.active = true;
    }

    /** 拖拉机解锁后，搬运工解锁点复用拖拉机解锁点的位置。 */
    private alignUnlockPadToTractor(): void {
        if (!this.anchorToTractorUnlockPoint || !this.tractorNode || !this.unlockPad) return;

        const tractorPosition = this.tractorNode.worldPosition;
        if (this.unlockPad.parent) {
            this.unlockPad.setWorldPosition(tractorPosition);
        } else {
            this.unlockPad.setPosition(tractorPosition);
        }
    }

    private updateLabel(): void {
        if (this.remainingLabel) {
            this.remainingLabel.string = `${this._remainingCoins}`;
        }
    }
}
