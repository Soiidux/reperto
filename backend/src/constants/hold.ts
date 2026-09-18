/**
 * Movie-style booking hold: how long a slot stays reserved for a patient
 * while they complete their details. Matching this with a client-side
 * countdown gives the "seat is held for you" feel.
 */
export const HOLD_DURATION_MS = 5 * 60 * 1000;
export const HOLD_DURATION_SECONDS = HOLD_DURATION_MS / 1000;