let _counter = 0;
export const uid = (): string => `r${++_counter}`;
export const parseNum = (s: string): number => parseFloat(s) || 0;

const _fmt = new Intl.NumberFormat('id-ID');
export const formatRp = (n: number): string => 'Rp ' + _fmt.format(Math.round(n));
