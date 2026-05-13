import { Request, Response } from 'express';
import Leave from "../db/models/leave.model";

export const addLeave = async (req: Request, res: Response) => {
  try {
    const { type, startingDate, startingTime, endingDate, endingTime, reason } = req.body;
    const doctorId = req.user.id;
    let [year, month, day] = startingDate.split("-").map(Number);
    const normalizedStart = new Date(Date.UTC(year, month - 1, day));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (normalizedStart < today) {
        return res
          .status(400)
          .json({ message: "Selected date cannot be in the past" });
    }
    
    let normalizedEnd: Date = null;
    
    if(endingDate) {
        [year, month, day] = endingDate.split("-").map(Number);
        normalizedEnd = new Date(Date.UTC(year, month - 1, day));
        if (normalizedEnd < normalizedStart) {
            return res
                .status(400)
                .json({ message: "Ending date cannot be before starting date" });
        }
    }
    
    const overlappingLeave = await Leave.findOne({
      doctorId,
      $or: [
        {
          // Case: New leave starts inside an existing leave
          startingDate: { $lte: normalizedStart },
          endingDate: { $gte: normalizedStart }
        },
        {
          // Case: New leave ends inside an existing leave
          startingDate: { $lte: normalizedEnd },
          endingDate: { $gte: normalizedEnd }
        },
        {
          // Case: New leave completely swallows an existing leave
          startingDate: { $gte: normalizedStart },
          endingDate: { $lte: normalizedEnd }
        }
      ]
    });
    if (overlappingLeave) {
      // Logic for partial blocks: You might want to allow multiple 'emergency' blocks on one day
      // But for 'full-day', we definitely block duplicates.
      if (type === 'full-day' || overlappingLeave.type === 'full-day') {
        return res.status(400).json({ 
          success: false, 
          message: "A leave record already exists that overlaps with this date range." 
        });
      }
    }
    
    const leave = new Leave({
      doctorId,
      type,
      startingDate: normalizedStart,
      endingDate: normalizedEnd,
      startingTime,
      endingTime,
      reason
    });
    
    await leave.save();
    
    return res.status(201).json({ success: true, message: "Leave record added successfully" , data: leave });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add leave record", error: error.message });
  } 
};

export const removeLeave = async (req: Request, res: Response) => {
  try {
    const { leaveId } = req.params;
    const doctorId = req.user.id;

    // Ensure the leave belongs to the doctor trying to delete it
    const leave = await Leave.findOneAndDelete({ _id: leaveId, doctorId });

    if (!leave) {
      return res.status(404).json({ 
        success: false, 
        message: "Leave record not found or unauthorized" 
      });
    }

    res.status(200).json({
      success: true,
      message: "Leave removed successfully"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error removing leave" });
  }
};