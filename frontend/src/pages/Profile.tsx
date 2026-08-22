import { useRef, useState } from "react";
import { Controller, useForm, type Control, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldLabel, Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { updateEmail, updatePhone, updatePassword } from "@/api/auth";
import { updateProfileImage } from "@/api/user";
import { getErrorMessage } from "@/lib/utils";
import { emailSchema, phoneSchema, passwordSchema } from "@/lib/zodSchemas";
import type { emailFormSchema, phoneFormSchema, passwordFormSchema } from "@/lib/zodSchemas";

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires onChange
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2 MB");
      return;
    }
    setIsUploading(true);
    try {
      const response = await updateProfileImage(file);
      const imageUrl: string | undefined = response.data?.data?.profileImageUrl;
      setUser({ profileImageUrl: imageUrl });
      toast.success("Profile photo updated");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to upload photo"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Profile Settings</h1>
        <p className="text-sm text-neutral-500">Manage your personal information and security.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={`${user.name}'s profile`}
                  className="h-14 w-14 rounded-full object-cover border border-neutral-200"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {user?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
              <button
                type="button"
                aria-label="Change profile photo"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/80 disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFilePicked}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-neutral-900">{user?.name}</p>
              <p className="truncate text-sm text-neutral-500">{user?.email || "—"}</p>
            </div>
            <Badge className="ml-auto capitalize">{user?.role}</Badge>
          </div>
          <Separator />
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Detail label="Email" value={user?.email} />
            <Detail label="Phone" value="—" />
            <Detail label="Role" value={user?.role} />
            <Detail label="Member since" value={new Date().getFullYear().toString()} />
          </dl>
        </CardContent>
      </Card>

      <UpdateEmailCard />
      <UpdatePhoneCard />
      <UpdatePasswordCard />
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-1 text-neutral-800">{value || "—"}</dd>
    </div>
  );
}

function Separator() {
  return <div className="h-px w-full bg-neutral-100" />;
}

function UpdateEmailCard() {
  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<emailFormSchema>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (formData: emailFormSchema) => {
    try {
      const response = await updateEmail(formData);
      toast.success(response.data.message || "Email updated successfully");
      reset();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to update email");
      toast.error(message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Update Email</CardTitle>
        <CardDescription>Confirm your password to change your email address.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent>
          <FieldGroup>
            <PasswordControlledField control={control} name="password" label="Current Password" placeholder="********" />
            <TextControlledField control={control} name="email" label="New Email" placeholder="johndoe@example.com" type="email" />
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>Update Email</Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function UpdatePhoneCard() {
  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<phoneFormSchema>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "", password: "" },
  });

  const onSubmit = async (formData: phoneFormSchema) => {
    try {
      const response = await updatePhone(formData);
      toast.success(response.data.message || "Phone updated successfully");
      reset();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to update phone");
      toast.error(message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Update Phone</CardTitle>
        <CardDescription>Confirm your password to change your phone number.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent>
          <FieldGroup>
            <PasswordControlledField control={control} name="password" label="Current Password" placeholder="********" />
            <TextControlledField control={control} name="phone" label="New Phone" placeholder="+91 98765 43210" />
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>Update Phone</Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function UpdatePasswordCard() {
  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<passwordFormSchema>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { oldPassword: "", newPassword: "" },
  });

  const onSubmit = async (formData: passwordFormSchema) => {
    try {
      const response = await updatePassword(formData);
      toast.success(response.data.message || "Password updated successfully");
      reset();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to update password");
      toast.error(message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Update Password</CardTitle>
        <CardDescription>Choose a strong, unique password.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent>
          <FieldGroup>
            <PasswordControlledField control={control} name="oldPassword" label="Current Password" placeholder="********" />
            <PasswordControlledField control={control} name="newPassword" label="New Password" placeholder="********" />
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>Update Password</Button>
        </CardFooter>
      </form>
    </Card>
  );
}

type TextFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  type?: string;
};

function TextControlledField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type = "text",
}: TextFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name} className="text-sm font-bold text-primary w-full">{label}</FieldLabel>
          <Input
            {...field}
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

function PasswordControlledField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
}: TextFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name} className="text-sm font-bold text-primary w-full">{label}</FieldLabel>
          <Input
            {...field}
            id={field.name}
            placeholder={placeholder}
            type="password"
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