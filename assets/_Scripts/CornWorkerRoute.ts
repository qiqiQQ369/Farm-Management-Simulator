export type CornRoutePoint = {
    x: number;
    y: number;
    z: number;
};

/** 计算当前行进方向下，工人应停在玉米正前方的位置。 */
export function getCornHarvestStandPosition(
    lane: CornRoutePoint[],
    targetIndex: number,
    direction: 1 | -1,
    standDistance: number,
): CornRoutePoint {
    const target = lane[targetIndex];
    if (!target) return { x: 0, y: 0, z: 0 };
    if (lane.length < 2) return { ...target };

    const neighborIndex = direction > 0
        ? Math.min(targetIndex + 1, lane.length - 1)
        : Math.max(targetIndex - 1, 0);
    const fromIndex = neighborIndex === targetIndex
        ? Math.max(0, Math.min(lane.length - 1, targetIndex - direction))
        : targetIndex;
    const from = lane[fromIndex];
    const to = lane[neighborIndex];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.000001) return { ...target };

    return {
        x: target.x - dx / length * standDistance,
        y: target.y,
        z: target.z - dz / length * standDistance,
    };
}

/** 沿直线移动，单帧步长不能越过目标站位。 */
export function moveCornWorkerToward(
    current: CornRoutePoint,
    target: CornRoutePoint,
    maxStep: number,
): CornRoutePoint {
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const dz = target.z - current.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 0.000001 || maxStep >= distance) return { ...target };

    const ratio = Math.max(0, maxStep) / distance;
    return {
        x: current.x + dx * ratio,
        y: current.y + dy * ratio,
        z: current.z + dz * ratio,
    };
}
