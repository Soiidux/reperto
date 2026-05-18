import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope, GraduationCap, User, Briefcase} from "lucide-react";
import type { Doctor } from "@/store/doctorStore"; 

export function DoctorCard({ doctor }: { doctor: Doctor }) {
  const profile = doctor.doctorProfile;
  // Format the specialization array into a clean comma-separated list
  // 
  const qualificationsList = profile?.qualifications && profile.qualifications.length > 0
    ? profile.qualifications.join(", ")
    : "No qualifications";
  
  const specializationsList = profile?.specializations && profile.specializations.length > 0
    ? profile.specializations.join(", ")
    : "General Physician";
  
  const languagesSpokenList = profile?.languagesSpoken && profile.languagesSpoken.length > 0
    ? profile.languagesSpoken.join(", ")
    : "N/A";
  
  // Quick extraction of the first letter of the name for the avatar fallback text (skipping "Dr.")
  const fallbackLetter = doctor.name.replace("Dr. ", "").charAt(0) || "D";

  return (
    <Card className="flex flex-col border border-neutral-100 shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden group">
      
      {/* 👤 Profile Header Block */}
      <CardHeader className="border-b border-neutral-100 flex flex-col gap-4 items-center justify-center">
        {doctor.profileImageUrl ? (
          <img 
            src={doctor.profileImageUrl} 
            alt={doctor.name} 
            className="h-20 w-20 rounded-xl object-cover border border-neutral-200 shrink-0"
          />
        ) : (
          <div className="h-50 w-50 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-7xl border border-primary/20 shrink-0">
            {fallbackLetter}
          </div>
        )}
        
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="text-lg font-bold text-primary/80 transition-colors truncate">
            {doctor.name}
          </CardTitle>
          <CardDescription className="text-xs font-semibold text-primary/80 flex items-center gap-1 mt-0.5 truncate">
            <Stethoscope size={12} className="shrink-0" />
            {specializationsList}
          </CardDescription>
        </div>
      </CardHeader>

      {/* 📄 Core Professional Metrics */}
      <CardContent className="space-y-3 text-primary/80">
        <div className="flex items-center gap-2.5">
          <Briefcase size={16} className="text-xs font-semibold flex items-center gap-1 mt-0.5 truncate" />
          <span className="text-xs font-semibold text-primary/80 flex items-center gap-1 mt-0.5 truncate">Experience: <strong>{profile?.experienceYears || "N/A"} Years</strong></span>
        </div>
        <div className="flex items-center gap-2.5">
          <GraduationCap size={16} className="text-xs font-semibold flex items-center gap-1 mt-0.5 truncate" />
          <span className="text-xs font-semibold text-primary/80 flex items-center gap-1 mt-0.5 truncate">
            Qualifications: {qualificationsList}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <User size={16} className="text-primary/80" />
          <span className="text-xs font-semibold text-primary/80 flex items-center gap-1 mt-0.5 truncate">
            Languages: {languagesSpokenList}
          </span>
        </div>
      </CardContent>

    </Card>
  );
}