/**
 * Returns the first crop lane for the currently carried built-in resources.
 *
 * Wood needs the full two-lane clearance because a single 0.1-unit lane still
 * intersects the crop stack. Cash already occupies a separate mount, so cash
 * by itself only needs the original one-lane clearance.
 */
export function getFirstCropColumn(hasCoin: boolean, hasWood: boolean): number {
    if (hasWood) return 2;
    return hasCoin ? 1 : 0;
}
