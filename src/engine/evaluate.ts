// Poker hand evaluator for 1 to 7 cards. Returns a score where a higher number is a better hand.
// Score layout: category << 20 | five 4-bit rank slots (most important first).
import { Card, rankName, rankPlural } from "./cards";

export const CATEGORY = [
  "High card",
  "Pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
] as const;

// STRAIGHT[mask] = rank of the top card of the best straight in a 13-bit rank mask, or -1.
const STRAIGHT = new Int8Array(8192).fill(-1);
for (let m = 0; m < 8192; m++) {
  for (let h = 12; h >= 4; h--) {
    const need = 0b11111 << (h - 4);
    if ((m & need) === need) {
      STRAIGHT[m] = h;
      break;
    }
  }
  if (STRAIGHT[m] < 0 && (m & 0b1000000001111) === 0b1000000001111) STRAIGHT[m] = 3; // A-2-3-4-5
}

const counts = new Uint8Array(13);
const suitMask = new Int32Array(4);
const suitCount = new Uint8Array(4);

/** Top k ranks of a mask, packed into slots starting at `shift` and moving down 4 bits each. */
function topRanks(mask: number, k: number, shift: number): number {
  let out = 0;
  while (k > 0 && mask) {
    const r = 31 - Math.clz32(mask);
    out |= r << shift;
    mask &= ~(1 << r);
    shift -= 4;
    k--;
  }
  return out;
}

export function evaluate(cards: ArrayLike<Card>, n: number = cards.length): number {
  let rankMask = 0;
  suitMask[0] = suitMask[1] = suitMask[2] = suitMask[3] = 0;
  suitCount[0] = suitCount[1] = suitCount[2] = suitCount[3] = 0;
  for (let i = 0; i < n; i++) {
    const c = cards[i];
    const r = c >> 2;
    const s = c & 3;
    counts[r]++;
    rankMask |= 1 << r;
    suitMask[s] |= 1 << r;
    suitCount[s]++;
  }

  let quad = -1;
  let trip1 = -1;
  let trip2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const k = counts[r];
    if (k === 0) continue;
    counts[r] = 0; // reset for the next call as we go
    if (k === 4) quad = r;
    else if (k === 3) {
      if (trip1 < 0) trip1 = r;
      else if (trip2 < 0) trip2 = r;
    } else if (k === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }

  // A flush with 7 or fewer cards rules out quads and full houses, so check it first.
  for (let s = 0; s < 4; s++) {
    if (suitCount[s] >= 5) {
      const sf = STRAIGHT[suitMask[s]];
      if (sf >= 0) return (8 << 20) | (sf << 16);
      return (5 << 20) | topRanks(suitMask[s], 5, 16);
    }
  }
  if (quad >= 0) return (7 << 20) | (quad << 16) | topRanks(rankMask & ~(1 << quad), 1, 12);
  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) {
    const second = Math.max(trip2, pair1);
    return (6 << 20) | (trip1 << 16) | (second << 12);
  }
  const st = STRAIGHT[rankMask];
  if (st >= 0) return (4 << 20) | (st << 16);
  if (trip1 >= 0) return (3 << 20) | (trip1 << 16) | topRanks(rankMask & ~(1 << trip1), 2, 12);
  if (pair2 >= 0) return (2 << 20) | (pair1 << 16) | (pair2 << 12) | topRanks(rankMask & ~(1 << pair1) & ~(1 << pair2), 1, 8);
  if (pair1 >= 0) return (1 << 20) | (pair1 << 16) | topRanks(rankMask & ~(1 << pair1), 3, 12);
  return topRanks(rankMask, 5, 16);
}

export const categoryOf = (score: number) => score >> 20;

/** Plain-language name for a hand score, e.g. "Two pair, kings and nines". */
export function describe(score: number): string {
  const cat = score >> 20;
  const a = (score >> 16) & 15;
  const b = (score >> 12) & 15;
  switch (cat) {
    case 8:
      return a === 12 ? "Royal flush" : `Straight flush, ${rankName(a)} high`;
    case 7:
      return `Four ${rankPlural(a)}`;
    case 6:
      return `Full house, ${rankPlural(a)} full of ${rankPlural(b)}`;
    case 5:
      return `Flush, ${rankName(a)} high`;
    case 4:
      return `Straight, ${rankName(a)} high`;
    case 3:
      return `Three ${rankPlural(a)}`;
    case 2:
      return `Two pair, ${rankPlural(a)} and ${rankPlural(b)}`;
    case 1:
      return `Pair of ${rankPlural(a)}`;
    default:
      return `${cap(rankName(a))} high`;
  }
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
