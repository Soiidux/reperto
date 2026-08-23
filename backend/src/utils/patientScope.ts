import User from "../db/models/user.model";
import { ApiError } from "../errors";

export const MAX_GUARDIANS_PER_DEPENDENT = 5;
export const MAX_DEPENDENTS_PER_GUARDIAN = 10;

type Actor = { id: string; role: string };

// Ids of active dependents the user may act for, plus their own id —
// feed this straight into a `$in` query.
export async function resolvePatientScope(userId: string): Promise<string[]> {
  const dependents = await User.find({
    accountType: "dependent",
    guardians: userId,
    isActive: true,
  })
    .select("_id")
    .lean();

  return [userId, ...dependents.map((d) => String(d._id))];
}

// True when the acting user is the patient themself or an active guardian
// of the dependent. Staff/admin bypass lives with role checks in callers;
// doctors authorize via appointment/consultation assignment, not ownership.
export async function canActForPatient(
  userId: string,
  patientId: string,
): Promise<boolean> {
  if (!userId) return false;
  if (userId === patientId) return true;
  return Boolean(
    await User.exists({
      _id: patientId,
      accountType: "dependent",
      guardians: userId,
      isActive: true,
    }),
  );
}

// Guard for patient-role callers; throws on unauthorized access.
export async function assertPatientAccess(
  user: Actor,
  patientId: string,
): Promise<void> {
  if (!(await canActForPatient(user.id, patientId))) {
    throw new ApiError(403, "You are not authorized to view this.");
  }
}
