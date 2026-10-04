import { v2 as cloudinary } from "cloudinary";
import config from "../config";
import fs from "fs";

cloudinary.config({
  cloud_name: config.cloudinary.name,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Pick the Cloudinary resource type for a file.
 *
 * "auto" is wrong for PDFs: Cloudinary classifies a PDF as an image-type
 * asset, but image delivery only serves image formats, so fetching the stored
 * .pdf URL answers 401 even though the upload succeeded. PDFs and other
 * non-image documents must live under "raw", which delivers the bytes
 * untouched, so the browser gets a real PDF.
 */
export const pickResourceType = (localFilePath: string, mimeType?: string): "image" | "raw" => {
  const type = (mimeType ?? "").toLowerCase();
  if (type === "application/pdf") return "raw";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("text/")) return "raw";
  if (type === "application/json" || type === "application/xml") return "raw";

  // Fall back to the extension when the browser sent no useful type.
  const ext = localFilePath.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", "svg"].includes(ext)) {
    return "image";
  }
  return "raw";
};

export const uploadToCloudinary = async (
  localFilePath: string,
  folder: string,
  mimeType?: string,
) => {
  try {
    if(!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: pickResourceType(localFilePath, mimeType),
      folder: `reperto/${folder}`,
    })
    
    if(fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return response;
  } catch (error) {
    if(fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    console.error("Cloudinary upload error:", error)
    return null;
  }
} 