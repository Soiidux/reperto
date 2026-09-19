import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import { updateProfileImage } from "@/api/user";
import FamilySection from "@/components/FamilySection";
import { getErrorMessage } from "@/lib/utils";

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
        <p className="text-sm text-neutral-500">Update your profile photo and manage family members.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile Photo</CardTitle>
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
          </div>
        </CardContent>
      </Card>

      <FamilySection />
    </div>
  );
}