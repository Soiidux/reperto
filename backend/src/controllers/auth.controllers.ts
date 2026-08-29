import {Request, Response} from "express";
import User from "../db/models/user.model";
import RefreshToken from "../db/models/token.model"
import bcrypt from "bcrypt";
import { generateAccessToken, generateRefreshToken, validateAccessToken, getBearerToken} from "../utils/token";
import { uploadToCloudinary } from "../utils/cloudinary";
import { hashToken } from "../utils/tokenHash";
import config from "../config";
import { sendEmail, verificationEmailHtml, resetPasswordEmailHtml } from "../utils/email";
import { issueEmailToken, consumeEmailToken, buildActionLink } from "../utils/emailToken";

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Issues a fresh verification token and emails the link to the user.
// Sends are isolated from callers so a mail failure never blocks an
// action (the dev console transport cannot fail; SMTP may).
const sendVerificationEmail = async (userId: string, email: string) => {
  try {
    const token = await issueEmailToken(userId, "verify-email");
    await sendEmail({
      to: email,
      subject: "Verify your Reperto email",
      html: verificationEmailHtml(buildActionLink("verify-email", token)),
    });
  } catch (error) {
    console.error("Failed to send verification email:", error);
  }
};


export const registerUser = async (req: Request, res: Response) => {
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

  //7.Email verification link (dependent accounts have no inbox; guests only)
  if (roleToAssign !== "dependent") {
    await sendVerificationEmail(newUser._id.toString(), email);
  }

  const response: ApiResponse<null> = {
    success: true,
    message: "User registered successfully",
    data: null,
  }
  return res.status(201).json(response);
}

export const loginUser = async (req: Request, res: Response) => {
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

// Dependents are clinical records managed by guardians, never accounts;
// they must not authenticate even if one somehow gains an email+password.
if ((user as any).accountType === "dependent") {
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
  tokenHash: hashToken(refreshToken),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  isRevoked: false,
})

    //Set refresh token as cookie
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

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
      emailVerified: user.emailVerified ?? false,
    },
  },
};
res.status(200).json(successResponse);
}

export const refreshAccessToken = async (req: Request, res: Response) => {
const incomingRefreshToken = req.cookies.refreshToken;

if (!incomingRefreshToken) {
const unauthenticatedResponse = {
  success: false,
  message: "Unauthenticated",
  data: null,
}
return res.status(401).json(unauthenticatedResponse);
}

const incomingHash = hashToken(incomingRefreshToken);

const storedToken = await RefreshToken.findOne({ tokenHash: incomingHash, isRevoked: false });
if (!storedToken) {
// Token was not found among active sessions.
const tampered = await RefreshToken.findOne({ tokenHash: incomingHash });
if (tampered) {
  // The token exists but is revoked: someone reused a rotated/revoked token.
  // Treat as session theft: revoke every refresh token for that user.
  await RefreshToken.updateMany({ userId: tampered.userId }, { isRevoked: true });
  const reuseResponse = {
    success: false,
    message: "Session expired, please log in again",
    data: null,
  }
  return res.status(401).json(reuseResponse);
}
const invalidTokenResponse = {
  success: false,
  message: "Refresh token has expired or is invalid",
  data: null,
}
return res.status(401).json(invalidTokenResponse);
}

if (storedToken.expiresAt < new Date()) {
const invalidTokenResponse = {
  success: false,
  message: "Refresh token has expired or is invalid",
  data: null,
}
return res.status(401).json(invalidTokenResponse);
}

const user = await User.findOne({ _id: storedToken.userId })
if (!user || !user.isActive) {
return res.status(401).json({
  success: false,
  message: "Account is disabled or no longer exists",
  data: null,
});
}
const newAccessToken = generateAccessToken(user._id.toString(), user.role);

// Rotate the refresh token: revoke the old one and issue a fresh one
await RefreshToken.updateOne({ _id: storedToken._id }, { isRevoked: true });
const newRefreshToken = generateRefreshToken();
await RefreshToken.create({
userId: user._id,
tokenHash: hashToken(newRefreshToken),
expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
isRevoked: false,
});
    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);

const response: ApiResponse<{ accessToken: string }> = {
success: true,
message: "Access token refreshed",
data: { accessToken: newAccessToken },
}
res.status(200).json(response);
}

export const logoutUser = async (req: Request, res: Response) => {
const { refreshToken } = req.cookies;
if (refreshToken) {
await RefreshToken.findOneAndUpdate(
{ tokenHash: hashToken(refreshToken) },
{ isRevoked: true },
);
}
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: config.isProd,
      sameSite: "lax",
    })
const response: ApiResponse<null> = {
success: true,
message: "Logged out successfully",
data: null,
}
res.status(200).json(response);
}

export const updateEmail = async (req: Request, res: Response) => {
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
user.emailVerified = false;
await user.save();
// Changing the account email invalidates sessions and pending verify links.
await RefreshToken.updateMany({ userId }, { isRevoked: true });
await sendVerificationEmail(userId, email);
return res.status(200).json({ message: "Email updated successfully" });
}

export const verifyEmail = async (req: Request, res: Response) => {
  const userId = await consumeEmailToken(String(req.body.token), "verify-email");
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "This verification link is invalid, expired, or already used.",
      data: null,
    });
  }
  await User.updateOne({ _id: userId }, { emailVerified: true });
  return res.status(200).json({
    success: true,
    message: "Email verified successfully.",
    data: null,
  });
};

export const resendVerification = async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  // Be intentionally vague so the endpoint can't be used to probe accounts.
  if (user && user.isActive && !user.emailVerified) {
    await sendVerificationEmail(user._id.toString(), email);
  }
  return res.status(200).json({
    success: true,
    message: "If the account exists and is unverified, a new link has been sent.",
    data: null,
  });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  // Same vague response for found/missing accounts (no enumeration).
  if (user && user.isActive && user.accountType !== "dependent") {
    try {
      const token = await issueEmailToken(user._id.toString(), "reset-password");
      await sendEmail({
        to: email,
        subject: "Reset your Reperto password",
        html: resetPasswordEmailHtml(buildActionLink("reset-password", token)),
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }
  }
  return res.status(200).json({
    success: true,
    message: "If an account exists for that email, a password reset link has been sent.",
    data: null,
  });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  const userId = await consumeEmailToken(String(token), "reset-password");
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "This reset link is invalid, expired, or already used.",
      data: null,
    });
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  await User.updateOne({ _id: userId }, { password: hashedPassword });
  // Invalidate every session so stale tokens cannot be reused.
  await RefreshToken.updateMany({ userId }, { isRevoked: true });
  return res.status(200).json({
    success: true,
    message: "Password reset successfully. Please log in with your new password.",
    data: null,
  });
};

export const updatePhone = async (req: Request, res: Response) => {
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
}

export const updatePassword = async (req: Request, res: Response) => {
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
}