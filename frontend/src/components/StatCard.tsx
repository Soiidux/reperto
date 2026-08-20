import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
}

export default function StatCard({ title, value, icon: Icon, hint }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-500">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-neutral-900">
            {value}
            {hint && <span className="ml-1 text-sm font-medium text-neutral-400">{hint}</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}