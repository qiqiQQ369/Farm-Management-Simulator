import { Animation, Node, Renderer } from 'cc';

/**
 * Restores renderable branches after cloning or reparenting corn-area objects.
 * Release scene serialization can preserve inactive visual descendants from
 * their source templates even though the runtime root is activated later.
 */
export function restoreCornVisualHierarchy(root: Node): void {
    const restoreBranch = (node: Node): boolean => {
        let containsVisual = node.components.some(component =>
            component instanceof Animation || component instanceof Renderer,
        );
        for (const child of node.children) {
            containsVisual = restoreBranch(child) || containsVisual;
        }
        if (containsVisual) node.active = true;
        return containsVisual;
    };

    root.active = true;
    restoreBranch(root);
}
