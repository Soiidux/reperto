import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getClinicSettings, type ClinicSettings } from "@/api/clinic";
import {
  getClinicBlockouts,
  saveClinicBlockout,
  deleteClinicBlockout,
  updateClinicSettings,
  type ClinicBlockout,
} from "@/api/admin";
import { getErrorMessage, formatSlotLabel, formatWindowLabel } from "@/lib/utils";
import {
  CalendarOff,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// 15-minute slot starts for a session like "09:00".."13:00" (the close time
// itself is not bookable — the last slot ends AT close).
const sessionSlots = (open: string, close: string): string[] => {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const slots: string[] = [];
  for (let t = oh * 60 + om; t < ch * 60 + cm; t += 15) {
    slots.push(
      `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
    );
  }
  return slots;
};

const STANDARD_DAY = [...sessionSlots("09:00", "13:00"), ...sessionSlots("14:00", "16:00")];
const PRESETS = {
  "Standard day (9-1, 2-4)": STANDARD_DAY,
  "Morning only (9-1)": sessionSlots("09:00", "13:00"),
  "Afternoon only (2-6)": sessionSlots("14:00", "18:00"),
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const isValidSlot = (t: string) => TIME_RE.test(t) && Number(t.slice(3)) % 15 === 0;

const sortSlots = (slots: string[]) =>
  Array.from(new Set(slots)).sort((a, b) => a.localeCompare(b));

export default function ClinicSettings() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [blockouts, setBlockouts] = useState<ClinicBlockout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTimeByDay, setNewTimeByDay] = useState<Record<number, string>>({});

  // Unavailable-date form
  const [blDate, setBlDate] = useState("");
  const [blAllDay, setBlAllDay] = useState(false);
  const [blSlots, setBlSlots] = useState<string[]>([]);
  const [blReason, setBlReason] = useState("");
  const [savingBlockout, setSavingBlockout] = useState(false);

  const load = useCallback(async () => {
    const [settingsRes, blockoutsRes] = await Promise.all([
      getClinicSettings(),
      getClinicBlockouts(),
    ]);
    if (settingsRes.data?.success) setSettings(settingsRes.data.data);
    if (blockoutsRes.data?.success) setBlockouts(blockoutsRes.data.data ?? []);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => toast.error(getErrorMessage(err, "Could not load clinic settings")))
      .finally(() => setLoading(false));
  }, [load]);

  const patchDay = (day: number, patch: Partial<{ isOpen: boolean; slots: string[] }>) => {
    setSettings((prev) =>
      prev
        ? { ...prev, hours: prev.hours.map((h) => (h.day === day ? { ...h, ...patch } : h)) }
        : prev,
    );
  };

  const toggleDay = (day: number) => {
    const dayEntry = settings?.hours.find((h) => h.day === day);
    if (!dayEntry) return;
    const wasOpen = dayEntry.isOpen;
    patchDay(day, { isOpen: !wasOpen, slots: wasOpen ? dayEntry.slots : (dayEntry.slots.length ? dayEntry.slots : STANDARD_DAY) });
  };

  const addSlotToDay = (day: number) => {
    const raw = (newTimeByDay[day] ?? "").trim();
    if (!isValidSlot(raw)) {
      toast.error("Enter a time on the 15-minute grid, e.g. 10:30");
      return;
    }
    const dayEntry = settings?.hours.find((h) => h.day === day);
    if (!dayEntry) return;
    patchDay(day, { slots: sortSlots([...dayEntry.slots, raw]) });
    setNewTimeByDay((prev) => ({ ...prev, [day]: "" }));
  };

  const removeSlotFromDay = (day: number, slot: string) => {
    const dayEntry = settings?.hours.find((h) => h.day === day);
    if (!dayEntry) return;
    patchDay(day, { slots: dayEntry.slots.filter((s) => s !== slot) });
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const settingsError = validateSettings(settings);
      if (settingsError) {
        toast.error(settingsError);
        return;
      }
      await updateClinicSettings({
        clinicName: settings.clinicName,
        address: settings.address,
        phone: settings.phone,
        email: settings.email || "",
        about: settings.about || "",
        cancellationWindowMinutes: settings.cancellationWindowMinutes,
        hours: settings.hours.map((h) => ({ day: h.day, isOpen: h.isOpen, slots: sortSlots(h.slots) })),
      });
      toast.success("Clinic settings saved");
      load().catch(() => {});
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save clinic settings"));
    } finally {
      setSaving(false);
    }
  };

  const validateSettings = (s: ClinicSettings): string | null => {
    if (!s.clinicName.trim()) return "Clinic name is required";
    for (const h of s.hours) {
      if (h.isOpen && h.slots.some((t) => !isValidSlot(t))) {
        return `${DAY_NAMES[h.day]}: times must be on the 15-minute grid (HH:mm)`;
      }
    }
    return null;
  };

  // A new blockout usually picks slots from that day's normal hours; if the
  // day is closed there is nothing sensible to block, so keep chips empty.
  const blockedWeekday = blDate ? new Date(`${blDate}T12:00:00`).getDay() : null;
  const dayCandidates = settings?.hours.find((h) => h.day === blockedWeekday)?.slots ?? [];

  const toggleBlockSlot = (slot: string) => {
    setBlSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : sortSlots([...prev, slot]),
    );
  };

  const saveBlockout = async () => {
    if (!blDate) {
      toast.error("Pick a date first");
      return;
    }
    if (!blAllDay && blSlots.length === 0) {
      toast.error("Mark the whole day or block at least one time slot");
      return;
    }
    setSavingBlockout(true);
    try {
      await saveClinicBlockout({
        date: blDate,
        allDay: blAllDay,
        slots: blAllDay ? [] : sortSlots(blSlots),
        reason: blReason,
      });
      toast.success(blAllDay ? "Clinic marked unavailable for that date" : "Times blocked for that date");
      setBlDate("");
      setBlAllDay(false);
      setBlSlots([]);
      setBlReason("");
      setBlockouts([]);
      load().catch(() => {});
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save the blockout"));
    } finally {
      setSavingBlockout(false);
    }
  };

  const removeBlockout = async (date: string) => {
    try {
      await deleteClinicBlockout(date);
      toast.success("Blockout removed");
      setBlockouts((prev) => prev.filter((b) => b.date !== date));
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not remove the blockout"));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-neutral-400">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading clinic settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-16 text-neutral-500">
        Could not load clinic settings. Please try again later.
      </div>
    );
  }

  const todayLocal = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Clinic Settings</h1>
        <p className="text-neutral-500">
          What patients see on Find Doctors, your opening hours, cancellation policy, and any
          days the clinic is closed.
        </p>
      </div>

      {/* ============ ABOUT THE CLINIC ============ */}
      <Card className="border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-primary" /> Clinic details
          </CardTitle>
          <CardDescription>
            Shown on the Find Doctors page and during booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field className="flex flex-col gap-1.5">
              <FieldLabel className="font-semibold text-neutral-700">Clinic name</FieldLabel>
              <Input
                value={settings.clinicName}
                maxLength={80}
                onChange={(e) => setSettings({ ...settings, clinicName: e.target.value })}
              />
            </Field>
            <Field className="flex flex-col gap-1.5">
              <FieldLabel className="font-semibold text-neutral-700">
                Phone <Phone className="inline size-3.5 text-neutral-400" />
              </FieldLabel>
              <Input
                value={settings.phone}
                maxLength={20}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </Field>
          </div>
          <Field className="flex flex-col gap-1.5">
            <FieldLabel className="font-semibold text-neutral-700">Address</FieldLabel>
            <Input
              value={settings.address}
              maxLength={200}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            />
          </Field>
          <Field className="flex flex-col gap-1.5">
            <FieldLabel className="font-semibold text-neutral-700">Email (optional)</FieldLabel>
            <Input
              value={settings.email}
              maxLength={200}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            />
          </Field>
          <Field className="flex flex-col gap-1.5">
            <FieldLabel className="font-semibold text-neutral-700">About the clinic (optional)</FieldLabel>
            <Textarea
              value={settings.about}
              maxLength={500}
              rows={3}
              onChange={(e) => setSettings({ ...settings, about: e.target.value })}
            />
          </Field>
          <Field className="flex flex-col gap-1.5 sm:max-w-xs">
            <FieldLabel className="font-semibold text-neutral-700">
              Cancellation window
            </FieldLabel>
            <Select
              value={String(settings.cancellationWindowMinutes)}
              onValueChange={(v) =>
                setSettings({ ...settings, cancellationWindowMinutes: Number(v) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
                <SelectItem value="480">8 hours</SelectItem>
                <SelectItem value="720">12 hours</SelectItem>
                <SelectItem value="1440">24 hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-400">
              Patients cannot cancel or reschedule within{" "}
              {formatWindowLabel(settings.cancellationWindowMinutes)} of their visit.
            </p>
          </Field>
        </CardContent>
      </Card>

      {/* ============ OPENING HOURS ============ */}
      <Card className="border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" /> Opening hours
          </CardTitle>
          <CardDescription>
            Turn days on or off, and pick the exact 15-minute slots you want to offer. Sundays
            start closed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.hours.map((day) => (
            <div
              key={day.day}
              className="rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-24 font-semibold text-neutral-800">{DAY_NAMES[day.day]}</span>
                  <div className="flex rounded-full border border-neutral-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => toggleDay(day.day)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        day.isOpen
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-neutral-400 hover:text-neutral-600"
                      }`}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDay(day.day)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        !day.isOpen
                          ? "bg-neutral-200 text-neutral-700"
                          : "bg-transparent text-neutral-400 hover:text-neutral-600"
                      }`}
                    >
                      Closed
                    </button>
                  </div>
                </div>
                {day.isOpen && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(PRESETS).map(([label, slots]) => (
                      <Button
                        key={label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => patchDay(day.day, { slots: [...slots] })}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {day.isOpen && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {day.slots.length === 0 && (
                    <span className="text-xs text-neutral-400">
                      No slots yet — add a preset above or type a time below.
                    </span>
                  )}
                  {day.slots.map((slot) => (
                    <span
                      key={slot}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {formatSlotLabel(slot)}
                      <button
                        type="button"
                        aria-label={`Remove ${slot}`}
                        onClick={() => removeSlotFromDay(day.day, slot)}
                        className="text-primary/60 hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  <div className="inline-flex items-center gap-1">
                    <Input
                      value={newTimeByDay[day.day] ?? ""}
                      placeholder="hh:mm"
                      className="h-7 w-20 text-xs"
                      onChange={(e) =>
                        setNewTimeByDay((prev) => ({ ...prev, [day.day]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSlotToDay(day.day);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => addSlotToDay(day.day)}
                      title="Add time (15-minute steps)"
                    >
                      <Plus className="size-3.5" /> Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ============ UNAVAILABLE DATES ============ */}
      <Card className="border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="size-5 text-primary" /> Unavailable dates
          </CardTitle>
          <CardDescription>
            One-off closures that apply to the whole clinic (holidays, training days,
            power cuts) — separate from weekly hours and doctor leave.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2">
            <Field className="flex flex-col gap-1.5">
              <FieldLabel className="font-semibold text-neutral-700">Date</FieldLabel>
              <Input
                type="date"
                min={todayLocal}
                value={blDate}
                onChange={(e) => {
                  setBlDate(e.target.value);
                  setBlSlots([]);
                }}
              />
            </Field>
            <Field className="flex flex-col gap-1.5">
              <FieldLabel className="font-semibold text-neutral-700">Reason (optional)</FieldLabel>
              <Input
                value={blReason}
                maxLength={200}
                placeholder="e.g. Diwali holiday"
                onChange={(e) => setBlReason(e.target.value)}
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={blAllDay}
                  onChange={(e) => {
                    setBlAllDay(e.target.checked);
                    if (e.target.checked) setBlSlots([]);
                  }}
                  className="size-4 accent-primary"
                />
                Closed all day
              </label>
            </div>
          </div>

          {blDate && !blAllDay && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-700">
                Block these time slots on {blDate}:
              </p>
              {dayCandidates.length === 0 ? (
                <p className="text-xs text-neutral-400">
                  This day has no opening hours to block — try a date the clinic is open, or
                  mark the whole day.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {dayCandidates.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => toggleBlockSlot(slot)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        blSlots.includes(slot)
                          ? "bg-destructive text-destructive-foreground"
                          : "border border-neutral-300 bg-white text-neutral-600 hover:border-destructive/50 hover:text-destructive"
                      }`}
                    >
                      {formatSlotLabel(slot)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            type="button"
            onClick={saveBlockout}
            disabled={savingBlockout || !blDate || (!blAllDay && blSlots.length === 0)}
          >
            <Plus className="size-4" /> Add unavailable date
          </Button>

          {blockouts.length > 0 && (
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {blockouts.map((b) => (
                <div key={b.date} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-neutral-900">{b.date}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        b.allDay
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {b.allDay
                        ? "Closed all day"
                        : `${b.slots.length} slot${b.slots.length === 1 ? "" : "s"} blocked`}
                    </span>
                    {b.reason && (
                      <span className="text-sm text-neutral-500">{b.reason}</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-red-50"
                    onClick={() => removeBlockout(b.date)}
                  >
                    <Trash2 className="size-4" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={saveSettings} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}