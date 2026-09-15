import {
  Calendar as CalendarIcon,
  Download,
  Printer,
  Receipt,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { getInvoices, getInvoicePdf } from "@/api/invoice";

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

const statusStyles: Record<Invoice["status"], string> = {
  issued: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export default function PatientInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const response = await getInvoices();
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
  }, []);

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

  const formatAmount = (value: number) =>
    `₹ ${value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <span className="text-sm text-gray-500">{count} Invoices</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {invoices.length !== 0 ? (
          invoices.map((invoice) => (
            <Card
              key={invoice._id}
              className="w-full max-w-md border border-neutral-200/70 bg-white dark:bg-neutral-900/50 shadow-xs hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden"
            >
              <CardContent className="p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50">
                      <Receipt className="w-5 h-5 text-neutral-500" />
                    </div>
                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                      {invoice.invoiceNumber}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusStyles[invoice.status]}`}
                  >
                    {invoice.status}
                  </span>
                </div>

                <div className="h-[1px] bg-neutral-100 dark:bg-neutral-800/60 w-full" />

                <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Doctor
                      </span>
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        {invoice.doctorName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <CalendarIcon className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Date
                      </span>
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        {new Date(invoice.consultationDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Receipt className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Session Type
                      </span>
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        {invoice.consultationType}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-lg font-bold text-neutral-800 dark:text-neutral-200">
                      {formatAmount(invoice.amount)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => downloadInvoice(invoice)}>
                    <Download className="size-4 mr-1" /> Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printInvoice(invoice)}>
                    <Printer className="size-4 mr-1" /> Print
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No invoices found.</p>
        )}
      </div>
    </div>
  );
}