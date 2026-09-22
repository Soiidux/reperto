import { TodayQueue } from "@/components/TodayQueue";

export default function StaffDashboard() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Staff Dashboard</h1>
        <p className="text-sm text-neutral-500">Welcome to the front desk. Manage today's queue.</p>
      </div>

      <TodayQueue />
    </div>
  );
}