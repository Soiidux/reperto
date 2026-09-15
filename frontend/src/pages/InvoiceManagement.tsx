import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Printer,
  Receipt,
  Calendar as CalendarIcon,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/utils";
import {
  getInvoices,
  getInvoicePdf,
  updateInvoiceStatus,
} from "@/api/invoice";
import { getDoctors } from "@/api/user";
import { useAuthStore } from "@/store/authStore";

interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  status: "issued" | "paid" | "cancelled";
  doctorName: string;
  patientName: string;
  consultationType: "Initial" | "Follow-up" | "Acute";
  consultationDate: string;
  createdAt: string;
}

interface DoctorOption {
  _id: string;
  name: string;
}

const statusStyles: Record<Invoice["status"], string> = {
  issued: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const formatAmount = (value: number) =>
  `₹ ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function InvoiceManagement() {
  const { user } = useAuthStore();
  const role = user?.role || "";
  const isDoctorView = role === "doctor";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoctors = async () => {
      if (isDoctorView) return;
      try {
        const response = await getDoctors();
        setDoctors(response.data.data || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchDoctors();
  }, [isDoctorView]);

  useEffect(() => {
    let cancelled = false;
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const response = await getInvoices({
          status: statusFilter,
          ...(doctorFilter === "all" ? {} : { doctorId: doctorFilter }),
        });
        if (cancelled) return;
        setInvoices(response.data.data.invoices || []);
        setCount(response.data.data.count || 0);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.error(getErrorMessage(error, "Failed to load invoices"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchInvoices();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, doctorFilter]);

  const downloadInvoice = async (invoice: Invoice) => {
    try {
      const response = await getInvoicePdf(invoice._id, true);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Invoice downloaded");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to download invoice"));
    }
  };

  const printInvoice = async (invoice: Invoice) => {
    try {
      const response = await getInvoicePdf(invoice._id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Pop-up blocked. Please allow pop-ups to print the invoice.");
        return;
      }
      win.document.write(
        `<html><head><title>Invoice ${invoice.invoiceNumber}</title>` +
          `<style>body{margin:0}#pdf{width:100%;height:100%;border:0}</style>` +
          `</head><body><iframe id="pdf" src="${url}"></iframe></body></html>`,
      );
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          // Print may be blocked while the PDF renders; the tab stays open.
        }
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      }, 600);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to open invoice"));
    }
  };

  const handleStatusChange = async (invoice: Invoice, status: "paid" | "cancelled") => {
    setUpdatingId(invoice._id);
    try {
      await updateInvoiceStatus(invoice._id, status);
      toast.success(`Invoice marked as ${status}`);
      const response = await getInvoices({
        status: statusFilter,
        ...(doctorFilter === "all" ? {} : { doctorId: doctorFilter }),
      });
      setInvoices(response.data.data.invoices || []);
      setCount(response.data.data.count || 0);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update invoice status"));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Invoice Management
          </h1>
          <p className="text-sm text-neutral-500">
            Track and settle consultation invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{count} Invoices</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {!isDoctorView && (
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              {doctors.map((doctor) => (
                <SelectItem key={doctor._id} value={doctor._id}>
                  {doctor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No invoices found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-neutral-400">
                    <th className="pb-3 pr-4 font-medium">Invoice</th>
                    <th className="pb-3 pr-4 font-medium">Patient</th>
                    <th className="pb-3 pr-4 font-medium">Doctor</th>
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice._id} className="border-b border-neutral-100">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Receipt className="size-4 text-neutral-400" />
                          <span className="font-medium text-neutral-900">
                            {invoice.invoiceNumber}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-neutral-700">{invoice.patientName}</td>
                      <td className="py-3 pr-4 text-neutral-700">Dr. {invoice.doctorName}</td>
                      <td className="py-3 pr-4 text-neutral-600">
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon className="size-3.5 text-neutral-400" />
                          {new Date(invoice.consultationDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-neutral-600">{invoice.consultationType}</td>
                      <td className="py-3 pr-4 font-semibold text-neutral-900">
                        {formatAmount(invoice.amount)}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          className={`capitalize ${statusStyles[invoice.status]}`}
                          variant="outline"
                        >
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadInvoice(invoice)}
                          >
                            <Download className="size-3.5 mr-1" /> PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => printInvoice(invoice)}
                          >
                            <Printer className="size-3.5 mr-1" /> Print
                          </Button>
                          {invoice.status === "issued" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updatingId === invoice._id}
                                onClick={() => handleStatusChange(invoice, "paid")}
                              >
                                {updatingId === invoice._id ? (
                                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                                ) : null}
                                Mark Paid
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updatingId === invoice._id}
                                onClick={() => handleStatusChange(invoice, "cancelled")}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}