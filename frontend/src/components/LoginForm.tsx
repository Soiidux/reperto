import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { FieldGroup, FieldLabel, Field, FieldError } from "./ui/field";
import { Input } from "./ui/input";
import React, { useState } from "react";
import { Button } from "./ui/button";
import {login} from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8,"Password must be at least 8 characters"),
})


type FormSchema = z.infer<typeof loginSchema>;

const LoginForm = () => {
  const {control , handleSubmit, formState: { isSubmitting }} = useForm<FormSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const navigate = useNavigate();
  const loginGlobal = useAuthStore((state) => state.login);
  const onSubmit = async (formData: FormSchema) => {
    try {
      const response = await login({ email: formData.email, password: formData.password });
      if (response.data.success && response.data.data) {
        const { user, accessToken } = response.data.data;
        loginGlobal(user, accessToken);
        navigate(`/${user.role}/dashboard`);
        toast.success("Login successful");
      }
    } catch (err: unknown) {
      const serverErrorMessage = (err as any).response?.data?.message || "Invalid credentials. Please try again.";
      toast.error(serverErrorMessage);
    }
  };
  return (
    <Card className="min-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">Login</CardTitle>
          <CardDescription className="text-center">Enter your email and password to log in.</CardDescription>
        </CardHeader>
        <CardContent>
            <FieldGroup>
              <Controller
                name="email"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder="johndoe@example.com"
                      type="email"
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
                    <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder="Password"
                      type="password"
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
          <Button type="submit" disabled={isSubmitting} className="w-1/2">
            Submit
          </Button>
        </CardFooter>
        </form>
      </Card>
  )
  
}


export default LoginForm;