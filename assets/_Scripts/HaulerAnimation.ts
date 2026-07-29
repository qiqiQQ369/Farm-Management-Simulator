import {
    Color,
    instantiate,
    MeshRenderer,
    Node,
    SkeletalAnimation,
    SkinnedMeshRenderer,
    Vec3,
} from 'cc';
import { CustomerAppearanceRandomizer } from './CustomerAppearanceRandomizer';

const LegacyHaulerVisualName = 'xiong_mario@skin';
const PlayerOnlyVisualNames = [
    'PlayerVisual',
    'SM_割草机_Player',
    'SM_大型割草机_Player',
] as const;

export const HaulerAnimationName = {
    Idle: 'idle',
    Run: 'walk',
    CarryIdle: 'idle2_NaHeZi',
    CarryRun: 'walk_NaHeZi',
} as const;

/**
 * Presentation-only replacement for haulers.
 * Reuses the first configured male customer appearance so every hauler keeps
 * one fixed model and texture without touching its movement or transfer state.
 */
export function installFixedCustomerHaulerVisual(root: Node): SkeletalAnimation | null {
    const appearance = root.scene?.getComponentInChildren(CustomerAppearanceRandomizer) ?? null;
    const prefab = appearance?.malePrefab ?? null;
    const texture = appearance?.maleTextures[0] ?? null;
    if (!appearance || !prefab || !texture) {
        console.warn(`Hauler ${root.name}: fixed customer appearance is not configured`);
        return null;
    }

    for (const animation of root.getComponentsInChildren(SkeletalAnimation)) {
        if (animation.node !== root) animation.node.active = false;
    }

    const previousVisual = root.getChildByName('FixedCustomerHaulerVisual');
    if (previousVisual) {
        previousVisual.active = false;
        previousVisual.destroy();
    }

    const model = instantiate(appearance.malePrefab);
    model.name = 'FixedCustomerHaulerVisual';
    model.setParent(root);
    const rootScale = root.worldScale;
    const rootScaleX = Math.max(Math.abs(rootScale.x), 0.0001);
    const rootScaleY = Math.max(Math.abs(rootScale.y), 0.0001);
    const rootScaleZ = Math.max(Math.abs(rootScale.z), 0.0001);
    model.setPosition(0, -root.worldPosition.y / rootScaleY, 0);
    model.setRotationFromEuler(0, appearance.customerModelYaw, 0);
    model.setScale(
        appearance.customerModelScale / rootScaleX,
        appearance.customerModelScale / rootScaleY,
        appearance.customerModelScale / rootScaleZ,
    );

    for (const renderer of model.getComponentsInChildren(MeshRenderer)) {
        for (let index = 0; index < renderer.sharedMaterials.length; index++) {
            const material = renderer.getMaterialInstance(index);
            if (!material) continue;
            material.name = `${appearance.maleTextures[0].name}_HaulerMaterial`;
            material.recompileShaders({ USE_ALBEDO_MAP: true });
            material.setProperty('mainColor', Color.WHITE);
            material.setProperty('mainTexture', appearance.maleTextures[0]);
        }
    }

    const animation = model.getComponent(SkeletalAnimation)
        ?? model.getComponentInChildren(SkeletalAnimation);
    if (!animation) {
        console.warn(`Hauler ${root.name}: fixed customer model is missing SkeletalAnimation`);
    }
    return animation;
}

export function removePlayerOnlyVisual(root: Node): void {
    for (const visualName of PlayerOnlyVisualNames) {
        const visual = root.getChildByName(visualName);
        if (!visual) continue;
        visual.active = false;
        visual.setParent(null);
        visual.destroy();
    }
}

export function findLegacyHaulerAnimation(root: Node): SkeletalAnimation | null {
    const legacyVisual = findNode(root, LegacyHaulerVisualName);
    const animation = legacyVisual?.getComponent(SkeletalAnimation)
        ?? findLegacyAnimationComponent(root);
    if (!animation) return null;

    animation.enabled = true;
    animation.node.active = true;
    for (const renderer of findSkinRenderers(animation.node)) {
        renderer.enabled = true;
        activatePath(renderer.node, root);
    }
    return animation;
}

function findNode(root: Node, name: string): Node | null {
    if (root.name === name) return root;
    for (const child of root.children) {
        if (child.name === 'PlayerVisual') continue;
        const result = findNode(child, name);
        if (result) return result;
    }
    return null;
}

function findLegacyAnimationComponent(root: Node): SkeletalAnimation | null {
    const component = root.getComponent(SkeletalAnimation);
    if (component) return component;
    for (const child of root.children) {
        if (child.name === 'PlayerVisual') continue;
        const result = findLegacyAnimationComponent(child);
        if (result) return result;
    }
    return null;
}

function findSkinRenderers(root: Node): SkinnedMeshRenderer[] {
    const components = root.getComponents(SkinnedMeshRenderer);
    for (const child of root.children) {
        components.push(...findSkinRenderers(child));
    }
    return components;
}

function activatePath(node: Node, root: Node): void {
    let current: Node | null = node;
    while (current && current !== root) {
        current.active = true;
        current = current.parent;
    }
}
