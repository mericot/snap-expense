/**
 * Free-plan quota shown in the inbox.
 *
 * There is no plan or usage tracking in the schema, so this is a display-only
 * constant counted against the current calendar month's rows. Nothing enforces
 * it — saving a receipt above the limit still succeeds.
 *
 * Not to be confused with the *rate* limit: `/api/extract` allows 20
 * extractions per hour per user and enforces that server-side. A user can be
 * rate-limited while this row still reads "3 of 10".
 */
export const FREE_MONTHLY_LIMIT = 10

/**
 * Upload types. These mirror `ALLOWED_MEDIA_TYPES` in
 * `src/app/api/extract/route.ts`; the server is the authority and rejects
 * anything else. The client copy checks first so an obvious mistake does not
 * cost a rate-limit slot.
 *
 * PDF is deliberately absent. The design copy offered "a photo or PDF"; the
 * uploader has never accepted PDF, so the copy was corrected rather than the
 * promise shipped. PDF support is a follow-up.
 */
export const HEIC_TYPES = ['image/heic', 'image/heif']
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', ...HEIC_TYPES]

/** Matches MAX_BODY_BYTES in the extract route. Surfaced in the dropzone hint. */
export const MAX_UPLOAD_MB = 10
