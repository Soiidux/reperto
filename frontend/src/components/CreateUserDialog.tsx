import { useState } from "react";
import { Controller, useForm, type Control, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { FieldLabel, Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { register } from "@/api/auth";
import { getErrorMessage } from "@/lib/utils";
import { createUserSchema } from "@/lib/zodSchemas";
import type { createUserFormSchema } from "@/lib/zodSchemas";

export default function CreateUserDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [doctorExtras, setDoctorExtras] = useState({
    qualifications: "",
    specializations: "",
    languagesSpoken: "",
    experienceYears: "",
    consultationFee: "",
  });

  const { control, handleSubmit, watch, reset, formState: { isSubmitting } } =
    useForm<createUserFormSchema>({
      resolver: zodResolver(createUserSchema),
      defaultValues: {
        name: "",
        email: "",
        password: "",
        phone: "",
        gender: "male",
        dateOfBirth: "",
        bloodGroup: "A+",
        role: "patient",
      },
    });

  const role = watch("role");

  const onSubmit = async (formData: createUserFormSchema) => {
    try {
      const payload: createUserFormSchema & { doctorProfile?: unknown } = { ...formData };
      if (formData.role !== "doctor") {
        delete payload.doctorProfile;
      } else {
        payload.doctorProfile = {
          qualifications: doctorExtras.qualifications ? doctorExtras.qualifications.split(",").map((s) => s.trim()).filter(Boolean) : [],
          specializations: doctorExtras.specializations ? doctorExtras.specializations.split(",").map((s) => s.trim()).filter(Boolean) : [],
          languagesSpoken: doctorExtras.languagesSpoken ? doctorExtras.languagesSpoken.split(",").map((s) => s.trim()).filter(Boolean) : [],
          experienceYears: doctorExtras.experienceYears ? Number(doctorExtras.experienceYears) : undefined,
          consultationFee: doctorExtras.consultationFee ? Number(doctorExtras.consultationFee) : undefined,
        };
      }

      const response = await register(payload);
      if (response.data.success) {
        toast.success(response.data.message || "User created successfully");
        setOpen(false);
        reset();
        setDoctorExtras({
          qualifications: "",
          specializations: "",
          languagesSpoken: "",
          experienceYears: "",
          consultationFee: "",
        });
        onCreated?.();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create user"));
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="size-4" /> Create User
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create New User</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="px-4 pb-4">
          <Card className="border-0 shadow-none">
            <CardContent className="flex flex-col gap-4 p-0">
              <ControlledTextField control={control} name="name" label="Full Name" placeholder="Jane Doe" />
              <ControlledTextField control={control} name="email" label="Email" placeholder="jane@example.com" type="email" />
              <ControlledTextField control={control} name="password" label="Password" placeholder="At least 8 characters" type="password" />
              <ControlledTextField control={control} name="phone" label="Phone" placeholder="10 digit number" />

              <Controller
                name="role"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="role" className="text-sm font-bold text-primary w-full">Role</FieldLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="role"><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patient">Patient</SelectItem>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <ControlledTextField control={control} name="dateOfBirth" label="Date of Birth" placeholder="YYYY-MM-DD" />
                <Controller
                  name="bloodGroup"
                  control={control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="bloodGroup" className="text-sm font-bold text-primary w-full">Blood Group</FieldLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="bloodGroup"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                            <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="gender" className="text-sm font-bold text-primary w-full">Gender</FieldLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="gender"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              {role === "doctor" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="qualifications" className="text-sm font-bold text-primary w-full">Qualifications (comma separated)</FieldLabel>
                    <Input id="qualifications" value={doctorExtras.qualifications} onChange={(e) => setDoctorExtras({ ...doctorExtras, qualifications: e.target.value })} placeholder="BHMS, MD (Homeopathy)" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="specializations" className="text-sm font-bold text-primary w-full">Specializations (comma separated)</FieldLabel>
                    <Input id="specializations" value={doctorExtras.specializations} onChange={(e) => setDoctorExtras({ ...doctorExtras, specializations: e.target.value })} placeholder="Repertory, Acute Care" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="languages" className="text-sm font-bold text-primary w-full">Languages Spoken (comma separated)</FieldLabel>
                    <Input id="languages" value={doctorExtras.languagesSpoken} onChange={(e) => setDoctorExtras({ ...doctorExtras, languagesSpoken: e.target.value })} placeholder="English, Hindi" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="experienceYears" className="text-sm font-bold text-primary w-full">Experience (years)</FieldLabel>
                      <Input id="experienceYears" type="number" min={0} value={doctorExtras.experienceYears} onChange={(e) => setDoctorExtras({ ...doctorExtras, experienceYears: e.target.value })} placeholder="5" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="consultationFee" className="text-sm font-bold text-primary w-full">Consultation Fee</FieldLabel>
                      <Input id="consultationFee" type="number" min={0} value={doctorExtras.consultationFee} onChange={(e) => setDoctorExtras({ ...doctorExtras, consultationFee: e.target.value })} placeholder="500" />
                    </Field>
                  </div>
                </>
              )}

              <Button type="submit" disabled={isSubmitting} className="mt-2">
                {isSubmitting ? "Creating..." : "Create User"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ControlledTextField({ control, name, label, placeholder, type = "text" }: {
  control: Control<createUserFormSchema>;
  name: Path<createUserFormSchema>;
  label: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name} className="text-sm font-bold text-primary w-full">{label}</FieldLabel>
          <Input
            value={typeof field.value === "string" ? field.value : ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            id={field.name}
            placeholder={placeholder}
            type={type}
            className="w-full h-10"
            aria-invalid={fieldState.invalid}
            autoComplete="off"
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}