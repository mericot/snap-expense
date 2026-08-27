import { describe, it, expect } from 'vitest'
import { planTiles, MAX_PX, MAX_TILES, TALL_RATIO } from './receipt-tiles'

/**
 * The fixture dimensions these assertions use are the real ones in
 * test-fixtures/receipts, and the expected tile counts are what
 * scripts/eval-extraction.mjs actually measured at 100% accuracy. If this file
 * starts failing, the app has stopped slicing the way the measurement was
 * taken and the baseline in BASELINE.md no longer describes it.
 */

const widthKept = (w: number, h: number) => planTiles(w, h)[0].outWidth / w

describe('planTiles', () => {
  it('leaves normal-ratio images on the old long-edge behaviour', () => {
    // receipt_hard_faded: 700x1200, ratio 1.71 — under the tall threshold
    expect(planTiles(700, 1200)).toEqual([
      { srcTop: 0, srcHeight: 1200, outWidth: 700, outHeight: 1200 },
    ])
    // receipt_hard_combo: 752x1230
    expect(planTiles(752, 1230)).toHaveLength(1)
  })

  it('still downscales a genuinely oversized normal-ratio image', () => {
    const [tile] = planTiles(4000, 3000)
    expect(Math.max(tile.outWidth, tile.outHeight)).toBe(MAX_PX)
  })

  it('slices tall receipts into the tile counts the eval measured', () => {
    expect(planTiles(700, 2040)).toHaveLength(2)  // receipt_verified, 15 items
    expect(planTiles(700, 2580)).toHaveLength(2)  // receipt_35items
    expect(planTiles(700, 3180)).toHaveLength(3)  // receipt_45items
    expect(planTiles(700, 3480)).toHaveLength(3)  // receipt_50items
    expect(planTiles(700, 4080)).toHaveLength(3)  // receipt_verified_v2, the failure case
  })

  it('keeps full width on the fixture that used to fail', () => {
    // This is the whole point: 700x4080 kept only 37% of its width under the
    // old long-edge rule, which is where the digit corruption came from.
    for (const tile of planTiles(700, 4080)) {
      expect(tile.outWidth).toBe(700)
      expect(tile.outHeight).toBeLessThanOrEqual(MAX_PX)
    }
    expect(widthKept(700, 4080)).toBe(1)
  })

  it('covers the whole image, with overlap and no gaps', () => {
    const height = 4080
    const tiles = planTiles(700, height)
    expect(tiles[0].srcTop).toBe(0)
    const last = tiles[tiles.length - 1]
    expect(last.srcTop + last.srcHeight).toBe(height)
    for (let i = 1; i < tiles.length; i++) {
      // next tile starts before the previous one ends — that is the overlap
      expect(tiles[i].srcTop).toBeLessThan(tiles[i - 1].srcTop + tiles[i - 1].srcHeight)
    }
  })

  it('never hands a region that runs off the bottom of the source', () => {
    for (const h of [2040, 3180, 4080, 9000, 30000]) {
      for (const tile of planTiles(700, h)) {
        expect(tile.srcTop).toBeGreaterThanOrEqual(0)
        expect(tile.srcTop + tile.srcHeight).toBeLessThanOrEqual(h)
        expect(tile.srcHeight).toBeGreaterThan(0)
      }
    }
  })

  it('never emits a tile over the long-edge budget, overlap included', () => {
    // The overlap is added to a tile's height, so sizing bands against MAX_PX
    // directly produced tiles of MAX_PX + overlap. Caught by 3000x12000.
    for (const [w, h] of [[700, 2040], [700, 4080], [3000, 12000], [700, 30000], [1200, 5000]]) {
      for (const tile of planTiles(w, h)) {
        expect(Math.max(tile.outWidth, tile.outHeight)).toBeLessThanOrEqual(MAX_PX)
      }
    }
  })

  it('caps tiles and trades width only once the ceiling is hit', () => {
    const absurd = planTiles(700, 30000)
    expect(absurd.length).toBeLessThanOrEqual(MAX_TILES)
    // still far better than the long-edge rule, which would leave 700*1500/30000 = 35px
    expect(absurd[0].outWidth).toBeGreaterThan(35)
  })

  it('scales width down when the image is wider than the budget', () => {
    for (const tile of planTiles(3000, 12000)) {
      expect(tile.outWidth).toBe(MAX_PX)
      expect(tile.outHeight).toBeLessThanOrEqual(MAX_PX)
    }
  })

  it('rejects nonsense dimensions rather than emitting a bad plan', () => {
    expect(() => planTiles(0, 100)).toThrow()
    expect(() => planTiles(100, -1)).toThrow()
  })

  it('treats the tall threshold as documented', () => {
    expect(planTiles(700, Math.floor(700 * TALL_RATIO))).toHaveLength(1)
    expect(planTiles(700, Math.ceil(700 * TALL_RATIO) + 100).length).toBeGreaterThan(1)
  })
})
