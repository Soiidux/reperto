import { useEffect, useState } from "react";
import { toast } from "sonner";
import ReportsPage from "@/components/ReportsPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/lib/utils";
import { type FamilyMember, getFamilyMembers } from "@/api/user";

export default function PatientReports() {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedId, setSelectedId] = useState<string>(user?.id ?? "");

  useEffect(() => {
    let active = true;
    getFamilyMembers()
      .then((response) => {
        if (!active) return;
        const list: FamilyMember[] = response.data?.data ?? [];
        setMembers(list.filter((m) => m.isActive));
      })
      .catch((err: unknown) => {
        if (!active) return;
        toast.error(getErrorMessage(err, "Failed to load family members"));
      });
    return () => {
      active = false;
    };
  }, []);

  const selected =
    selectedId === user?.id
      ? user?.name
      : members.find((m) => m._id === selectedId)?.name ?? "the patient";

  if (members.length === 0) {
    return <ReportsPage patientId={user?.id ?? ""} patientName={user?.name} allowUpload />;
  }

  return (
    <ReportsPage
      patientId={selectedId || user?.id || ""}
      patientName={selected}
      allowUpload
      memberSwitcher={
        <Select value={selectedId || user?.id || ""} onValueChange={setSelectedId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Choose member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={user?.id ?? ""}>Me ({user?.name ?? "self"})</SelectItem>
            {members.map((m) => (
              <SelectItem key={m._id} value={m._id}>
                {m.name} ({m.relationship})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}