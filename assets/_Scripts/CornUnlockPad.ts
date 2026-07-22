import { _decorator, Component, find, Label, Node, Sprite, Vec3 } from 'cc';
import { CoinBackpack } from './CoinBackpack';

const { ccclass, property } = _decorator;

type MountedCoinStorage = Component & {
    amount: number;
    removeResourceWithAnimation: (target: Vec3, animation: string) => void;
};

export type CornUnlockPadConfig = {
    player: Node;
    coinBackpack: CoinBackpack;
    interactionNode: Node;
    cost: number;
    coinsPerTick: number;
    consumeInterval: number;
    onCompleted: () => void;
};

/** Independent corn-area equivalent of the forest purchase pad. */
@ccclass('CornUnlockPad')
export class CornUnlockPad extends Component {
    @property public cost = 0;
    @property public coinsPerTick = 5;
    @property public consumeInterval = 0.1;
    @property public interactionRadius = 1.6;

    private _player: Node | null = null;
    private _coinBackpack: CoinBackpack | null = null;
    private _interactionNode: Node | null = null;
    private _progress = 0;
    private _timer = 0;
    private _onCompleted: (() => void) | null = null;
    private _completed = false;

    public configure(config: CornUnlockPadConfig): void {
        this._player = config.player;
        this._coinBackpack = config.coinBackpack;
        this._interactionNode = config.interactionNode;
        this.cost = config.cost;
        this.coinsPerTick = config.coinsPerTick;
        this.consumeInterval = config.consumeInterval;
        this._progress = 0;
        this._timer = 0;
        this._completed = false;
        this._onCompleted = config.onCompleted;
        this.updateUI();
    }

    protected update(deltaTime: number): void {
        if (this._completed || !this._player || !this._coinBackpack) return;
        const interactionWorldPosition = this._interactionNode?.worldPosition ?? this.node.worldPosition;
        if (Vec3.distance(this._player.worldPosition, interactionWorldPosition) > this.interactionRadius) {
            this._timer = 0;
            return;
        }
        this._timer += deltaTime;
        if (this._timer < this.consumeInterval) return;
        this._timer = 0;

        const spentCoins = this.consumeCoins();
        if (spentCoins <= 0) return;
        this._progress = Math.min(this.cost, this._progress + spentCoins);
        this.updateUI();
        if (this._progress < this.cost) return;

        this._completed = true;
        this.enabled = false;
        this._onCompleted?.();
    }

    private consumeCoins(): number {
        const mountedCoinStorage = this._coinBackpack?.coinBackpackMount?.components.find(component => {
            const candidate = component as Partial<MountedCoinStorage>;
            return typeof candidate.amount === 'number' && typeof candidate.removeResourceWithAnimation === 'function';
        }) as MountedCoinStorage | undefined;
        if (mountedCoinStorage && mountedCoinStorage.amount > 0) {
            const interactionWorldPosition = this._interactionNode?.worldPosition ?? this.node.worldPosition;
            mountedCoinStorage.removeResourceWithAnimation(interactionWorldPosition, 'parabola');
            const label = find('Canvas/CoinLabel/coinAmount')?.getComponent(Label) ?? null;
            if (label) {
                const displayed = Number.parseInt(label.string, 10);
                if (Number.isFinite(displayed)) label.string = `${Math.max(0, displayed - this.coinsPerTick)}`;
            }
            return this.coinsPerTick;
        }

        const coins = this._coinBackpack?.getCoinCount() ?? 0;
        const spent = Math.min(this.coinsPerTick, coins);
        if (spent > 0) this._coinBackpack?.removeCoins(spent);
        return spent;
    }

    private updateUI(): void {
        const remaining = Math.max(0, this.cost - this._progress);
        const fillRange = this.cost > 0 ? this._progress / this.cost : 1;
        const visit = (node: Node): void => {
            const label = node.getComponent(Label);
            if (label && (node.name === 'amount' || /^\d+$/.test(label.string))) label.string = `${remaining}`;
            const sprite = node.getComponent(Sprite);
            if (sprite && sprite.type === Sprite.Type.FILLED) sprite.fillRange = fillRange;
            for (const child of node.children) visit(child);
        };
        visit(this.node);
    }
}
