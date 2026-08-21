import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2, UserRound, X } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { cn } from "@/lib/utils";
import { getPatients } from "@/api/user";
import getAge from "@/utils/getAge";

interface PatientOption {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
}

interface PatientComboboxProps {
  value?: string;
  onChange: (patientId: string) => void;
  preselectedName?: string;
  invalid?: boolean;
}

export default function PatientCombobox({
  value,
  onChange,
  preselectedName,
  invalid,
}: PatientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PatientOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setIsLoading(true);
        getPatients(
          { search: query || undefined, limit: 10 },
          { signal: controller.signal }
        )
          .then((response) => {
            setOptions(response.data.data ?? []);
            setLoadError(false);
          })
          .catch((error: unknown) => {
            if (
              controller.signal.aborted ||
              (typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "ERR_CANCELED")
            ) {
              return;
            }
            console.error(error);
            setLoadError(true);
            setOptions([]);
          })
          .finally(() => {
            if (!controller.signal.aborted) setIsLoading(false);
          });
      },
      query ? 300 : 0
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query]);

  const selected = options.find((option) => option._id === value);

  const handleClear = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onChange("");
    setQuery("");
  };

  return (
    <div className="relative w-full">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid}
            className={cn("w-full justify-between font-normal", invalid && "border-destructive")}
          >
            <span className="flex min-w-0 items-center gap-2">
              {selected ? (
                <>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {selected.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate">
                    {selected.name}
                    {selected.phone && (
                      <span className="text-muted-foreground"> · {selected.phone}</span>
                    )}
                  </span>
                </>
              ) : value && preselectedName ? (
                <>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {preselectedName.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate">{preselectedName}</span>
                </>
              ) : (
                <>
                  <UserRound className="size-4 shrink-0 opacity-50" />
                  <span className="text-muted-foreground">Select patient</span>
                </>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name, phone or email"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Searching patients…
                </div>
              ) : loadError ? (
                <div className="py-6 text-center text-sm text-destructive">
                  Couldn't load patients. Close and reopen to retry.
                </div>
              ) : options.length === 0 ? (
                <CommandEmpty>No patients found{query ? ` for "${query}"` : ""}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {options.map((patient) => {
                    const meta = [
                      patient.dateOfBirth ? `${getAge(patient.dateOfBirth)}y` : "",
                      patient.gender
                        ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <CommandItem
                        key={patient._id}
                        value={patient._id}
                        onSelect={() => {
                          onChange(patient._id);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {patient.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{patient.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {[patient.phone, patient.email, meta].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {patient._id === value && <Check className="ml-auto size-4" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear selected patient"
          title="Clear selection"
          onClick={handleClear}
          className="absolute top-1/2 right-8 -translate-y-1/2 hover:bg-transparent"
        >
          <X />
        </Button>
      )}
    </div>
  );
}
