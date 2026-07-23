export const CUSTOMER_APPEARANCE_COUNT = 5;

/**
 * Builds independent shuffled bags so every complete group of five customers
 * contains each configured appearance exactly once.
 */
export function buildCustomerAppearanceOrder(
    customerCount: number,
    random: () => number = Math.random,
): number[] {
    const count = Math.max(0, Math.floor(customerCount));
    const result: number[] = [];

    while (result.length < count) {
        const bag = Array.from(
            { length: CUSTOMER_APPEARANCE_COUNT },
            (_, index) => index,
        );
        for (let index = bag.length - 1; index > 0; index--) {
            const value = Math.min(0.999999999, Math.max(0, random()));
            const randomIndex = Math.floor(value * (index + 1));
            [bag[index], bag[randomIndex]] = [bag[randomIndex], bag[index]];
        }
        result.push(...bag);
    }

    return result.slice(0, count);
}
