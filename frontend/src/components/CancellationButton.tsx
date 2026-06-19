import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Controller, useForm } from "react-hook-form"
import { cancellationSchema, type cancellationFormSchema } from "@/lib/zodSchemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { updateAppointmentStatus } from "@/api/appointment"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
export function CancellationButton({ appointmentId }: { appointmentId: string }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { control, handleSubmit } = useForm<cancellationFormSchema>({
    resolver: zodResolver(cancellationSchema),
    defaultValues: { reason: ""},
  })
  const submissionHandler = async (data: cancellationFormSchema) => {
    await updateAppointmentStatus(appointmentId, { status: "cancelled", cancellationReason: data.reason })
    navigate(`/${user?.role}/dashboard`);
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="destructive">Cancel Appointment</Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>Cancel Appointment</PopoverTitle>
          <PopoverDescription>
            Are you sure you want to cancel this appointment? This action cannot be undone.
          </PopoverDescription>
        </PopoverHeader>
        <form onSubmit={handleSubmit(submissionHandler)}>
          <div className="flex flex-col justify-center gap-4">
            <FieldGroup>
              <Controller
                name="reason"
                control={control}
                render={({ field, fieldState }) => {
                  return (
                    <Field>
                      <FieldLabel htmlFor="reason">Reason</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Enter reason for cancellation"
                        type="text"
                        aria-invalid={fieldState.invalid}
                      />
                    </Field>
                  )
                }}
              />
            </FieldGroup>
            <Button variant="destructive" type="submit">Cancel</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
