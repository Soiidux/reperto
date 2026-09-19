import crypto from "crypto";

// Unambiguous alphabet: no I/L/O/0/1 to avoid transcription mistakes
const SHARE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const generateShareCode = (): string => {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += SHARE_CODE_ALPHABET[crypto.randomInt(SHARE_CODE_ALPHABET.length)];
  }
  return `FAM-${suffix}`;
};