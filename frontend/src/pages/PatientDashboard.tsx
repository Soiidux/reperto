import { useAuthStore } from "@/store/authStore";

export default function PatientDashboard() {
  const { user } = useAuthStore();
  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
    </div>
  );
}