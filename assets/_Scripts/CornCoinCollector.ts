import {
    _decorator,
    Collider,
    Component,
    find,
    ITriggerEvent,
    Label,
    Node,
    Vec3,
} from 'cc';
import { CoinBackpack } from './CoinBackpack';
import { CornStoragePoint } from './CornStoragePoint';
import { PlayerController } from './PlayerController';

const { ccclass, property } = _decorator;

type StorageLike = Component & {
    amount: number;
    capacity: number;
    addResource: (
        resource: Node,
        animationType?: number,
        rotation?: Vec3,
        removeFromParent?: boolean,
    ) => boolean;
};

/** 玉米区独立金币收集器，不依赖森林金币收集脚本。 */
@ccclass('CornCoinCollector')
export class CornCoinCollector extends Component {
    @property({ type: Node }) public coinLoadArea: Node = null!;
    @property public collectInterval = 0.05;
    @property public collectAnimationTime = 0.05;
    @property public coinFlyHeight = 2;

    private _sourceStorage: CornStoragePoint | null = null;
    private _playerCoinBackpack: CoinBackpack | null = null;
    private _isPlayerInArea = false;
    private _collectTimer = 0;

    protected onLoad(): void {
        this.resolvePlayerCoinBackpack();
    }

    protected onEnable(): void {
        const collider = this.node.getComponent(Collider);
        collider?.on('onTriggerEnter', this.onPlayerEnter, this);
        collider?.on('onTriggerExit', this.onPlayerExit, this);
    }

    protected onDisable(): void {
        const collider = this.node.getComponent(Collider);
        collider?.off('onTriggerEnter', this.onPlayerEnter, this);
        collider?.off('onTriggerExit', this.onPlayerExit, this);
        this._isPlayerInArea = false;
        this._collectTimer = 0;
    }

    protected update(deltaTime: number): void {
        if (!this._isPlayerInArea) return;
        this._collectTimer += deltaTime;
        if (this._collectTimer < this.collectInterval) return;
        this._collectTimer = 0;
        this.collectCoin();
    }

    public configure(sourceStorage: CornStoragePoint, coinLoadArea: Node): void {
        this._sourceStorage = sourceStorage;
        this.coinLoadArea = coinLoadArea;
        this.resolvePlayerCoinBackpack();
    }

    private resolvePlayerCoinBackpack(): void {
        if (this._playerCoinBackpack?.node?.isValid) return;
        this._playerCoinBackpack = this.node.scene?.getComponentInChildren(CoinBackpack) ?? null;
    }

    private onPlayerEnter(event: ITriggerEvent): void {
        if (!this.isPlayerNode(event.otherCollider.node)) return;
        this._isPlayerInArea = true;
        this._collectTimer = 0;
    }

    private onPlayerExit(event: ITriggerEvent): void {
        if (!this.isPlayerNode(event.otherCollider.node)) return;
        this._isPlayerInArea = false;
        this._collectTimer = 0;
    }

    private isPlayerNode(node: Node): boolean {
        return node.name === 'Player'
            || node.getComponent(PlayerController) !== null
            || node.parent?.name === 'Player';
    }

    private findPlayerStorage(): StorageLike | null {
        this.resolvePlayerCoinBackpack();
        const backpackMount = this._playerCoinBackpack?.coinBackpackMount ?? null;
        if (!backpackMount) return null;

        for (const component of backpackMount.components) {
            const candidate = component as StorageLike;
            if (
                typeof candidate.amount === 'number'
                && typeof candidate.capacity === 'number'
                && typeof candidate.addResource === 'function'
            ) {
                return candidate;
            }
        }
        return null;
    }

    private collectCoin(): void {
        const sourceStorage = this._sourceStorage;
        const destination = this.findPlayerStorage();
        if (!sourceStorage || !destination || !destination.node?.isValid) return;

        const nextCoin = this.coinLoadArea?.children[this.coinLoadArea.children.length - 1] ?? null;
        if (!nextCoin || nextCoin.scale.lengthSqr() < 2.7) return;

        const coin = sourceStorage.removeResource(4);
        if (!coin) return;
        if (!destination.addResource(coin, 4, new Vec3(0, 0, 360), false)) {
            sourceStorage.addResource(coin, 1);
            return;
        }

        const coinAmountLabel = find('Canvas/CoinLabel/coinAmount')?.getComponent(Label) ?? null;
        if (coinAmountLabel) {
            const currentAmount = Number.parseInt(coinAmountLabel.string, 10) || 0;
            coinAmountLabel.string = String(currentAmount + 5);
        }
    }
}
