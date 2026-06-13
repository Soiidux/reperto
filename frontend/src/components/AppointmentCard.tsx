import { Calendar as CalendarIcon, Clock, User, Hourglass, Hand, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card"; // Adjust paths to your primitives
import { Badge } from "@/components/ui/badge";
import getAge from "@/utils/getAge";
import { get } from "react-hook-form";

// import { Button } from "@/components/ui/button";

const statusStyles: Record<string, { label: string; variantClass: string }> = {
  pending: { label: "Pending", variantClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50" },
  arrived: { label: "Arrived", variantClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50" },
  completed: { label: "Completed", variantClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50" },
  cancelled: { label: "Cancelled", variantClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50" },
  no_show: { label: "No Show", variantClass: "bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700" },
};

interface AppointmentCardProps {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    gender: string;
    dateOfBirth: string;
    profileImageUrl?: string;
  } | string; // Polished to adapt if patientId is populated or raw ID string
  doctorId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  } | string; // Polished to adapt if doctorId is populated or raw ID string
  appointmentDate: string;
  timeSlot: string;
  durationInMinutes: number;
  status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
  consultationType: 'Initial' | 'Follow-up' | 'Acute';
}
export default function AppointmentCard({ _id, patientId, doctorId, appointmentDate, timeSlot, durationInMinutes, status, consultationType }: AppointmentCardProps) {
  const currentStatus = statusStyles[status] || statusStyles.pending;
  
  // Clean string formatter for human-readable Indian local timeline presentation
  const formattedDate = new Date(appointmentDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC" // Enforces standard layout date extraction without wiggling midnight bounds
  });

  return (
    <Card className="w-full max-w-md border border-neutral-200/70 bg-white dark:bg-neutral-900/50 shadow-xs hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden group">
      

      {/* Card Body: Dynamic Field Presentation Metrics */}
      <CardContent className="p-4 space-y-3.5">
        
        {/* Row 1: Attending Medical Practitioner */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 text-neutral-600 dark:text-neutral-300">
              {typeof doctorId === 'string' && typeof patientId !== 'string' ? (
                <img
                  src={typeof patientId === 'string' ? patientId : patientId.profileImageUrl}
                  alt="Patient Profile"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <img 
                  src={typeof doctorId === 'string' ? doctorId : doctorId.profileImageUrl} 
                  alt="Doctor Profile" 
                  className="w-full h-full object-cover rounded-lg"
                />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium">{typeof doctorId !== 'string' ? 'Attending Physician' : 'Patient'}</span>
              <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 truncate">
                {typeof doctorId === 'string' && typeof patientId !== 'string' ? (
                  <span>{typeof patientId === 'string' ? patientId : patientId.name}</span>
                ) : (
                  <span>{typeof doctorId === 'string' ? doctorId || "Assigned Clinic Doctor" : doctorId.name || "Assigned Clinic Doctor"}</span>
                )}
              </span>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border tracking-wide shadow-2xs ${currentStatus.variantClass}`}
          >
            {currentStatus.label}
          </Badge>
        </div>
        <div className="h-[1px] bg-neutral-100 dark:bg-neutral-800/60 w-full" />

        {/* Row 2: Grid Summary Details */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-2">

          {typeof patientId !== 'string' && (
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] text-muted-foreground font-medium">Gender</span>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {patientId.gender.charAt(0).toUpperCase() + patientId.gender.slice(1)}
                </span>
              </div>
            </div>
          )}

          {typeof patientId !== 'string' && (
            <div className="flex items-start gap-2">
              <CalendarIcon className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] text-muted-foreground font-medium">Age</span>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {getAge(patientId.dateOfBirth)}
                </span>
              </div>
            </div>
          )}

          
          {/* Calendar Block */}
          <div className="flex items-start gap-2">
            <CalendarIcon className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground font-medium">Date</span>
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                {formattedDate}
              </span>
            </div>
          </div>

          {/* Time Slot Block */}
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground font-medium">Time Window</span>
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                {timeSlot}
              </span>
            </div>
          </div>

          {/* Session Duration Block */}
          <div className="flex items-start gap-2">
            <Hourglass className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground font-medium">Duration</span>
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                {durationInMinutes} Mins
              </span>
            </div>
          </div>

          {/* Case Session Designation Block */}
          {consultationType && (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] text-muted-foreground font-medium">Session Type</span>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {consultationType}
                </span>
              </div>
            </div>
          )}

        </div>
      </CardContent>

      {/* Card Footer: Contextual Patient Cancellation Actions */}
      
    </Card>
  );
}