import {Request, Response} from "express";
import User from "../db/models/user.model";
import RefreshToken from "../db/models/token.model"
import bcrypt from "bcrypt";
import { generateAccessToken, generateRefreshToken, validateAccessToken, getBearerToken} from "../utils/token";
import { uploadToCloudinary } from "../utils/cloudinary";

export const registerUser = async (req: Request, res: Response) => {
  try {
    //1.Get information
    const { name, email, password, phone, role, gender, dateOfBirth, bloodGroup} = req.body;
    const existingUser = await User.findOne({ email });
    
    //2.Check if user already exists
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
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
    
    res.status(201).json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error instanceof Error ? error.message : String(error) });
  }
}

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    //1.Find user and check if the user is valid
    const user = await User.findOne({ email }).select("+password");
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    //2. Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
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
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    //Send access token as response
    res.status(200).json({
      message: "Login successful", accessToken, user: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const incomingRefreshToken = req.cookies.refreshToken;
    
    if (!incomingRefreshToken) {
      return res.status(401).json({ message: "Unauthenticated" });
    }
    
    const storedToken = await RefreshToken.findOne({ token: incomingRefreshToken, isRevoked: false });
    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ message: "Refresh token has expired or is inavlid" });
    }
    
    const user = await User.findOne({ _id: storedToken.userId })
    const newAccessToken = generateAccessToken(user!._id.toString(), user!.role);
    
    res.status(200).json({ message: "Access token refreshed", accessToken: newAccessToken });
  } catch (error) {
    console.error("Refresh token error", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export const logoutUser = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
 
  await RefreshToken.findOneAndUpdate({ token: refreshToken }, { isRevoked: true });
  
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
  })
 res.status(200).json({ message: "Logged out successfully" });
}