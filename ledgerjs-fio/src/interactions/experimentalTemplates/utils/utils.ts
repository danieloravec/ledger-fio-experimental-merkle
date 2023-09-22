export const findNextPowerOfTwo = (n: number) => {
    let k = 1;
    while (k < n) {
        k *= 2;
    }
    return k;
}