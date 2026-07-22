import {
    _decorator,
    Color,
    Component,
    MeshRenderer,
    Node,
    Prefab,
    SkeletalAnimation,
    Texture2D,
    Vec3,
    instantiate,
} from 'cc';
import { CornCustomerScheduler } from './CornCustomerScheduler';
import { CUSTOMER_APPEARANCE_COUNT, buildCustomerAppearanceOrder } from './CustomerAppearanceOrder';
import { NPCScheduler } from './NPCScheduler';

const { ccclass, executionOrder, property } = _decorator;

type CustomerAppearanceVariant = {
    prefab: Prefab;
    texture: Texture2D;
};

const REQUIRED_ANIMATION_CLIPS = [
    'idle',
    'walk',
    'idle2_NaHeZi',
    'walk_NaHeZi',
] as const;

/** Replaces only customer model visuals; queue, storage, emoji and purchase logic stay intact. */
@ccclass('CustomerAppearanceRandomizer')
@executionOrder(-100)
export class CustomerAppearanceRandomizer extends Component {
    @property({ type: Prefab }) public malePrefab: Prefab = null!;
    @property({ type: Prefab }) public femalePrefab: Prefab = null!;
    @property({ type: [Texture2D] }) public maleTextures: Texture2D[] = [];
    @property({ type: [Texture2D] }) public femaleTextures: Texture2D[] = [];
    @property public customerModelScale = 1.1;
    @property public customerModelYaw = 180;

    private _reportedInvalidConfiguration = false;
    private _reportedMissingAnimation = false;

    protected onEnable(): void {
        const customers = this.node.getComponent(NPCScheduler)?.npcs
            ?? this.node.getComponent(CornCustomerScheduler)?.npcs
            ?? [];
        const variants = this.buildVariants();
        if (!this.hasCompleteConfiguration(variants)) return;

        const order = buildCustomerAppearanceOrder(customers.length);
        customers.forEach((customer, index) => {
            const variant = variants[order[index]];
            if (customer?.isValid && variant) this.replaceVisual(customer, variant);
        });
    }

    private buildVariants(): CustomerAppearanceVariant[] {
        return [
            ...this.maleTextures.slice(0, 3).map(texture => ({
                prefab: this.malePrefab,
                texture,
            })),
            ...this.femaleTextures.slice(0, 2).map(texture => ({
                prefab: this.femalePrefab,
                texture,
            })),
        ];
    }

    private hasCompleteConfiguration(variants: CustomerAppearanceVariant[]): boolean {
        const isComplete = variants.length === CUSTOMER_APPEARANCE_COUNT
            && this.maleTextures.length === 3
            && this.femaleTextures.length === 2
            && variants.every(variant => !!variant.prefab
                && !!variant.texture);
        if (!isComplete && !this._reportedInvalidConfiguration) {
            console.error('CustomerAppearanceRandomizer: exactly three male and two female appearances are required.');
            this._reportedInvalidConfiguration = true;
        }
        return isComplete;
    }

    private replaceVisual(npc: Node, variant: CustomerAppearanceVariant): void {
        const existingVisuals = npc.children.filter(child =>
            child.name !== 'StoragePoint'
            && child.name !== 'emoji'
            && (child.getComponentInChildren(SkeletalAnimation)
                || child.getComponentInChildren(MeshRenderer)),
        );

        const model = instantiate(variant.prefab);
        model.name = 'RandomCustomerVisual';
        model.setParent(npc);
        model.setPosition(Vec3.ZERO);
        model.setRotationFromEuler(0, this.customerModelYaw, 0);
        model.setScale(
            this.customerModelScale,
            this.customerModelScale,
            this.customerModelScale,
        );
        model.updateWorldTransform();

        this.applyTexture(model, variant);
        this.validateAnimations(model);

        for (const existingVisual of existingVisuals) {
            if (!existingVisual?.isValid) continue;
            existingVisual.active = false;
            existingVisual.removeFromParent();
            existingVisual.destroy();
        }
    }

    private applyTexture(model: Node, variant: CustomerAppearanceVariant): void {
        for (const renderer of model.getComponentsInChildren(MeshRenderer)) {
            for (let materialIndex = 0; materialIndex < renderer.sharedMaterials.length; materialIndex++) {
                const material = renderer.getMaterialInstance(materialIndex);
                if (!material) continue;
                material.name = `${variant.texture.name}_CustomerMaterial`;
                material.recompileShaders({ USE_ALBEDO_MAP: true });
                material.setProperty('mainColor', Color.WHITE);
                material.setProperty('mainTexture', variant.texture);
            }
        }
    }

    private validateAnimations(model: Node): void {
        const animation = model.getComponentInChildren(SkeletalAnimation);
        const clipNames = new Set(animation?.clips.map(clip =>
            clip?.name.replace(/\.animation$/, ''),
        ) ?? []);
        const missing = REQUIRED_ANIMATION_CLIPS.filter(name => !clipNames.has(name));
        if (missing.length > 0 && !this._reportedMissingAnimation) {
            console.error(`CustomerAppearanceRandomizer: missing animation clips: ${missing.join(', ')}`);
            this._reportedMissingAnimation = true;
        }
    }

}
