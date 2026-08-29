import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { FieldGroup, FieldLabel, Field, FieldError } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { resetPassword } from "@/api/auth";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { z } from "zod";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type resetPasswordFormSchema = z.infer<typeof resetPasswordSchema>;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [done, setDone] = useState(false);
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<resetPasswordFormSchema>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (formData: resetPasswordFormSchema) => {
    if (!token) {
      toast.error("This reset link is missing its token. Please use the link from your email.");
      return;
    }
    try {
      const response = await resetPassword(token, formData.newPassword);
      if (response.data.success) {
        setDone(true);
        toast.success(response.data.message || "Password reset successfully.");
      } else {
        toast.error(response.data.message || "Could not reset the password.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "This reset link is invalid or has expired."));
    }
  };

  return (
    <div className="w-[400px] sm:w-[450px] mx-auto p-4 shrink-0">
      <Card className="w-full shadow-md border border-neutral-100">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">Reset Password</CardTitle>
            <CardDescription className="text-center text-neutral-500">Choose a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <p className="text-sm text-neutral-600 text-center leading-relaxed">
                Your password has been reset. You can now log in with your new password.
              </p>
            ) : (
              <FieldGroup>
                <Controller
                  name="newPassword"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name} className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">New Password</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="********"
                        type="password"
                        className="w-full h-10"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="confirmPassword"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name} className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">Confirm Password</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="********"
                        type="password"
                        className="w-full h-10"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldGroup>
            )}
          </CardContent>
          {!done && (
            <CardFooter className="flex justify-center items-center">
              <Button type="submit" disabled={isSubmitting} className="w-full py-5 font-bold shadow-sm">
                Reset password
              </Button>
            </CardFooter>
          )}
        </form>
        {done && <Link to="/login" className="text-sm text-primary text-center block pb-4">Proceed to login</Link>}
      </Card>
    </div>
  );
};

export default ResetPassword;