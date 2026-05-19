import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { FieldGroup, FieldLabel, Field, FieldError } from "./ui/field";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {login} from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { loginSchema } from "@/lib/zodSchemas";
import type { loginFormSchema } from "@/lib/zodSchemas";

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
  const onSubmit = async (formData: loginFormSchema) => {
    try {
      const response = await login({ email: formData.email, password: formData.password });
      if (response.success && response.data) {
        const { user, accessToken } = response.data;
        loginGlobal(user, accessToken);
        navigate(`/${user.role}/dashboard`);
        toast.success("Login successful");
      }
    } catch (err: unknown) {
      const serverErrorMessage = (err as any).response?.message || "Invalid credentials. Please try again.";
      toast.error(serverErrorMessage);
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
        <Link to="/register" className="text-sm text-primary text-center">Don't have an account? Register</Link>
      </Card>
    </div>
  )
  
}


export default LoginForm;