export type CornTractorContactPoint = {
    x: number;
    y: number;
    z: number;
};

/** Tests a crop against the forest truck's thin, wide front cutter in local space. */
export function isCornTractorFrontContact(
    cropLocalPosition: CornTractorContactPoint,
    colliderCenter: CornTractorContactPoint,
    colliderSize: CornTractorContactPoint,
    padding = 0,
): boolean {
    const safePadding = Math.max(0, padding);
    return Math.abs(cropLocalPosition.x - colliderCenter.x) <= colliderSize.x * 0.5 + safePadding
        && Math.abs(cropLocalPosition.z - colliderCenter.z) <= colliderSize.z * 0.5 + safePadding;
}
