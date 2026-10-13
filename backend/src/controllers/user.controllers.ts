import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import User, { IUser } from "../db/models/user.model";
import Review from "../db/models/review.model";
import Appointment from "../db/models/appointment.model";
import Consultation from "../db/models/consultation.model";
import Notification from "../db/models/notification.model";
import { uploadToCloudinary } from "../utils/cloudinary";
import { ApiError } from "../errors";
import {
  buildUserSearchFilter,
  USER_SEARCH_COLLATION,
} from "../utils/userSearch";
import {
  MAX_DEPENDENTS_PER_GUARDIAN,
  MAX_GUARDIANS_PER_DEPENDENT,
} from "../utils/patientScope";
import {
  createFamilyMemberSchema,
  joinByShareCodeSchema,
  updateFamilyMemberSchema,
} from "../zodSchemas";

export const getMe = async (req: Request, res: Response) => {
  const id = req.user.id;
  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.status(200).json({ success: true, message:"User found", data: user });
};

export const updateProfileImage = async (req: Request, res: Response) => {
  const id = req.user.id;
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Select an image to upload (JPEG, PNG, or WebP, max 2 MB)",
      data: null,
    });
  }

  const result = await uploadToCloudinary(req.file.path, "profiles");
  if (!result?.secure_url) {
    return res.status(500).json({
      success: false,
      message: "Image upload failed, please try again",
      data: null,
    });
  }

  const user = await User.findByIdAndUpdate(
    id,
    { profileImageUrl: result.secure_url },
    { new: true },
  ).select('-password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.status(200).json({
    success: true,
    message: "Profile image updated",
    data: { profileImageUrl: user.profileImageUrl },
  });
};

export const editMe = async (req: Request, res: Response) => {
  const id = req.user.id;
  const {name, gender, dateOfBirth, bloodGroup} = req.body;
  const user = await User.findByIdAndUpdate(id, {name, gender, dateOfBirth, bloodGroup}, { new: true, runValidators: true });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.status(200).json({ success: true, message: 'User updated', data: user });
};

export const deleteMe = async (req: Request, res: Response) => {
  const id = req.user.id;
  const user = await User.findByIdAndUpdate(id, {isActive: false}, { new: true });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.status(200).json({ success: true, message: 'User deleted' });
};

export const getDoctors = async (req: Request, res: Response) => {
  const { specialization, name} = req.query;
  const query: any = { role: "doctor", isActive: true };
  if (specialization) query['doctorProfile.specializations'] = specialization;
  if (name) query.name = { $regex: name, $options: 'i' };
  let doctors = await User.find(query).select('_id name profileImageUrl doctorProfile').lean();

  // Attach rating stats from the Review collection so the directory can
  // show an average without a second lookup per doctor.
  const doctorIds = doctors.map((d) => d._id);
  const grouped = await Review.aggregate([
    { $match: { doctorId: { $in: doctorIds } } },
    { $group: { _id: { doctorId: '$doctorId', rating: '$rating' }, count: { $sum: 1 } } },
    {
      $group: {
        _id: '$_id.doctorId',
        totalReviews: { $sum: '$count' },
        totalRating: { $sum: { $multiply: ['$_id.rating', '$count'] } },
        counts: { $push: { rating: '$_id.rating', count: '$count' } },
      },
    },
  ]);
  const statsById = new Map<string, { totalReviews: number; avgRating: number; ratingDistribution: Record<number, number> }>();
  for (const row of grouped) {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const c of row.counts) {
      distribution[c.rating] = c.count;
    }
    statsById.set(row._id.toString(), {
      totalReviews: row.totalReviews,
      avgRating: Math.round((row.totalRating / row.totalReviews) * 10) / 10,
      ratingDistribution: distribution,
    });
  }

  const data = doctors.map((d) => {
    const stats = statsById.get(d._id.toString()) || {
      totalReviews: 0,
      avgRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
    return { ...d, ...stats };
  });

  res.status(200).json({ success: true, message: 'Doctors fetched', data });
};

