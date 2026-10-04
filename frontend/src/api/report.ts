import API from "./axios";

export interface ReportFile {
  /** Direct CDN link for Cloudinary-hosted files (images). */
  url?: string;
  /** Cloudinary public id, when stored in Cloudinary. */
  publicId?: string;
  /** GridFS id, when the bytes live in MongoDB (PDFs). */
  storageId?: string;
  storage?: "cloudinary" | "gridfs";
  name: string;
  mimeType: string;
  size: number;
  resourceType: string;
}

export interface Report {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  };
  uploadedBy: {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role: string;
  };
  title: string;
  category: "lab" | "imaging" | "test" | "other";
  description?: string;
  files: ReportFile[];
  createdAt: string;
}

export const uploadReport = async (formData: FormData) => {
  const response = await API.post("/report", formData);
  return response;
};

export const getPatientReports = async (patientId: string) => {
  const response = await API.get("/report", { params: { patientId } });
  return response;
};

export const deleteReport = async (id: string) => {
  const response = await API.delete(`/report/${id}`);
  return response;
};

/**
 * Open a report file.
 *
 * PDFs live in MongoDB and are only reachable through our API (which needs the
 * auth token), so they're fetched as a blob and handed to the browser as an
 * object URL — a plain <a href> can't carry the header. Cloudinary-hosted
 * images should be opened directly by the caller.
 */
export const openReportFile = async (
  reportId: string,
  index: number,
): Promise<void> => {
  const response = await API.get<Blob>(`/report/${reportId}/file/${index}`, {
    responseType: "blob",
  });

  const stored = getStoredReportFile(reportId, index);
  const headerType = response.headers["content-type"];
  const type =
    stored?.mimeType ||
    (typeof headerType === "string" ? headerType : undefined) ||
    "application/octet-stream";
  const objectUrl = URL.createObjectURL(new Blob([response.data], { type }));
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  // Give the new tab time to start reading the blob before revoking it.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

/** Remembered from the last list response, so the click handler can decide. */
let fileIndex: { reportId: string; index: number; file: ReportFile }[] = [];

export const rememberReportFiles = (
  reportId: string,
  files: ReportFile[],
): void => {
  fileIndex = files.map((file, index) => ({ reportId, index, file }));
};

const getStoredReportFile = (
  reportId: string,
  index: number,
): ReportFile | null => {
  const found = fileIndex.find(
    (entry) => entry.reportId === reportId && entry.index === index,
  );
  return found?.file ?? null;
};

/** Direct API path for a report file (still requires the auth token). */
export const getReportFileUrl = (reportId: string, index: number): string =>
  `/api/report/${reportId}/file/${index}`;