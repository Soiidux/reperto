import {Request, Response} from "express";
import User from "../db/models/user.model";
import RefreshToken from "../db/models/token.model"
import bcrypt from "bcrypt";
import { generateAccessToken, generateRefreshToken, validateAccessToken, getBearerToken} from "../utils/token";
import { uploadToCloudinary } from "../utils/cloudinary";


const InternalServerErrorResponse : ApiResponse<null> = {
  success: false,
  message: "Internal server error",
  data: null,
};

export const registerUser = async (req: Request, res: Response) => {
  try {
    //1.Get information
    const { name, email, password, phone, role, gender, dateOfBirth, bloodGroup} = req.body;
    const existingUser = await User.findOne({ email });
    
    //2.Check if user already exists
    if (existingUser) {
      const conflictResponse : ApiResponse<null> = {
        success: false,
        message: "User already exists",
        data: null,
      };
      return res.status(409).json(conflictResponse);
    }
    
    //3.Handle profile pic
    let profileImageUrl : string= "";
    if (req.file) {
      const result = await uploadToCloudinary(req.file.path, "profiles");
      profileImageUrl = result?.secure_url || "";
    }
    
    //4.Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    
    //Set default role to patient and check if admin was the one that made the request, if yes then change roles
    let roleToAssign = 'patient';
    const token = getBearerToken(req);
    if (token) {
      try {
        const decoded = validateAccessToken(token);
        if (decoded.role === "admin" && role) {
          roleToAssign = role;
        }
      } catch (error) {
        console.log("Not an admin request or token expired, defaulting to patient");
      }
    }
    //5.Create User
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      profileImageUrl,
      role: roleToAssign,
      gender,
      dateOfBirth,
      bloodGroup,
      ...(roleToAssign === "doctor" && { doctorProfile: req.body.doctorProfile }),
    })
    
    //6.Save User
    await newUser.save();
    
    const response: ApiResponse<null> = {
      success: true,
      message: "User registered successfully",
      data: null,
    }
    return res.status(201).json(response);
  } catch (error) {
    return res.status(500).json(InternalServerErrorResponse);
  }
}

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    //1.Find user and check if the user is valid
    const user = await User.findOne({ email }).select("+password");
    
    if (!user || !user.isActive) {
      const invalidCredentialsResponse: ApiResponse<null> = {
        success: false,
        message: "Invalid credentials",
        data: null,
      }
      return res.status(401).json(invalidCredentialsResponse);
    }
    
    //2. Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const invalidCredentialsResponse: ApiResponse<null> = {
        success: false,
        message: "Invalid credentials",
        data: null,
      }
      return res.status(401).json(invalidCredentialsResponse);
    }
    
    //3.Generate tokens and save refresh token in db
    const accessToken = generateAccessToken(user._id.toString(), user.role)
    const refreshToken = generateRefreshToken();
    
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
    })
    
    //Set refresh token as cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    //Send access token as response
    const successResponse: ApiResponse<LoginData> = {
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        user: {
          id: user._id.toString(),
          name: user.name,
          role: user.role,
          profileImageUrl: user.profileImageUrl || "",
        },
      },
    };
    res.status(200).json(successResponse);
  } catch (error) {
    console.error("Login error", error);
    res.status(500).json(InternalServerErrorResponse);
  }
}

export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const incomingRefreshToken = req.cookies.refreshToken;
    
    if (!incomingRefreshToken) {
      const unauthenticatedResponse = {
        success: false,
        message: "Unauthenticated",
        data: null,
      }
      return res.status(401).json(unauthenticatedResponse);
    }
    
    const storedToken = await RefreshToken.findOne({ token: incomingRefreshToken, isRevoked: false });
    if (!storedToken || storedToken.expiresAt < new Date()) {
      const invalidTokenResponse = {
        success: false,
        message: "Refresh token has expired or is inavlid",
        data: null,
      }
      return res.status(401).json(invalidTokenResponse);
    }
    
    const user = await User.findOne({ _id: storedToken.userId })
    const newAccessToken = generateAccessToken(user!._id.toString(), user!.role);

    // Rotate the refresh token: revoke the old one and issue a fresh one
    await RefreshToken.updateOne({ _id: storedToken._id }, { isRevoked: true });
    const newRefreshToken = generateRefreshToken();
    await RefreshToken.create({
      userId: user!._id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
    });
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const response: ApiResponse<{ accessToken: string }> = {
      success: true,
      message: "Access token refreshed",
      data: { accessToken: newAccessToken },
    }
    res.status(200).json(response);
  } catch (error) {
    console.error("Refresh token error", error);
    res.status(500).json(InternalServerErrorResponse);
  }
}

export const logoutUser = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;
    await RefreshToken.findOneAndUpdate({ token: refreshToken }, { isRevoked: true });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    })
    const response: ApiResponse<null> = {
      success: true,
      message: "Logged out successfully",
      data: null,
    }
    res.status(200).json(response);
  } catch (error) {
    console.error("Logout error", error);
    res.status(500).json(InternalServerErrorResponse);
  }
}

export const updateEmail = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const userId = req.user.id;
    const user = await User.findOne({ _id: userId }).select("+password");
    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }
    
    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already in use" });
    }
    user.email = email;
    await user.save();
    return res.status(200).json({ message: "Email updated successfully" });
    
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }  
}

export const updatePhone = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    const userId = req.user.id;
    const user = await User.findOne({ _id: userId }).select("+password");
    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    } else {
      user.phone = phone;
      await user.save();
      return res.status(200).json({ message: "Phone updated successfully" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}

export const updatePassword = async (req: Request, res: Response) => {
  try {
    const { newPassword, oldPassword } = req.body;
    const userId = req.user.id;
    const user = await User.findOne({ _id: userId }).select("+password");
    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      user.password = hashedPassword;
      await user.save();
      return res.status(200).json({ message: "Password updated successfully" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}