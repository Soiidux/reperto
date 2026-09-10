import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/api/notification";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 30_000;

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshUnread = async () => {
    try {
      const { data } = await getUnreadCount();
      setUnread(data.data?.unread ?? 0);
    } catch {
      // Bell badge refresh failures are silent; next poll retries.
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const [listRes, unreadRes] = await Promise.all([
        getNotifications(10),
        getUnreadCount(),
      ]);
      setNotifications(listRes.data.data ?? []);
      setUnread(unreadRes.data.data?.unread ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUnread();
    const timer = setInterval(refreshUnread, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) loadNotifications();
  };

  const handleClick = async (notification: Notification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification._id);
      } catch {
        // best-effort: still navigate below
      }
      setUnread((count) => Math.max(0, count - 1));
      setNotifications((list) =>
        list.map((n) =>
          n._id === notification._id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
    } catch {
      // best-effort
    }
    setUnread(0);
    setNotifications((list) =>
      list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary"
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-700">Notifications</h3>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-400">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-400">
              No notifications yet
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {notifications.map((notification) => (
                <li key={notification._id}>
                  <button
                    type="button"
                    onClick={() => handleClick(notification)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50",
                      !notification.readAt && "bg-amber-50/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        notification.readAt ? "bg-neutral-200" : "bg-primary",
                      )}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium text-neutral-800">
                        {notification.title}
                      </span>
                      <span className="line-clamp-2 text-xs text-neutral-500">
                        {notification.body}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-neutral-100 p-2">
          <Badge variant="secondary" className="w-full justify-center py-1.5">
            {unread} unread notification{unread === 1 ? "" : "s"}
          </Badge>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;