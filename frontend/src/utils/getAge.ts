/**
 * Age in whole years from a "YYYY-MM-DD" date of birth.
 *
 * The DOB is parsed as components rather than through `new Date(...)`,
 * because a bare "YYYY-MM-DD" string is interpreted as UTC midnight and then
 * read back with *local* getters — which makes the computed age a year too low
 * for anyone west of UTC (e.g. a 1 Jan birthday in IST reads as 31 Dec).
 */
export default function getAge(dateOfBirth: string): number {
  const parts = dateOfBirth.split("-").map(Number);
  const [birthYear, birthMonth, birthDay] = parts;
  if (
    parts.length < 3 ||
    Number.isNaN(birthYear) ||
    Number.isNaN(birthMonth) ||
    Number.isNaN(birthDay)
  ) {
    return 0;
  }

  const today = new Date();
  let age = today.getFullYear() - birthYear;

  // Not had their birthday yet this year?
  const monthDiff = today.getMonth() + 1 - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDay)) {
    age -= 1;
  }

  return age;
}
