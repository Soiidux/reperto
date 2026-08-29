import { useState } from "react";
import ReportsPage from "@/components/ReportsPage";
import PatientCombobox from "@/components/PatientCombobox";

export default function StaffReports() {
  const [patientId, setPatientId] = useState("");

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="max-w-md">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">
          Patient Reports
        </h1>
        <p className="mb-3 text-sm text-neutral-500">
          Select a patient to view or file their lab reports and scans.
        </p>
        <PatientCombobox value={patientId} onChange={setPatientId} />
      </div>
      {patientId ? (
        <ReportsPage patientId={patientId} allowUpload />
      ) : (
        <p className="py-10 text-center text-neutral-400">
          Choose a patient to see their reports.
        </p>
      )}
    </div>
  );
}