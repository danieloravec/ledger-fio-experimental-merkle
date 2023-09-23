export const findNextPowerOfTwo = (n: number) => {
    let k = 1;
    while (k < n) {
        k *= 2;
    }
    return k;
}

//calculates the length of varint
export function lenlen(n: number): number {
    return 1 + (n >= 128 ? 1 : 0) + (n >= 16384 ? 1 : 0) + (n >= 2097152 ? 1 : 0) + (n >= 268435456 ? 1 : 0)
}
