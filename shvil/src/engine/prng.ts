/** Seeded PRNG (mulberry32) and helpers. Everything random in Shvil goes through here. */

/** 32-bit FNV-1a hash of a string, used to turn seeds like "2026-11-04" into numbers. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  next(): number; // [0,1)
  int(n: number): number; // [0,n)
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  sample<T>(arr: readonly T[], k: number): T[];
}

export function rng(seed: number | string): Rng {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const shuffle = <T>(arr: readonly T[]): T[] => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  return {
    next,
    int,
    pick: <T>(arr: readonly T[]) => {
      if (arr.length === 0) throw new Error('pick from empty array');
      return arr[int(arr.length)]!;
    },
    shuffle,
    sample: <T>(arr: readonly T[], k: number) => shuffle(arr).slice(0, k),
  };
}
