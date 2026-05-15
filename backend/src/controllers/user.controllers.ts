import { Request, Response } from "express";
import User from "../db/models/user.model";

export const getMe = async (req: Request, res: Response) => {
  try {
    const id = req.user.id;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, message:"User found", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const editMe = async (req: Request, res: Response) => {
  try {
    const id = req.user.id;
    const {name, gender, dateOfBirth, bloodGroup} = req.body;
    const user = await User.findByIdAndUpdate(id, {name, gender, dateOfBirth, bloodGroup}, { new: true, runValidators: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User updated', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteMe = async (req: Request, res: Response) => {
  try {
    const id = req.user.id;
    const user = await User.findByIdAndUpdate(id, {isActive: false}, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getDoctors = async (req: Request, res: Response) => {
  try {
    const { specialization, name} = req.query;
    const query: any = { role: "doctor", isActive: "true" };
    if (specialization) query['doctorProfile.specializations'] = specialization;
    if (name) query.name = { $regex: name, $options: 'i' };
    let doctors = await User.find(query).select('name profileImageUrl doctorProfile');
    res.status(200).json({ success: true, message: 'Doctors fetched', data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const searchPatients = async (req: Request, res: Response) => {
  try {
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
        .select('name email phone gender bloodGroup profileImageUrl dateOfBirth')
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
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};