import { Request, Response } from "express";

export const getMe = async (req: Request, res: Response) => {
  // Since 'protect' attached the user to the request, 
  // we don't even need to look at the database yet!
  res.status(200).json({
    success: true,
    data: req.user // Should show { id, role }
  });
};