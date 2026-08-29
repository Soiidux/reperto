import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { FieldGroup, FieldLabel, Field, FieldError } from "./ui/field";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { login, resendVerification } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { loginSchema } from "@/lib/zodSchemas";
import type { loginFormSchema } from "@/lib/zodSchemas";
import { useState } from "react";

const LoginForm = () => {
  const {control , handleSubmit, formState: { isSubmitting }} = useForm<loginFormSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const navigate = useNavigate();
  const loginGlobal = useAuthStore((state) => state.login);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const onSubmit = async (formData: loginFormSchema) => {
    try {
      const response = await login({ email: formData.email, password: formData.password });
      if (response.data.success && response.data.data) {
        const { user, accessToken } = response.data.data;
        loginGlobal(user, accessToken);
        // Non-blocking: verified users proceed; unverified get a resend banner
        // while still being allowed in.
        if (user.emailVerified === false) {
          setUnverifiedEmail(formData.email);
          toast.info("Please verify your email to receive appointment notifications.");
          return;
        }
        navigate(`/${user.role}/dashboard`);
        toast.success("Login successful");
      }
    } catch (err: unknown) {
      const serverErrorMessage = getErrorMessage(err, "Invalid credentials. Please try again.");
      toast.error(serverErrorMessage);
    }
  };
  const handleResend = async () => {
    if (!unverifiedEmail || resending) return;
    setResending(true);
    try {
      const response = await resendVerification(unverifiedEmail);
      toast.success(response.data.message || "Verification link sent. Check your inbox.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not send the verification link."));
    } finally {
      setResending(false);
    }
  };
  return (
    <div className="w-[400px] sm:w-[450px] mx-auto p-4 shrink-0">
      <Card className="w-full shadow-md border border-neutral-100">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">Login</CardTitle>
            <CardDescription className="text-center text-neutral-500">Enter your email and password to log in.</CardDescription>
          </CardHeader>
          <CardContent>
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
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name} className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">Password</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder="********"
                      type="password"
                      className="w-full h-10"
                      aria-invalid={fieldState.invalid}
                      autoComplete="off"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />        
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex justify-center items-center">
            <Button type="submit" disabled={isSubmitting} className="w-full py-5 font-bold shadow-sm">
              Sign In
            </Button>
          </CardFooter>
</form>
        {unverifiedEmail && (
          <div className="px-6 pb-4">
            <div className="border border-amber-300 bg-amber-50 rounded-md p-3 text-sm text-amber-800">
              <p className="font-semibold mb-1">Your email isn't verified yet.</p>
              <p className="text-amber-700 mb-2">Resend the verification link to {unverifiedEmail}.</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending ? "Sending…" : "Resend link"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setUnverifiedEmail(null);
                    const role = JSON.parse(localStorage.getItem("user") || "{}").role;
                    navigate(`/${role || "patient"}/dashboard`);
                  }}
                >
                  Continue anyway
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="text-sm text-primary text-center pb-4">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <Link to="/register" className="text-sm text-primary text-center block pb-4">Don't have an account? Register</Link>
      </Card>
    </div>
  )
  
}

export default LoginForm;