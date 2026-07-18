/**
 * Generate a UUID v7 string.
 *
 * UUID v7 layout:
 * - 48 bits: Unix timestamp in milliseconds
 * - 4 bits: version (0111)
 * - 12 bits: rand_a
 * - 2 bits: variant (10)
 * - 62 bits: rand_b
 *
 * This gives time-ordered, globally unique IDs without a central coordinator.
 */

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function uuidv7(): string {
  const timestamp = BigInt(Date.now());
  const randA = randomBytes(2);
  const randB = randomBytes(8);

  const bytes = new Uint8Array(16);

  // Bytes 0-5: timestamp (48 bits, big-endian)
  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);

  // Byte 6: version (4 bits) + rand_a high 4 bits
  bytes[6] = 0x70 | (randA[0] & 0x0f);
  // Byte 7: rand_a low 8 bits
  bytes[7] = randA[1];

  // Byte 8: variant (2 bits) + rand_b high 6 bits
  bytes[8] = 0x80 | (randB[0] & 0x3f);
  // Bytes 9-15: rand_b low 56 bits
  bytes.set(randB.subarray(1), 9);

  // Convert to UUID string
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isValidUuidv7(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
