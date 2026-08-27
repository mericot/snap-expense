/**
 * Tile geometry for receipt images.
 *
 * ## Why this exists
 *
 * The uploader used to scale every photo so its *long* edge was 1500px. A
 * receipt is a tall, narrow strip, so that capped the height and crushed the
 * width — the dimension the digits actually live in. Measured on the fixture
 * set, a 700px-wide receipt kept 73% of its width at 15 line items and only
 * 37% at 60, and the model started reading the leading `$` as a digit:
 * `$10035.62` came back as `110035.02`, `$590.33` as `8590.33`.
 *
 * Raising the cap does not help. Claude downscales anything over ~1568px on
 * the long edge, so a 700x4080 receipt arrives at roughly 269x1568 however it
 * is sent. Preserving horizontal resolution on a tall document means slicing
 * it, so each piece fits the long-edge budget without the width paying for it.
 *
 * The geometry lives here, apart from any rendering, because two callers need
 * to agree on it: the browser (canvas, in receipts/page.tsx) and the server
 * (sharp, for the HEIC path in api/extract/route.ts). They draw differently;
 * they must slice identically.
 */

/** Long-edge budget for any single image sent to the model. */
export const MAX_PX = 1500

/** Above this height/width ratio an image is treated as a tall receipt. */
export const TALL_RATIO = 2.2

/**
 * Ceiling on tiles per receipt. Input tokens scale with pixel area, so this is
 * the cost brake: past six the image is scaled down further rather than
 * sliced finer.
 */
export const MAX_TILES = 6

/**
 * Vertical overlap between neighbouring tiles, as a fraction of tile height.
 * A total sitting exactly on a cut would otherwise be split across two images
 * with half its glyphs in each.
 */
export const TILE_OVERLAP = 0.08

/** JPEG quality for tiles. Fine text is where ringing does the most damage. */
export const JPEG_QUALITY = 0.92

export type Tile = {
  /** Top edge of the source region, in original image pixels. */
  srcTop: number
  /** Height of the source region, in original image pixels. */
  srcHeight: number
  /** Width to render at. */
  outWidth: number
  /** Height to render at. */
  outHeight: number
}

/**
 * Slice an image of the given dimensions into tiles.
 *
 * Short and normal-ratio images come back as a single tile scaled by the long
 * edge — unchanged from the old behaviour, because nothing was wrong with it
 * there. Tall images preserve width first and slice the height.
 */
export function planTiles(width: number, height: number): Tile[] {
  if (width <= 0 || height <= 0) {
    throw new Error(`planTiles: bad dimensions ${width}x${height}`)
  }

  if (height / width <= TALL_RATIO) {
    const scale = Math.min(1, MAX_PX / Math.max(width, height))
    return [{
      srcTop: 0,
      srcHeight: height,
      outWidth: Math.round(width * scale),
      outHeight: Math.round(height * scale),
    }]
  }

  // Width first: it is the scarce dimension. Only shrink it if the image is
  // genuinely wider than the budget.
  let scale = Math.min(1, MAX_PX / width)

  // Bands are sized against a budget that already allows for the overlap. The
  // overlap is added to a tile's height, so dividing by MAX_PX directly would
  // hand back tiles of MAX_PX + overlap — over the long-edge limit, which is
  // the one thing this whole function exists to respect.
  const bandBudget = Math.floor(MAX_PX / (1 + TILE_OVERLAP))
  let bands = Math.ceil(Math.round(height * scale) / bandBudget)

  // Too long to slice within the tile ceiling — give up some width after all,
  // but far less than the long-edge rule would have taken.
  if (bands > MAX_TILES) {
    scale *= (MAX_TILES * bandBudget) / Math.round(height * scale)
    bands = MAX_TILES
  }

  const outWidth = Math.round(width * scale)
  const fullHeight = Math.round(height * scale)
  const bandHeight = Math.ceil(fullHeight / bands)
  const overlap = Math.round(bandHeight * TILE_OVERLAP)

  const tiles: Tile[] = []
  for (let i = 0; i < bands; i++) {
    const top = Math.max(0, i * bandHeight - (i > 0 ? overlap : 0))
    if (top >= fullHeight) break
    const outHeight = Math.min(fullHeight - top, bandHeight + (i > 0 ? overlap : 0))
    // Clamp back into the source so sharp's extract() can never be handed a
    // region that runs off the bottom of the image.
    const srcTop = Math.min(height - 1, Math.round(top / scale))
    const srcHeight = Math.max(1, Math.min(height - srcTop, Math.round(outHeight / scale)))
    tiles.push({ srcTop, srcHeight, outWidth, outHeight })
  }
  return tiles
}
