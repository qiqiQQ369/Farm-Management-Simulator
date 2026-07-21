import { _decorator, AudioSource, Component, Node, Quat, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

type StoredCorn = {
    position: Vec3;
    node: Node;
    canMove: boolean;
};

/** Independent corn-area equivalent of the forest stack storage. */
@ccclass('CornStoragePoint')
export class CornStoragePoint extends Component {
    @property public storageName = 'corn_storage';
    @property public autoStack = true;
    @property public showCapacityInfo = true;
    @property public capacity = 0;
    @property public amount = 0;
    @property public layers = 10;
    @property public layerHeight = 0.2;
    @property public resourcePerRow = 5;
    @property public resourceRowSpacing = 0.2;
    @property public resourcePerCol = 5;
    @property public resourceColSpacing = 0.2;
    @property({ type: Node }) public stackAreaNode: Node = null!;
    @property public moveAnimationDuration = 1.0;
    @property public fadeAnimationDuration = 0.5;
    @property public moveEasing = 'sineOut';
    @property public fadeEasing = 'sineIn';
    @property public checkOffset = false;
    @property public audioInterval = 0.2;

    private readonly _resources = new Map<number, StoredCorn>();
    private readonly _removed = new Map<number, StoredCorn>();
    private _canPlayAudio = true;

    protected onLoad(): void {
        if (!this.stackAreaNode) this.stackAreaNode = this.node;
    }

    public hasSpace(requiredCapacity: number): boolean {
        return this.amount + requiredCapacity <= this.capacity;
    }

    public getAvailableSpace(): number {
        return this.capacity - this.amount;
    }

    public addResource(resource: Node, animationType = 1, rotation: Vec3 = Vec3.ZERO): boolean {
        if (!resource?.isValid || !this.hasSpace(1)) return false;

        const index = this.takeFirstRemovedIndex() ?? this.amount;
        const position = this.calculateStackPosition(index);
        const startWorldPosition = resource.worldPosition.clone();
        const stored: StoredCorn = {
            position,
            node: resource,
            canMove: animationType < 1 || animationType > 4,
        };
        this._resources.set(index, stored);
        resource.setParent(this.stackAreaNode);
        resource.setWorldPosition(startWorldPosition);
        this.amount++;

        if (animationType === 1) {
            resource.setPosition(position);
            const heightPosition = position.clone();
            heightPosition.y += 0.5;
            resource.setPosition(heightPosition);
            tween(resource)
                .to(0.1, { position }, { easing: 'bounceOut' })
                .call(() => {
                    const current = this._resources.get(index);
                    if (current) current.canMove = true;
                    this.playAudio();
                })
                .start();
        } else if (animationType === 2) {
            const heightPosition = position.clone();
            heightPosition.y += 3;
            tween(resource)
                .to(0.3, { position: heightPosition }, { easing: 'linear' })
                .call(() => resource.rotation = new Quat())
                .to(0.5, { position }, { easing: 'bounceOut' })
                .call(() => {
                    resource.setPosition(position);
                    const current = this._resources.get(index);
                    if (current) current.canMove = true;
                    this.playAudio();
                })
                .start();
        } else if (animationType === 3) {
            const heightPosition = position.clone();
            heightPosition.y += 6;
            heightPosition.z -= 1;
            const randomOffset = (Math.random() - 0.5) * 2;
            heightPosition.x += randomOffset;
            heightPosition.z += randomOffset;
            resource.setRotationFromEuler(
                Math.random() * 360,
                Math.random() * 360,
                Math.random() * 360,
            );
            tween(resource)
                .parallel(
                    tween().to(0.3, { position: heightPosition }, { easing: 'quadOut' }),
                    tween().by(0.2, { eulerAngles: new Vec3(180, 360, 90) }),
                )
                .delay(0.06)
                .parallel(
                    tween().to(0.6, { position }, { easing: 'bounceOut' }),
                    tween().by(0.6, { eulerAngles: new Vec3(360, 180, 270) }),
                )
                .call(() => {
                    resource.setPosition(position);
                    resource.rotation = new Quat();
                    const current = this._resources.get(index);
                    if (current) current.canMove = true;
                    this.playAudio();
                })
                .start();
        } else if (animationType === 4) {
            const startPosition = resource.position.clone();
            const controlPoint = new Vec3();
            Vec3.lerp(controlPoint, startPosition, position, 0.5);
            const distance = Vec3.distance(startPosition, position);
            controlPoint.y += Math.max(1.5, distance * 0.6);
            const direction = new Vec3();
            Vec3.subtract(direction, position, startPosition);
            const perpendicular = new Vec3(-direction.z, 0, direction.x);
            if (perpendicular.lengthSqr() > 0.000001) {
                Vec3.normalize(perpendicular, perpendicular);
                Vec3.scaleAndAdd(controlPoint, controlPoint, perpendicular, distance * 0.2);
            }
            const originalScale = resource.scale.clone();
            const raisedScale = originalScale.clone().multiplyScalar(1.17);
            const halfRotation = rotation.clone().multiplyScalar(0.5);
            tween(resource)
                .to(0.15, { position: controlPoint, eulerAngles: halfRotation }, { easing: 'sineOut' })
                .to(0.15, { position, eulerAngles: rotation }, { easing: 'sineIn' })
                .call(() => {
                    resource.setPosition(position);
                    resource.rotation = new Quat();
                })
                .to(0.1, { scale: raisedScale }, { easing: 'bounceOut' })
                .to(0.2, { scale: originalScale }, { easing: 'bounceOut' })
                .call(() => {
                    const current = this._resources.get(index);
                    if (current) current.canMove = true;
                    this.playAudio();
                })
                .start();
        } else {
            resource.setPosition(position);
            resource.setRotationFromEuler(rotation);
        }
        return true;
    }

    public removeResource(animationType = 1): Node | null {
        if (this.amount < 1) return null;

        let key: number | null = null;
        if (animationType === 4) {
            for (const candidate of [...this._resources.keys()].sort((left, right) => right - left)) {
                if (this._resources.get(candidate)?.canMove) {
                    key = candidate;
                    break;
                }
            }
        } else {
            key = [...this._resources.keys()].sort((left, right) => right - left)[0] ?? null;
        }
        if (key === null) return null;

        const stored = this._resources.get(key) ?? null;
        if (!stored?.node?.isValid) {
            this._resources.delete(key);
            this.amount = Math.max(0, this.amount - 1);
            return null;
        }

        this._resources.delete(key);
        this._removed.set(key, stored);
        this.amount = Math.max(0, this.amount - 1);
        return stored.node;
    }

    public hasMovableResource(): boolean {
        return [...this._resources.values()].some(resource => resource.canMove && resource.node?.isValid);
    }

    public recoverInterruptedTransfers(): void {
        const stackArea = this.stackAreaNode ?? this.node;
        const resources = [...stackArea.children].filter(resource => resource?.isValid);
        this._resources.clear();
        this._removed.clear();

        resources.forEach((resource, index) => {
            const position = this.calculateStackPosition(index);
            resource.setParent(stackArea);
            resource.setPosition(position);
            resource.setRotationFromEuler(Vec3.ZERO);
            this._resources.set(index, { position, node: resource, canMove: true });
        });
        this.amount = resources.length;
    }

    public releaseStalledResource(): Node | null {
        const key = [...this._resources.keys()].sort((left, right) => right - left)[0] ?? null;
        if (key === null) {
            this.amount = Math.min(this.amount, this.stackAreaNode?.children.length ?? 0);
            return null;
        }
        const stored = this._resources.get(key) ?? null;
        this._resources.delete(key);
        if (!stored?.node?.isValid) {
            this.amount = Math.max(0, this.amount - 1);
            return null;
        }
        this._removed.set(key, stored);
        this.amount = Math.max(0, this.amount - 1);
        return stored.node;
    }

    public clearStorage(): void {
        for (const resource of [...this._resources.values()]) resource.node?.destroy();
        for (const resource of [...this._removed.values()]) resource.node?.destroy();
        this._resources.clear();
        this._removed.clear();
        this.amount = 0;
    }

    private takeFirstRemovedIndex(): number | null {
        const key = [...this._removed.keys()].sort((left, right) => left - right)[0] ?? null;
        if (key !== null) this._removed.delete(key);
        return key;
    }

    private calculateStackPosition(index: number): Vec3 {
        const perLayer = this.resourcePerRow * this.resourcePerCol;
        const layer = Math.floor(index / perLayer);
        const positionInLayer = index % perLayer;
        const row = Math.floor(positionInLayer / this.resourcePerRow);
        const col = positionInLayer % this.resourcePerRow;
        return new Vec3(
            (col - 1) * this.resourceRowSpacing,
            layer * this.layerHeight,
            (row - 1) * this.resourceColSpacing,
        );
    }

    private playAudio(): void {
        if (!this._canPlayAudio) return;
        const audioSource = (this.stackAreaNode ?? this.node).getComponent(AudioSource);
        if (!audioSource?.clip) return;

        audioSource.playOneShot(audioSource.clip);
        this._canPlayAudio = false;
        this.scheduleOnce(() => this._canPlayAudio = true, Math.max(0, this.audioInterval));
    }
}
