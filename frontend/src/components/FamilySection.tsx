import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Copy, Plus, RefreshCw, LogOut, Trash2, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabel, Field } from "./ui/field";
import getAge from "@/utils/getAge";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/lib/utils";
import {
  type FamilyMember,
  createFamilyMember,
  getFamilyMembers,
  addFamilyByCode,
  getMyShareCode,
  leaveFamilyMember,
  regenerateShareCode,
  removeFamilyMember,
  removeGuardian,
} from "@/api/user";

export default function FamilySection({ onChange }: { onChange?: (members: FamilyMember[]) => void }) {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [myCode, setMyCode] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await getFamilyMembers();
      const list: FamilyMember[] = response.data?.data ?? [];
      setMembers(list);
      onChange?.(list.filter((m) => m.isActive));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to load family members"));
    } finally {
      setIsLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    // Promise-chain keeps state updates out of the synchronous effect pass
    let active = true;
    if (user?.role === "patient") {
      getFamilyMembers()
        .then((response) => {
          if (!active) return;
          const list: FamilyMember[] = response.data?.data ?? [];
          setMembers(list);
          onChange?.(list.filter((m) => m.isActive));
        })
        .catch((err: unknown) => {
          if (!active) return;
          toast.error(getErrorMessage(err, "Failed to load family members"));
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
      // Every patient has a family code they can share to be added
      getMyShareCode()
        .then((resp) => {
          if (active) setMyCode(resp.data?.data?.shareCode ?? "");
        })
        .catch(() => {
          // The code is a convenience — never block the page over it.
        });
    }
    return () => {
      active = false;
    };
  }, [user?.role]);

  if (user?.role !== "patient") return null;

  const activeMembers = members.filter((m) => m.isActive);

  const copyMyCode = async () => {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      toast.success("Your family code copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Family Members</CardTitle>
          <p className="text-sm text-neutral-500">
            Book and manage appointments for people you care for.
          </p>
        </div>
        <AddMemberSheet onCreated={refresh} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The user's own code: share it so family can add you */}
        <div className="flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-100 px-2.5 py-1.5">
          <KeyRound className="size-3.5 text-neutral-400" />
          <span className="text-sm text-neutral-500">Your family code</span>
          <span className="font-mono text-xs tracking-wider text-neutral-700">{myCode || "—"}</span>
          <button
            type="button"
            aria-label="Copy your family code"
            onClick={copyMyCode}
            disabled={!myCode}
            className="ml-auto text-neutral-400 hover:text-primary disabled:opacity-40"
          >
            <Copy className="size-3.5" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : activeMembers.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No family members yet. Add someone by their family code, or create a profile for them.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeMembers.map((member) => (
              <MemberCard key={member._id} member={member} onChanged={refresh} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemberCard({
  member,
  onChanged,
}: {
  member: FamilyMember;
  onChanged: () => void;
}) {
  const { user } = useAuthStore();
  // "Creator" of a created dependent profile; real (self) accounts have no
  // creator — their own account is in charge, so the viewing guardian is
  // always a co-guardian there.
  const isDependent = member.accountType !== "self";
  const isCreator = isDependent && member.createdBy === user?.id;
  const coGuardians = member.guardians.filter((g) => g._id !== user?.id);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(member.shareCode || "");
      toast.success("Share code copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleRegenerate = async () => {
    try {
      await regenerateShareCode(member._id);
      toast.success("New share code generated");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to regenerate code"));
    }
  };

  // Creator removes a co-guardian; anyone can leave themselves
  const handleRemoveGuardian = async (guardianId: string, name: string) => {
    if (!window.confirm(`Remove ${name}'s access to ${member.name}?`)) return;
    try {
      await removeGuardian(member._id, guardianId);
      toast.success(`${name} no longer has access`);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to remove guardian"));
    }
  };

  const handleLeave = async () => {
    if (!window.confirm(`Give up your access to ${member.name}?`)) return;
    try {
      await leaveFamilyMember(member._id);
      toast.success("You no longer manage this member");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to leave"));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${member.name}? Their records are preserved.`)) return;
    try {
      await removeFamilyMember(member._id);
      toast.success("Family member removed");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to remove"));
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 p-3.5 space-y-3">
      <div className="flex items-center gap-3">
        {member.profileImageUrl ? (
          <img
            src={member.profileImageUrl}
            alt={member.name}
            className="h-10 w-10 rounded-full object-cover border border-neutral-200"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {member.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">{member.name}</p>
          <p className="text-xs capitalize text-neutral-500">
            {member.relationship || "Family member"} · {getAge(member.dateOfBirth)} yrs
          </p>
        </div>
        {member.relationship && (
          <Badge variant="outline" className="ml-auto capitalize">
            {member.relationship}
          </Badge>
        )}
      </div>

      {/* Share code: visible to every guardian, rotated by the creator */}
      <div className="flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-100 px-2.5 py-1.5">
        <span className="font-mono text-xs tracking-wider text-neutral-700">
          {member.shareCode}
        </span>
        <button
          type="button"
          aria-label="Copy share code"
          onClick={copyCode}
          className="ml-auto text-neutral-400 hover:text-primary"
        >
          <Copy className="size-3.5" />
        </button>
        {isCreator && (
          <button
            type="button"
            aria-label="Regenerate share code"
            onClick={handleRegenerate}
            className="text-neutral-400 hover:text-primary"
          >
            <RefreshCw className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {coGuardians.map((g) => (
          <span
            key={g._id}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
          >
            {g.name}
            {isCreator && (
              <button
                type="button"
                aria-label={`Remove ${g.name}`}
                onClick={() => handleRemoveGuardian(g._id, g.name)}
                className="text-neutral-400 hover:text-destructive"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!isCreator && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleLeave}
            className="ml-auto h-7 text-xs text-neutral-500"
          >
            <LogOut className="size-3 mr-1" /> Leave
          </Button>
        )}
        {isCreator && isDependent && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            className="ml-auto h-7 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3 mr-1" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function AddMemberSheet({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"code" | "profile">("code");
  const [code, setCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);

  const reset = () => {
    setMode("code");
    setCode("");
    setPhoto(null);
    setOpen(false);
  };

  const handleAddByCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await addFamilyByCode(code.trim().toUpperCase());
      toast.success(response.data?.message || "Family member added");
      reset();
      onCreated();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Invalid or expired family code"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (photo) data.append("profileImage", photo);
    setIsSaving(true);
    try {
      await createFamilyMember(data);
      toast.success("Family member added");
      form.reset();
      setPhoto(null);
      setOpen(false);
      onCreated();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to add family member"));
    } finally {
      setIsSaving(false);
    }
  };

  const modeTab = (value: "code" | "profile", label: string, hint: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      // Reads as a toggle group, so expose the pressed state.
      aria-pressed={mode === value}
      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
        mode === value
          ? "bg-white text-neutral-900 shadow-sm"
          : "text-neutral-500 hover:text-neutral-700"
      }`}
    >
      <span className="block">{label}</span>
      <span className="block font-normal text-neutral-400">{hint}</span>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1" /> Add
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add family member</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1">
            {modeTab("code", "Has an account", "add by their family code")}
            {modeTab("profile", "No account", "create a profile for them")}
          </div>

          {mode === "code" ? (
            <form onSubmit={handleAddByCode} className="space-y-4">
              <Field>
                <FieldLabel>Family code</FieldLabel>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="FAM-XXXXXX"
                  className="font-mono tracking-wider"
                  required
                />
                <p className="text-xs text-neutral-400">
                  Ask the person for their family code — they can find it in
                  their own Profile → Family Members.
                </p>
              </Field>
              <Button type="submit" disabled={isSaving} className="w-full">
                {isSaving ? "Adding…" : "Add member"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <Field>
                <FieldLabel>Name *</FieldLabel>
                <Input name="name" required placeholder="Full name" autoComplete="off" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Gender *</FieldLabel>
                  <Select name="gender" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Relationship *</FieldLabel>
                  <Select name="relationship" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel>Date of birth *</FieldLabel>
                <Input name="dateOfBirth" type="date" required max={new Date().toISOString().slice(0, 10)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Blood group</FieldLabel>
                  <Select name="bloodGroup">
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Phone</FieldLabel>
                  <Input name="phone" inputMode="numeric" pattern="\d{10}" maxLength={10} placeholder="Optional" />
                </Field>
              </div>
              <Field>
                <FieldLabel>Photo</FieldLabel>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Choose image
                  </Button>
                  {photo && <span className="text-xs text-neutral-500 truncate">{photo.name}</span>}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  />
                </div>
              </Field>
              <Button type="submit" disabled={isSaving} className="w-full">
                {isSaving ? "Adding…" : "Add member"}
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}