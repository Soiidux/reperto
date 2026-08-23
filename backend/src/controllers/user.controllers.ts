import { Request, Response } from "express";
import crypto from "crypto";
import User, { IUser } from "../db/models/user.model";
import { uploadToCloudinary } from "../utils/cloudinary";
import { ApiError } from "../errors";
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
  let doctors = await User.find(query).select('_id name profileImageUrl doctorProfile');
  res.status(200).json({ success: true, message: 'Doctors fetched', data: doctors });
};

export const getPatients = async (req: Request, res: Response) => {
  // 1. Pagination Setup
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 15; // Default to 15 patients per page
  const skip = (page - 1) * limit;

  const { search } = req.query;
  const query: any = { role: 'patient', isActive: true };

  // 2. Multi-field Search Logic
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  // 3. Parallel Execution (Performance Trick)
  // We run the count and the data fetch simultaneously to save time
  const [totalPatients, patients] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .select('name email phone gender bloodGroup profileImageUrl dateOfBirth accountType')
      .sort({ name: 1 }) // Sorting patients alphabetically is usually better for doctors
      .skip(skip)
      .limit(limit)
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

// ---- Family accounts (dependents) ----

// Unambiguous alphabet: no I/L/O/0/1 to avoid transcription mistakes
const SHARE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const generateShareCode = (): string => {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += SHARE_CODE_ALPHABET[crypto.randomInt(SHARE_CODE_ALPHABET.length)];
  }
  return `FAM-${suffix}`;
};

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
  guardians: (member.guardians || []).map((g) => String(g)),
  createdBy: member.createdBy ? String(member.createdBy) : null,
});

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
    accountType: "dependent",
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
    accountType: "dependent",
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
  if (bloodGroup !== undefined) member.bloodGroup = bloodGroup;
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

// Soft-deletes the member. Any guardian may do this; records are kept.
export const removeFamilyMember = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const member = await findGuardianMember(id, req.user.id);

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

// Creator strips a co-guardian's access. Rotates the share code afterwards
// so the removed guardian cannot silently re-join with one they saw.
export const removeGuardian = async (req: Request, res: Response) => {
  const memberId = String(req.params.id);
  const guardianId = String(req.params.guardianId);
  const member = await findGuardianMember(memberId, req.user.id);

  if (String(member.createdBy) !== req.user.id) {
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
    accountType: "dependent",
    guardians: req.user.id,
  });
  if (!member) {
    throw new ApiError(404, "Family member not found");
  }

  const remaining = (member.guardians || [])
    .map(String)
    .filter((g) => g !== req.user.id);
  if (remaining.length === 0) {
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

  // Only the creator rotates codes; co-guardians just consume them
  if (String(member.createdBy) !== req.user.id) {
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

export const joinByShareCode = async (req: Request, res: Response) => {
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
    accountType: "dependent",
    isActive: true,
  });
  // Same message whether the code is wrong or stale — don't leak which
  if (!member) {
    return res.status(404).json({
      success: false,
      message: "Invalid or expired family code",
      data: null,
    });
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

  const joinedResponse: ApiResponse<ReturnType<typeof familyMemberPayload>> = {
    success: true,
    message: `You now have access to ${member.name}`,
    data: familyMemberPayload(member),
  };
  res.status(200).json(joinedResponse);
};