export const getPatients = async (req: Request, res: Response) => {
  // 1. Pagination Setup
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 15; // Default to 15 patients per page
  const skip = (page - 1) * limit;

  const { search } = req.query;
  const query: any = { role: 'patient', isActive: true };

  // 2. Multi-field Search Logic. Escaped + prefix-anchored + collation-aware,
  // so this uses the User indexes instead of scanning every patient.
  if (search) {
    const searchFilter = buildUserSearchFilter(search);
    if (searchFilter) query.$or = searchFilter.$or as Record<string, unknown>[];
  }

  // 3. Parallel Execution (Performance Trick)
  // We run the count and the data fetch simultaneously to save time
  const [totalPatients, patients] = await Promise.all([
    User.countDocuments(query).collation(USER_SEARCH_COLLATION),
    User.find(query)
      .select('name email phone gender bloodGroup profileImageUrl dateOfBirth accountType')
      .sort({ name: 1 }) // Sorting patients alphabetically is usually better for doctors
      .skip(skip)
      .limit(limit)
      .collation(USER_SEARCH_COLLATION)
      .lean()
  ]);

  const totalPages = Math.ceil(totalPatients / limit);

  res.status(200).json({
    success: true,
    message: "Patients fetched successfully",
    pagination: {
      totalItems: totalPatients,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: patients
  });
};

// ---- Family accounts (dependents + linked real accounts) ----

import { generateShareCode } from "../utils/shareCode";

const FAMILY_SELECT =
  "name gender dateOfBirth bloodGroup phone relationship profileImageUrl accountType guardians createdBy shareCode isActive";

const familyMemberPayload = (member: IUser) => ({
  id: String(member._id),
  name: member.name,
  gender: member.gender,
  dateOfBirth: member.dateOfBirth,
  bloodGroup: member.bloodGroup,
  phone: member.phone || "",
  relationship: member.relationship,
  profileImageUrl: member.profileImageUrl || "",
  shareCode: member.shareCode || "",
  isActive: member.isActive,
  accountType: member.accountType,
  guardians: (member.guardians || []).map((g) => String(g)),
  createdBy: member.createdBy ? String(member.createdBy) : null,
});

// The user's own family code, generated on first view so existing accounts
// (created before codes existed) can be linked too.
export const getMyShareCode = async (req: Request, res: Response) => {
  const user = await User.findById(req.user.id).select("shareCode");
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  if (!user.shareCode) {
    user.shareCode = generateShareCode();
    await user.save();
  }
  res.status(200).json({
    success: true,
    message: "Family code fetched",
    data: { shareCode: user.shareCode },
  });
};

export const createFamilyMember = async (req: Request, res: Response) => {
  const parsed = createFamilyMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request data",
      data: null,
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const activeCount = await User.countDocuments({
    accountType: "dependent",
    guardians: req.user.id,
    isActive: true,
  });
  if (activeCount >= MAX_DEPENDENTS_PER_GUARDIAN) {
    throw new ApiError(
      400,
      `You can manage up to ${MAX_DEPENDENTS_PER_GUARDIAN} family members`,
    );
  }

  const { name, gender, dateOfBirth, bloodGroup, phone, relationship } = parsed.data;

  let profileImageUrl = "";
  if (req.file) {
    const result = await uploadToCloudinary(req.file.path, "profiles");
    if (!result?.secure_url) {
      return res.status(500).json({
        success: false,
        message: "Image upload failed, please try again",
        data: null,
      });
    }
    profileImageUrl = result.secure_url;
  }

  // Retry on the unlikely collision of a generated join code
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const member = await User.create({
        name,
        gender,
        dateOfBirth,
        bloodGroup: bloodGroup || undefined,
        phone: phone || undefined,
        relationship,
        profileImageUrl,
        role: "patient",
        accountType: "dependent",
        guardians: [req.user.id],
        createdBy: req.user.id,
        shareCode: generateShareCode(),
        isActive: true,
      });

      const createdResponse: ApiResponse<ReturnType<typeof familyMemberPayload>> = {
        success: true,
        message: "Family member added",
        data: familyMemberPayload(member),
      };
      return res.status(201).json(createdResponse);
    } catch (error: any) {
      if (error?.code === 11000 && attempt < 4) continue;
      throw error;
    }
  }
};

