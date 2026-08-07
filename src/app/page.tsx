// ROUTE STUB — owned by task 01 (landing).
// It exists so five parallel branches do not each create this file. Task 01 (landing)
// replaces its contents entirely.
// Signed-in visitors never reach it: src/proxy.ts sends them to /receipts.
export default function Page() {
  return <h1>Landing</h1>
}
