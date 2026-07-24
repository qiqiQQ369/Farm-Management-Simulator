import { Node, SkeletalAnimation, SkinnedMeshRenderer } from 'cc';

const LegacyHaulerVisualName = 'xiong_mario@skin';

export const HaulerAnimationName = {
    Idle: 'idle1_FuTou',
    Run: 'run2_FuTou',
} as const;

export function removePlayerOnlyVisual(root: Node): void {
    const playerVisual = root.getChildByName('PlayerVisual');
    if (!playerVisual) return;

    playerVisual.active = false;
    playerVisual.destroy();
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