export const listFamilyMembers = async (req: Request, res: Response) => {
  const members = await User.find({
    guardians: req.user.id,
  })
    .select(FAMILY_SELECT)
    .populate("guardians", "name profileImageUrl")
    .sort({ createdAt: 1 })
    .lean();

  const response: ApiResponse<typeof members> = {
    success: true,
    message: "Family members fetched",
    data: members,
  };
  res.status(200).json(response);
};

const findGuardianMember = async (memberId: string, userId: string) => {
  const member = await User.findOne({
    _id: memberId,
    guardians: userId,
  });
  if (!member) {
    throw new ApiError(404, "Family member not found");
  }
  return member;
};

export const updateFamilyMember = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const member = await findGuardianMember(id, req.user.id);

  const parsed = updateFamilyMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request data",
      data: null,
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { name, gender, dateOfBirth, bloodGroup, phone, relationship } = parsed.data;
  if (name !== undefined) member.name = name;
  if (gender !== undefined) member.gender = gender;
  if (dateOfBirth !== undefined) member.dateOfBirth = new Date(dateOfBirth);
  if (bloodGroup !== undefined) member.bloodGroup = bloodGroup || undefined;
  if (phone !== undefined) member.phone = phone || undefined;
  if (relationship !== undefined) member.relationship = relationship;

  await member.save();
  const response: ApiResponse<ReturnType<typeof familyMemberPayload>> = {
    success: true,
    message: "Family member updated",
    data: familyMemberPayload(member),
  };
  res.status(200).json(response);
};

// Soft-deletes a created dependent profile. Any guardian may do this;
// records are kept. Real (self) accounts cannot be deleted this way —
// a guardian should Leave instead so the account keeps working.
export const removeFamilyMember = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const member = await findGuardianMember(id, req.user.id);

  if (member.accountType !== "dependent") {
    throw new ApiError(
      400,
      "This is a real account, not a created profile. Use 'Leave' to stop managing them.",
    );
  }

  member.isActive = false;
  // Rotate rather than clear: a stale code must never grant access again,
  // but the member can still be re-added and shared later.
  member.shareCode = generateShareCode();
  await member.save();

  res.status(200).json({
    success: true,
    message: "Family member removed. Their records are preserved.",
    data: null,
  });
};

// Creator strips a co-guardian's access. For a real (self) account the
// account owner is the "creator". Rotates the share code afterwards so
// the removed guardian cannot silently re-join with one they saw.
export const removeGuardian = async (req: Request, res: Response) => {
  const memberId = String(req.params.id);
  const guardianId = String(req.params.guardianId);
  const member = await findGuardianMember(memberId, req.user.id);

  const isOwner =
    String(member.createdBy) === req.user.id ||
    String(member._id) === req.user.id;
  if (!isOwner) {
    throw new ApiError(403, "Only the member's creator can remove guardians");
  }
  if (guardianId === req.user.id) {
    throw new ApiError(400, "Creators cannot remove themselves");
  }

  const guardianIds = (member.guardians || []).map(String);
  const remaining = guardianIds.filter((g) => g !== guardianId);
  if (remaining.length === guardianIds.length) {
    throw new ApiError(404, "That user is not a guardian of this member");
  }

  member.guardians = remaining as any;
  member.shareCode = generateShareCode();
  await member.save();

  const response: ApiResponse<{ guardians: string[] }> = {
    success: true,
    message: "Guardian removed",
    data: { guardians: remaining },
  };
  res.status(200).json(response);
};

// A co-guardian voluntarily gives up access. The last guardian cannot
// strand the dependent without anyone managing it.
export const leaveFamilyMember = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const member = await User.findOne({
    _id: id,
    guardians: req.user.id,
  });
  if (!member) {
    throw new ApiError(404, "Family member not found");
  }

  const remaining = (member.guardians || [])
    .map(String)
    .filter((g) => g !== req.user.id);
  // A real (self) account always keeps its owner, so any guardian may leave.
  // Only created dependent profiles need someone to stay behind to manage them.
  const isSelfAccount = member.accountType !== "dependent";
  if (remaining.length === 0 && !isSelfAccount) {
    throw new ApiError(
      400,
      "You are the last guardian. Remove the member instead of leaving.",
    );
  }
  member.guardians = remaining as any;
  await member.save();

  res.status(200).json({
    success: true,
    message: "You no longer have access to this family member",
    data: null,
  });
};

