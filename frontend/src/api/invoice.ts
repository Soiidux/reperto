import API from "./axios";

export const getInvoices = async (params?: {
  status?: string;
  patientId?: string;
  doctorId?: string;
}) => {
  const response = await API.get("/invoice", { params });
  return response;
};

export const getInvoice = async (invoiceId: string) => {
  const response = await API.get(`/invoice/${invoiceId}`);
  return response;
};

// Idempotent: returns the existing invoice for a consultation if one
// was already auto-generated, otherwise creates it (backfill).
export const generateInvoice = async (consultationId: string) => {
  const response = await API.post(`/invoice/consultation/${consultationId}`);
  return response;
};

export const getInvoicePdf = async (invoiceId: string, download = false) => {
  return await API.get(`/invoice/${invoiceId}/pdf`, {
    params: { download: download ? "1" : undefined },
    responseType: "blob",
  });
};

export const updateInvoiceStatus = async (
  invoiceId: string,
  status: "issued" | "paid" | "cancelled",
) => {
  const response = await API.patch(`/invoice/${invoiceId}/status`, { status });
  return response;
};