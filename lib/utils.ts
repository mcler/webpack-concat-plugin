/**
 * @param {string} string
 * @returns {string}
 */
export function ensureTrailingSlash(value: string): string {
    if (typeof value === 'string' && value.length && value.slice(-1) !== '/') {
        return `${value}/`;
    }

    return value;
}
