export type CornHaulerAddPlan = {
    accepted: boolean;
    nextAmount: number;
    displayIncomingNode: boolean;
};

export type CornHaulerRemovePlan = {
    removed: boolean;
    nextAmount: number;
    createTransferNode: boolean;
};

export type CornHaulerStackPosition = {
    x: number;
    y: number;
    z: number;
};

export function planCornHaulerAdd(
    amount: number,
    capacity = 42,
    maxVisibleItems = 42,
): CornHaulerAddPlan {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount >= capacity) {
        return { accepted: false, nextAmount: safeAmount, displayIncomingNode: false };
    }

    return {
        accepted: true,
        nextAmount: safeAmount + 1,
        displayIncomingNode: safeAmount < maxVisibleItems,
    };
}

export function planCornHaulerRemove(
    amount: number,
    maxVisibleItems = 42,
): CornHaulerRemovePlan {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount === 0) {
        return { removed: false, nextAmount: 0, createTransferNode: false };
    }

    return {
        removed: true,
        nextAmount: safeAmount - 1,
        createTransferNode: safeAmount > maxVisibleItems,
    };
}

export function getCornHaulerVisibleCount(amount: number, maxVisibleItems = 42): number {
    return Math.min(
        Math.max(0, Math.floor(amount)),
        Math.max(0, Math.floor(maxVisibleItems)),
    );
}

export function getCornHaulerStackPosition(
    index: number,
    rowSpacing = 0.2,
    columnSpacing = 0.2,
    layerHeight = 0.2,
): CornHaulerStackPosition {
    return {
        x: -columnSpacing,
        y: Math.max(0, Math.floor(index)) * layerHeight,
        z: -rowSpacing,
    };
}
