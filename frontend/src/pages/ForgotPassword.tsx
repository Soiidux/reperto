import { useState } from "react";
import { Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { FieldGroup, FieldLabel, Field, FieldError } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { forgotPassword } from "@/api/auth";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});
type forgotPasswordFormSchema = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword = () => {
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<forgotPasswordFormSchema>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const [sent, setSent] = useState(false);

  const onSubmit = async (formData: forgotPasswordFormSchema) => {
    try {
      const response = await forgotPassword(formData.email);
      if (response.data.success) {
        setSent(true);
      } else {
        toast.error(response.data.message || "Could not send the reset link.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not send the reset link."));
    }
  };

  return (
    <div className="w-[400px] sm:w-[450px] mx-auto p-4 shrink-0">
      <Card className="w-full shadow-md border border-neutral-100">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">Forgot Password</CardTitle>
            <CardDescription className="text-center text-neutral-500">
              Enter your account email and we'll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <p className="text-sm text-neutral-600 text-center leading-relaxed">
                If an account exists for that email, a password reset link has been sent. Please check your inbox (and spam folder).
              </p>
            ) : (
              <FieldGroup>
                <Controller
                  name="email"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name} className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">Email</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="johndoe@example.com"
                        type="email"
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
          {!sent && (
            <CardFooter className="flex justify-center items-center">
              <Button type="submit" disabled={isSubmitting} className="w-full py-5 font-bold shadow-sm">
                Send reset link
              </Button>
            </CardFooter>
          )}
        </form>
        <Link to="/login" className="text-sm text-primary text-center block pb-4">Back to login</Link>
      </Card>
    </div>
  );
};

export default ForgotPassword;