// Cards are integers 0..51: rank = c >> 2 (0 = deuce .. 12 = ace), suit = c & 3.
export type Card = number;

export const RANKS = "23456789TJQKA";
export const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANK_NAME = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
const RANK_PLURAL = ["twos", "threes", "fours", "fives", "sixes", "sevens", "eights", "nines", "tens", "jacks", "queens", "kings", "aces"];

export const rankOf = (c: Card) => c >> 2;
export const suitOf = (c: Card) => c & 3;
export const isRed = (c: Card) => (c & 3) === 1 || (c & 3) === 2;
export const rankName = (r: number) => RANK_NAME[r];
export const rankPlural = (r: number) => RANK_PLURAL[r];

/** Display rank: "10" for tens, otherwise the single letter. */
export const rankLabel = (c: Card) => (rankOf(c) === 8 ? "10" : RANKS[rankOf(c)]);
export const cardLabel = (c: Card) => rankLabel(c) + SUITS[suitOf(c)];
export const cardFromLabel = (s: string): Card => {
  const r = RANKS.indexOf(s[0] === "1" ? "T" : s[0]);
  const su = SUITS.indexOf(s.slice(s[0] === "1" ? 2 : 1) as (typeof SUITS)[number]);
  if (r < 0 || su < 0) throw new Error(`bad card ${s}`);
  return r * 4 + su;
};

/** A fresh 52-card deck shuffled with crypto randomness (Fisher-Yates). */
export function shuffledDeck(): Card[] {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function randomInt(n: number): number {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    // rejection sampling keeps it unbiased
    const buf = new Uint32Array(1);
    const lim = Math.floor(0x100000000 / n) * n;
    for (;;) {
      c.getRandomValues(buf);
      if (buf[0] < lim) return buf[0] % n;
    }
  }
  return Math.floor(Math.random() * n);
}

/** Starting-hand class: "AA", "AKs", "AKo". */
export function handClass(a: Card, b: Card): string {
  const ra = rankOf(a);
  const rb = rankOf(b);
  const hi = Math.max(ra, rb);
  const lo = Math.min(ra, rb);
  if (hi === lo) return RANKS[hi] + RANKS[lo];
  return RANKS[hi] + RANKS[lo] + (suitOf(a) === suitOf(b) ? "s" : "o");
}