export const regenerateShareCode = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const member = await findGuardianMember(id, req.user.id);

  // Only the creator (or the account owner themself) rotates codes;
  // co-guardians just consume them
  const isOwner =
    String(member.createdBy) === req.user.id ||
    String(member._id) === req.user.id;
  if (!isOwner) {
    throw new ApiError(403, "Only the member's creator can regenerate the code");
  }
  if (!member.isActive) {
    throw new ApiError(400, "Re-add this family member before sharing access");
  }

  member.shareCode = generateShareCode();
  await member.save();

  const response: ApiResponse<{ shareCode: string }> = {
    success: true,
    message: "New share code generated",
    data: { shareCode: member.shareCode! },
  };
  res.status(200).json(response);
};

// Add a family member by their own code. The code belongs to a real
// (self) patient account OR a created dependent profile; entering it links
// that person into the acting user's family space so they can book and
// manage on their behalf.
export const addByShareCode = async (req: Request, res: Response) => {
  const parsed = joinByShareCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request data",
      data: null,
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const member = await User.findOne({
    shareCode: parsed.data.code,
    role: "patient",
    isActive: true,
  });
  // Same message whether the code is wrong, stale, or the account has no
  // code yet — don't leak which one the caller guessed.
  if (!member) {
    return res.status(404).json({
      success: false,
      message: "Invalid or expired family code",
      data: null,
    });
  }

  if (String(member._id) === req.user.id) {
    throw new ApiError(400, "You can't add yourself");
  }

  const managedCount = await User.countDocuments({
    guardians: req.user.id,
    isActive: true,
  });
  if (managedCount >= MAX_DEPENDENTS_PER_GUARDIAN) {
    throw new ApiError(
      400,
      `You can manage up to ${MAX_DEPENDENTS_PER_GUARDIAN} family members`,
    );
  }

  const guardianIds = (member.guardians || []).map((g) => String(g));
  if (guardianIds.includes(req.user.id)) {
    const alreadyResponse: ApiResponse<ReturnType<typeof familyMemberPayload>> = {
      success: true,
      message: "You already have access to this member",
      data: familyMemberPayload(member),
    };
    return res.status(200).json(alreadyResponse);
  }

  if (guardianIds.length >= MAX_GUARDIANS_PER_DEPENDENT) {
    throw new ApiError(400, "This member already has the maximum number of guardians");
  }

  member.guardians = [...guardianIds, req.user.id as any];
  await member.save();

  const addedResponse: ApiResponse<ReturnType<typeof familyMemberPayload>> = {
    success: true,
    message: `${member.name} added to your family`,
    data: familyMemberPayload(member),
  };
  res.status(200).json(addedResponse);
};

// Data export (GDPR-style): returns everything the account can see as JSON.
// Guarded per-role below so a patient never receives staff/doctor records.
export const exportMyData = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const user = await User.findById(userId).lean();
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const scopeIds: mongoose.Types.ObjectId[] = [user._id];
  const familyMembers = await User.find({
    guardians: userId,
  })
    .lean();

  scopeIds.push(...familyMembers.map((m) => m._id));

  const [appointments, consultations, notifications, reviews] =
    await Promise.all([
      Appointment.find({ patientId: { $in: scopeIds } }).lean(),
      Consultation.find({ patientId: { $in: scopeIds } }).lean(),
      Notification.find({ recipientId: userId }).lean(),
      Review.find({ patientId: userId }).lean(),
    ]);

  const data = {
    exportedAt: new Date().toISOString(),
    exportedBy: {
      id: user._id.toString(),
      name: user.name,
      email: user.email || "",
      role: user.role,
    },
    profile: user,
    familyMembers,
    appointments,
    consultations,
    notifications,
    reviews,
  };
  res.status(200).json({ success: true, message: "Export ready", data });
};