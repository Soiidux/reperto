import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyLeaves, addLeave, removeLeave, type LeaveRecord } from "@/api/leave";
import { getErrorMessage } from "@/lib/utils";
import { leaveSchema } from "@/lib/zodSchemas";
import type { leaveFormSchema } from "@/lib/zodSchemas";

const typeColor: Record<string, string> = {
  "full-day": "bg-rose-100 text-rose-700",
  "half-day": "bg-amber-100 text-amber-700",
  emergency: "bg-red-100 text-red-700",
};

export default function Schedule() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<leaveFormSchema>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: "full-day", startingTime: "", endingTime: "", reason: "" },
  });

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const response = await getMyLeaves();
      setLeaves(response.data.data ?? []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to load leave records"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const response = await getMyLeaves();
        setLeaves(response.data.data ?? []);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load leave records"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSubmit = async (data: leaveFormSchema) => {
    try {
      const response = await addLeave({
        type: data.type,
        startingDate: data.startingDate,
        startingTime: data.startingTime || undefined,
        endingDate: data.endingDate || undefined,
        endingTime: data.endingTime || undefined,
        reason: data.reason || "Personal Leave",
      });
      if (response.data.success) {
        const conflictsHandled = response.data.data?.conflictsHandled ?? 0;
        if (conflictsHandled > 0) {
          toast.success(`Leave added · ${conflictsHandled} appointment(s) flagged for rescheduling`);
        } else {
          toast.success("Leave added successfully");
        }
        reset();
        await loadLeaves();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to add leave"));
    }
  };

  const handleRemove = async (leaveId: string) => {
    try {
      await removeLeave(leaveId);
      toast.success("Leave removed");
      await loadLeaves();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to remove leave"));
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Schedule & Leave</h1>
        <p className="text-sm text-neutral-500">Block unavailable slots so patients can't book them.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Plus className="size-4" /> Add Leave</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel className="text-sm font-bold text-primary w-full">Type</FieldLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-day">Full Day</SelectItem>
                        <SelectItem value="half-day">Half Day</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Controller
                  name="startingDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel className="text-sm font-bold text-primary w-full">Starting Date</FieldLabel>
                      <Input {...field} type="date" className="h-10" aria-invalid={fieldState.invalid} />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="endingDate"
                  control={control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel className="text-sm font-bold text-primary w-full">Ending Date (optional)</FieldLabel>
                      <Input {...field} type="date" className="h-10" />
                    </Field>
                  )}
                />
                <Controller
                  name="startingTime"
                  control={control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel className="text-sm font-bold text-primary w-full">Starting Time (optional)</FieldLabel>
                      <Input {...field} type="time" className="h-10" placeholder="Leave empty for full day" />
                    </Field>
                  )}
                />
                <Controller
                  name="endingTime"
                  control={control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel className="text-sm font-bold text-primary w-full">Ending Time (optional)</FieldLabel>
                      <Input {...field} type="time" className="h-10" />
                    </Field>
                  )}
                />
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel className="text-sm font-bold text-primary w-full">Reason (optional)</FieldLabel>
                      <Input {...field} type="text" className="h-10" placeholder="Personal Leave" />
                    </Field>
                  )}
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="mt-4">
                {isSubmitting ? "Adding..." : "Add Leave"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Leave</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : leaves.length === 0 ? (
            <p className="py-8 text-center text-neutral-400">No leave records yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {leaves.map((leave) => (
                <li key={leave._id} className="flex items-center gap-4 py-3">
                  <CalendarOff className="size-5 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">
                      {new Date(leave.startingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                      {leave.endingDate && (
                        <> → {new Date(leave.endingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</>
                      )}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {leave.reason}
                      {leave.startingTime && ` · ${leave.startingTime}${leave.endingTime ? `–${leave.endingTime}` : ""}`}
                    </p>
                  </div>
                  <Badge className={`${typeColor[leave.type] || ""} capitalize`}>{leave.type}</Badge>
                  <Button size="icon-sm" variant="ghost" onClick={() => handleRemove(leave._id)} aria-label="Remove leave">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}