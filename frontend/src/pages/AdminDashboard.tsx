import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, UserPlus, CalendarDays, CalendarCheck, ClipboardCheck, Stethoscope, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/StatCard";
import CreateUserDialog from "@/components/CreateUserDialog";
import { getAdminStats, getAllUsers, toggleUserActive, type AdminStats, type UserSummary } from "@/api/admin";
import { getErrorMessage } from "@/lib/utils";

const roleColor: Record<string, string> = {
  admin: "bg-violet-100 text-violet-700",
  doctor: "bg-blue-100 text-blue-700",
  staff: "bg-amber-100 text-amber-700",
  patient: "bg-emerald-100 text-emerald-700",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const applyUsers = (response: { data: { data: UserSummary[]; pagination: { totalPages: number; totalItems: number } } }) => {
    setUsers(response.data.data);
    setTotalPages(response.data.pagination.totalPages);
    setTotalItems(response.data.pagination.totalItems);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await getAllUsers({
        search: search || undefined,
        role: roleFilter,
        page,
        limit: 10,
      });
      applyUsers(response);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const response = await getAllUsers({
          search: search || undefined,
          role: roleFilter,
          page,
          limit: 10,
        });
        applyUsers(response);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load users"));
      } finally {
        setLoading(false);
      }
    })();
  }, [page, roleFilter, search]);

  useEffect(() => {
    const delay = setTimeout(() => {
      setPage(1);
      (async () => {
        setLoading(true);
        try {
          const response = await getAllUsers({
            search: search || undefined,
            role: roleFilter,
            page: 1,
            limit: 10,
          });
          applyUsers(response);
        } catch (err: unknown) {
          toast.error(getErrorMessage(err, "Failed to load users"));
        } finally {
          setLoading(false);
        }
      })();
    }, 400);
    return () => clearTimeout(delay);
  }, [search, roleFilter]);

  useEffect(() => {
    (async () => {
      try {
        const response = await getAdminStats();
        setStats(response.data.data);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load stats"));
      }
    })();
  }, []);

  const handleToggle = async (user: UserSummary) => {
    setTogglingId(user._id);
    try {
      await toggleUserActive(user._id, !user.isActive);
      toast.success(`User ${user.isActive ? "deactivated" : "activated"}`);
      await loadUsers();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update user"));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Admin Dashboard</h1>
          <p className="text-sm text-neutral-500">System overview and user management.</p>
        </div>
        <CreateUserDialog onCreated={() => loadUsers()} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard title="Patients" value={stats.totalPatients} icon={Users} />
            <StatCard title="Doctors" value={stats.totalDoctors} icon={Stethoscope} />
            <StatCard title="Staff" value={stats.totalStaff} icon={UserPlus} />
            <StatCard title="Total Appointments" value={stats.totalAppointments} icon={CalendarDays} />
            <StatCard title="Today's Appointments" value={stats.todaysAppointments} icon={CalendarCheck} />
            <StatCard title="Pending Appointments" value={stats.pendingAppointments} icon={Clock3 } />
            <StatCard title="Completed Consultations" value={stats.completedConsultations} icon={ClipboardCheck} />
          </>
        ) : (
          Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">User Directory</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Search by name, email, or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="patient">Patient</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-neutral-400">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Phone</th>
                    <th className="pb-3 pr-4 font-medium">Role</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-400">No users found</td>
                    </tr>
                  )}
                  {users.map((user) => (
                    <tr key={user._id} className="border-b border-neutral-100">
                      <td className="py-3 pr-4 font-medium text-neutral-900">{user.name}</td>
                      <td className="py-3 pr-4 text-neutral-600">{user.email}</td>
                      <td className="py-3 pr-4 text-neutral-600">{user.phone}</td>
                      <td className="py-3 pr-4">
                        <Badge className={`${roleColor[user.role] || ""} capitalize`}>{user.role}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={user.isActive ? "outline" : "destructive"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={togglingId === user._id}
                          onClick={() => handleToggle(user)}
                        >
                          {togglingId === user._id ? "..." : user.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
            <span>{totalItems} user(s)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <span className="px-2 py-1.5">Page {page} of {totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}