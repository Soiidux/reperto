import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  FieldLabel,
  Field,
  FieldError,
  FieldSet,
  FieldLegend,
  FieldSeparator,
} from "./ui/field";
import { Input } from "./ui/input";
import { useState } from "react";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { register } from "@/api/auth";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { registerFormSchema } from "@/lib/zodSchemas";
import { registerSchema } from "@/lib/zodSchemas";
const RegisterForm = () => {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<registerFormSchema>({
    resolver: zodResolver(registerSchema),
  });

  const navigate = useNavigate();
  const [open, setOpen] = useState(false);


  const onSubmit = async (formData: registerFormSchema) => {
    try {
      const response = await register(formData);
      if (response.data.success) {
        toast.success("Registration successful! Please log in.");
        navigate("/login");      }
      
    } catch (err: unknown) {
      const serverErrorMessage = (err as any).response?.data.message || "Internal Server Error";
      toast.error(serverErrorMessage);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
      <Card className="w-full shadow-md border-neutral-100">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">
              Create an Account
            </CardTitle>
            <CardDescription className="text-center text-neutral-500">
              Kindly fill in the form below to register your clinical profile.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Personal Information
              </FieldLegend>      
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Controller
                  name="name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex flex-col gap-1.5">
                      <FieldLabel className="font-semibold text-neutral-700" htmlFor={field.name}>Name</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="John Doe"
                        type="text"
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="phone"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex flex-col gap-1.5">
                      <FieldLabel className="font-semibold text-neutral-700" htmlFor={field.name}>Phone</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="9876543210"
                        type="tel"
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="email"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex flex-col gap-1.5">
                      <FieldLabel className="font-semibold text-neutral-700" htmlFor={field.name}>Email</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="johndoe@example.com"
                        type="email"
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="password"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex flex-col gap-1.5">
                      <FieldLabel className="font-semibold text-neutral-700" htmlFor={field.name}>Password</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="********"
                        type="password"
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>
            </FieldSet>
            <FieldSeparator className="my-2 border-neutral-100" />
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Medical Information
              </FieldLegend>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-start">
                <Controller
                  name="gender"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex flex-col gap-1.5">
                      <FieldLabel className="font-semibold text-neutral-700" htmlFor={field.name}>Gender</FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""} 
                        defaultValue={field.value}
                      >
                        <SelectTrigger className="w-full" aria-invalid={fieldState.invalid}>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                />
                <Controller
                  name="dateOfBirth"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Date of Birth
                      </FieldLabel>
                      <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            id={field.name}
                            type="button"
                            aria-invalid={fieldState.invalid}
                            className="w-full justify-start font-normal bg-transparent rounded-md border border-input text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                          >
                            {field.value ? field.value : <span className="text-muted-foreground">Select date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            // Appends a safe local time string space so formatting parses the exact date typed
                            selected={field.value ? new Date(`${field.value}T12:00:00`) : undefined}
                            defaultMonth={field.value ? new Date(`${field.value}T12:00:00`) : undefined}
                            captionLayout="dropdown"
                            onSelect={(selectedDate) => {
                              if (selectedDate) {
                                // 🚀 Extract the year, month, and day based on the user's local timezone
                                const year = selectedDate.getFullYear();
                                const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                                const day = String(selectedDate.getDate()).padStart(2, "0");
                                
                                field.onChange(`${year}-${month}-${day}`);
                                setOpen(false); // Cleanly close popover overlay upon selection
                              } else {
                                field.onChange("");
                              }
                            }}
                            disabled={(date) =>
                              date > new Date(new Date().setHours(0, 0, 0, 0)) || date < new Date("1900-01-01")
                            }
                          />
                        </PopoverContent>
                      </Popover>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="bloodGroup"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex flex-col gap-1.5">
                      <FieldLabel className="font-semibold text-neutral-700" htmlFor={field.name}>Blood Group</FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""} 
                        defaultValue={field.value}
                      >
                        <SelectTrigger className="w-full" aria-invalid={fieldState.invalid}>
                          <SelectValue placeholder="Select Blood Group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A+">A+</SelectItem>
                          <SelectItem value="A-">A-</SelectItem>
                          <SelectItem value="B+">B+</SelectItem>
                          <SelectItem value="B-">B-</SelectItem>
                          <SelectItem value="AB+">AB+</SelectItem>
                          <SelectItem value="AB-">AB-</SelectItem>
                          <SelectItem value="O+">O+</SelectItem>
                          <SelectItem value="O-">O-</SelectItem>
                        </SelectContent>
                          </Select>
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                />
              </div>
            </FieldSet>
          </CardContent>
          <CardFooter className="flex justify-center items-center">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-1/2 md:w-1/3 py-5 font-bold shadow-sm">
              Complete Registration
            </Button>
          </CardFooter>
        </form>
        <Link to="/login" className="text-sm text-primary text-center">Already have an account? Login</Link>
      </Card>
    </div>
  );
}

export default RegisterForm;
