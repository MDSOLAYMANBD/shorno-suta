// Pool of demo messages used by the fallback / test-message system.
// Kept intentionally simple so it doesn't bleed business logic.
export const TEST_MESSAGE_POOL = [
  'price koto?',
  '850 taka nibo',
  'delivery koto din?',
  'ready ache?',
  'ektu kom rakha jabe?',
  'kobe pabo?',
  'order korte chai',
  'size chart ache?',
  'cash on delivery ache?',
];

export function pickRandomTestMessage(): string {
  return TEST_MESSAGE_POOL[Math.floor(Math.random() * TEST_MESSAGE_POOL.length)];
}
