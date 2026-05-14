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