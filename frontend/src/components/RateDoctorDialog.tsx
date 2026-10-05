import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DoctorReviews } from "@/components/DoctorReviews";
import { useAuthStore } from "@/store/authStore";

type RateDoctorDialogProps = {
  doctorId: string;
  doctorName: string;
  /** Fires after the patient saves or removes their review. */
  onChanged?: () => void;
  /** Compact trigger for use inside a doctor card. */
  variant?: "outline" | "ghost" | "default" | "link";
  triggerLabel?: string;
  className?: string;
};

/**
 * Entry point for rating a doctor from anywhere a doctor is listed. Uses a
 * Sheet to match the other drill-in panels in this app (reports, family).
 *
 * Patients only — the review endpoint is patient-scoped, so for staff/doctor
 * accounts the trigger degrades to an explanatory note rather than a button
 * that would 403 on save.
 */
export function RateDoctorDialog({
  doctorId,
  doctorName,
  onChanged,
  variant = "outline",
  triggerLabel = "Reviews",
  className,
}: RateDoctorDialogProps) {
  const { user } = useAuthStore();

  if (user?.role !== "patient") {
    return (
      <p className={className ?? "text-xs text-muted-foreground"}>
        Patients can rate a doctor after their completed visit.
      </p>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant={variant} className={className}>
          <Star className="size-3.5" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Ratings for {doctorName}</SheetTitle>
          <SheetDescription>
            Share how your appointment went, or read what other patients said.
          </SheetDescription>
        </SheetHeader>
        <DoctorReviews
          doctorId={doctorId}
          doctorName={doctorName}
          onChanged={onChanged}
        />
      </SheetContent>
    </Sheet>
  );
}
