/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with:  npm run generate:types   (from backend/)
 *
 * Derived from the OpenAPI document the server publishes at
 * /api/v1/docs/openapi.json, so these types cannot describe an
 * endpoint the API does not actually serve.
 *
 * Coverage when generated: 75 operations,
 * 31 with a named response type.
 *
 * Hand-written interfaces that mirror server payloads are the thing this file
 * replaces. A field renamed on the server should be a compile error here rather
 * than an `undefined` at runtime.
 *
 * Where an operation has no named type its payload is inlined, which is the
 * generator being honest about a response it cannot give a name to yet — see
 * `x-response-schema-pending` in the spec.
 */

export type ApiVersion = "v1";

// ── Response payload types ──────────────────────────────────────────────
export type GetAdminAnalyticsData = {
  appointmentsByDoctor?: {
    doctorId: string;
    doctorName: string;
    total: number;
    statuses: Record<string, number>;
  }[];
  statusRates?: {
    status: string;
    count: number;
  }[];
  totalAppointments30d?: number;
  newPatientsByMonth?: {
    month: string;
    label: string;
    count: number;
  }[];
};

export type GetAdminAuditActivityData = {
  count: number;
  entries: ({
    _id: string;
    actorId: string;
    actorRole: string;
    actorName?: string;
    patientId: string;
    resource: "consultation" | "report" | "medical-history" | "appointment" | "patient-profile";
    resourceId?: string;
    action: "read" | "create" | "update" | "delete" | "export";
    route?: string;
    ip?: string;
    createdAt: string;
  })[];
};

export type GetAdminAuditPatientPatientIdByStaffData = {
  count: number;
  entries: ({
    _id: string;
    actorId: string;
    actorRole: string;
    actorName?: string;
    patientId: string;
    resource: "consultation" | "report" | "medical-history" | "appointment" | "patient-profile";
    resourceId?: string;
    action: "read" | "create" | "update" | "delete" | "export";
    route?: string;
    ip?: string;
    createdAt: string;
  })[];
};

export type GetAdminAuditPatientPatientIdData = {
  count: number;
  entries: ({
    _id: string;
    actorId: string;
    actorRole: string;
    actorName?: string;
    patientId: string;
    resource: "consultation" | "report" | "medical-history" | "appointment" | "patient-profile";
    resourceId?: string;
    action: "read" | "create" | "update" | "delete" | "export";
    route?: string;
    ip?: string;
    createdAt: string;
  })[];
};

export type GetAdminStatsData = {
  totalPatients: number;
  totalDoctors: number;
  totalStaff: number;
  totalAppointments: number;
  todaysAppointments: number;
  pendingAppointments: number;
  completedConsultations: number;
};

export type GetAppointmentActiveData = {
  count: number;
  appointments: ({
    _id: string;
    patientId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    doctorId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    appointmentDate: string;
    timeSlot: string;
    durationInMinutes?: number;
    status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
    consultationType?: string;
    checkedInAt?: string | null;
    checkedInBy?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    } | null;
    cancellationReason?: string;
    needsReschedule?: boolean;
    rescheduleSuggestions?: unknown[];
    reminderEmailAt?: string | null;
    intakeDetails?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  })[];
};

export type GetAppointmentArrivedData = {
  count: number;
  appointments: ({
    _id: string;
    patientId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    doctorId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    appointmentDate: string;
    timeSlot: string;
    durationInMinutes?: number;
    status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
    consultationType?: string;
    checkedInAt?: string | null;
    checkedInBy?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    } | null;
    cancellationReason?: string;
    needsReschedule?: boolean;
    rescheduleSuggestions?: unknown[];
    reminderEmailAt?: string | null;
    intakeDetails?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  })[];
};

export type GetAppointmentData = {
  count: number;
  appointments: ({
    _id: string;
    patientId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    doctorId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    appointmentDate: string;
    timeSlot: string;
    durationInMinutes?: number;
    status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
    consultationType?: string;
    checkedInAt?: string | null;
    checkedInBy?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    } | null;
    cancellationReason?: string;
    needsReschedule?: boolean;
    rescheduleSuggestions?: unknown[];
    reminderEmailAt?: string | null;
    intakeDetails?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  })[];
  pagination: {
    totalItems: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export type GetAppointmentIdData = {
  _id: string;
  patientId?: string | {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  };
  doctorId?: string | {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  };
  appointmentDate: string;
  timeSlot: string;
  durationInMinutes?: number;
  status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
  consultationType?: string;
  checkedInAt?: string | null;
  checkedInBy?: string | {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  } | null;
  cancellationReason?: string;
  needsReschedule?: boolean;
  rescheduleSuggestions?: unknown[];
  reminderEmailAt?: string | null;
  intakeDetails?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type GetAppointmentSlotsData = {
  timeSlot: string;
  state: string;
}[];

export type GetAppointmentTodayData = {
  count: number;
  appointments: ({
    _id: string;
    patientId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    doctorId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    appointmentDate: string;
    timeSlot: string;
    durationInMinutes?: number;
    status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
    consultationType?: string;
    checkedInAt?: string | null;
    checkedInBy?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    } | null;
    cancellationReason?: string;
    needsReschedule?: boolean;
    rescheduleSuggestions?: unknown[];
    reminderEmailAt?: string | null;
    intakeDetails?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  })[];
};

export type GetClinicSettingsData = {
  clinicName: string;
  address: string;
  phone: string;
  email: string;
  about: string;
  cancellationWindowMinutes: number;
  hours: {
    day: number;
    isOpen: boolean;
    slots?: string[];
  }[];
  today: {
    day: number;
    isOpen: boolean;
    slots: string[];
    isOpenNow: boolean;
    opensAt: string | null;
    closesAt: string | null;
    nextChangeAt: string | null;
  };
};

export type GetConsultationHistoryPatientIdData = {
  count: number;
  history: ({
    _id: string;
    appointmentId?: string | {
      _id: string;
    };
    patientId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    doctorId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    chiefComplaintDetails?: Record<string, unknown>;
    physicalGenerals?: Record<string, unknown>;
    mentalGenerals?: string;
    pastMedicalHistory?: string;
    diagnosis?: string;
    prescriptions?: ({
      _id?: string;
      remedyName: string;
      potency?: string | null;
      dosage: string;
      durationInDays: number;
    })[];
    doctorNotes?: string;
    followUpDate?: string;
    followUpStatus?: string;
    followUpReminderSentAt?: string | null;
    createdAt: string;
    updatedAt: string;
  })[];
};

export type GetConsultationLatestPatientIdData = {
  _id: string;
  appointmentId?: string | {
    _id: string;
  };
  patientId?: string | {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  };
  doctorId?: string | {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  };
  chiefComplaintDetails?: Record<string, unknown>;
  physicalGenerals?: Record<string, unknown>;
  mentalGenerals?: string;
  pastMedicalHistory?: string;
  diagnosis?: string;
  prescriptions?: ({
    _id?: string;
    remedyName: string;
    potency?: string | null;
    dosage: string;
    durationInDays: number;
  })[];
  doctorNotes?: string;
  followUpDate?: string;
  followUpStatus?: string;
  followUpReminderSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
} | null;

export type GetNotificationUnreadCountData = {
  unread: number;
};

export type GetReportData = {
  count: number;
  reports: ({
    _id: string;
    patientId: {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    uploadedBy: {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    title: string;
    category: "lab" | "imaging" | "test" | "other";
    description?: string;
    consultationId?: string;
    files: ({
      url?: string;
      publicId?: string;
      storageId?: string;
      storage?: "cloudinary" | "gridfs";
      name: string;
      mimeType: string;
      size: number;
      resourceType?: string;
    })[];
    createdAt: string;
    updatedAt: string;
  })[];
};

export type GetReviewData = {
  reviews: {
    _id: string;
    patientId: {
      _id: string;
      name: string;
      profileImageUrl?: string;
    };
    doctorId: string;
    rating: number;
    comment: string;
    createdAt: string;
    updatedAt: string;
  }[];
  summary: {
    avgRating: number;
    totalReviews: number;
    distribution: Record<string, number>;
  };
  canReview: boolean;
  myReview: {
    _id: string;
    patientId: {
      _id: string;
      name: string;
      profileImageUrl?: string;
    };
    doctorId: string;
    rating: number;
    comment: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type GetUserDoctorsData = {
  _id: string;
  name: string;
  profileImageUrl?: string;
  doctorProfile?: {
    specializations?: string[];
    qualifications?: string[];
    languagesSpoken?: string[];
    experienceYears?: number;
    consultationFee?: number;
  };
  totalReviews?: number;
  avgRating?: number;
  ratingDistribution?: Record<string, number>;
}[];

export type GetUserMeData = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: "patient" | "doctor" | "staff" | "admin";
  accountType?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  profileImageUrl?: string;
  shareCode?: string;
  guardians?: string[];
  isActive?: boolean;
  emailVerified?: boolean;
  doctorProfile?: {
    specializations?: string[];
    qualifications?: string[];
    languagesSpoken?: string[];
    experienceYears?: number;
    consultationFee?: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type GetUserMeExportData = {
  exportedAt: string;
  exportedBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  profile: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: "patient" | "doctor" | "staff" | "admin";
    accountType?: string;
    gender?: string;
    dateOfBirth?: string;
    bloodGroup?: string;
    profileImageUrl?: string;
    shareCode?: string;
    guardians?: string[];
    isActive?: boolean;
    emailVerified?: boolean;
    doctorProfile?: {
      specializations?: string[];
      qualifications?: string[];
      languagesSpoken?: string[];
      experienceYears?: number;
      consultationFee?: number;
    };
    createdAt?: string;
    updatedAt?: string;
  };
  familyMembers?: {
    _id: string;
    name: string;
    phone: string;
    gender?: string;
    dateOfBirth?: string;
    bloodGroup?: string;
    accountType?: "dependent";
    shareCode?: string;
    guardians?: string[];
  }[];
  appointments?: ({
    _id: string;
    patientId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    doctorId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    appointmentDate: string;
    timeSlot: string;
    durationInMinutes?: number;
    status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
    consultationType?: string;
    checkedInAt?: string | null;
    checkedInBy?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    } | null;
    cancellationReason?: string;
    needsReschedule?: boolean;
    rescheduleSuggestions?: unknown[];
    reminderEmailAt?: string | null;
    intakeDetails?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  })[];
  consultations?: ({
    _id: string;
    appointmentId?: string | {
      _id: string;
    };
    patientId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    doctorId?: string | {
      _id: string;
      name: string;
      profileImageUrl?: string;
      role?: "patient" | "doctor" | "staff" | "admin";
      phone?: string;
      email?: string;
    };
    chiefComplaintDetails?: Record<string, unknown>;
    physicalGenerals?: Record<string, unknown>;
    mentalGenerals?: string;
    pastMedicalHistory?: string;
    diagnosis?: string;
    prescriptions?: ({
      _id?: string;
      remedyName: string;
      potency?: string | null;
      dosage: string;
      durationInDays: number;
    })[];
    doctorNotes?: string;
    followUpDate?: string;
    followUpStatus?: string;
    followUpReminderSentAt?: string | null;
    createdAt: string;
    updatedAt: string;
  })[];
  notifications?: ({
    _id: string;
    recipientId: string;
    type: "leave-conflict" | "appointment-status" | "appointment-rescheduled" | "follow-up-due";
    title: string;
    body: string;
    link?: string;
    appointmentId?: string;
    readAt: string | null;
    createdAt: string;
  })[];
  reviews?: {
    _id: string;
    patientId: {
      _id: string;
      name: string;
      profileImageUrl?: string;
    };
    doctorId: string;
    rating: number;
    comment: string;
    createdAt: string;
    updatedAt: string;
  }[];
};

export type GetUserMeFamilyData = {
  _id: string;
  name: string;
  phone: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  accountType?: "dependent";
  shareCode?: string;
  guardians?: string[];
}[];

export type GetUserMeShareCodeData = {
  shareCode: string;
};

export type GetUserPatientsData = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  profileImageUrl?: string;
  doctorProfile?: {
    specializations?: string[];
    qualifications?: string[];
    languagesSpoken?: string[];
    experienceYears?: number;
    consultationFee?: number;
  };
}[];

export type PatchNotificationIdReadData = {
  _id: string;
  recipientId: string;
  type: "leave-conflict" | "appointment-status" | "appointment-rescheduled" | "follow-up-due";
  title: string;
  body: string;
  link?: string;
  appointmentId?: string;
  readAt: string | null;
  createdAt: string;
};

export type PostAppointmentCheckInData = {
  appointment: {
    _id: string;
    appointmentDate: string;
    timeSlot: string;
    consultationType?: string;
    status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
    checkedInAt: string | null;
    patient: {
      _id: string;
      name: string;
    };
    doctor: {
      _id: string;
      name: string;
    };
  };
  alreadyCheckedIn: boolean;
  staleDate: boolean;
  slotMismatch: boolean;
};

export type PostAuthLoginData = {
  accessToken: string;
  user: {
    id: string;
    name: string;
    role: "patient" | "doctor" | "staff" | "admin";
    profileImageUrl: string;
    emailVerified: boolean;
  };
};

export type PostAuthRefreshData = {
  accessToken: string;
};

export type PostReportData = {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  };
  uploadedBy: {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  };
  title: string;
  category: "lab" | "imaging" | "test" | "other";
  description?: string;
  consultationId?: string;
  files: ({
    url?: string;
    publicId?: string;
    storageId?: string;
    storage?: "cloudinary" | "gridfs";
    name: string;
    mimeType: string;
    size: number;
    resourceType?: string;
  })[];
  createdAt: string;
  updatedAt: string;
};

export type PostReviewData = {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  };
  doctorId: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type PostUserMeFamilyData = {
  _id: string;
  name: string;
  phone: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  accountType?: "dependent";
  shareCode?: string;
  guardians?: string[];
};

export type PostUserMeFamilyIdShareCodeData = {
  shareCode: string;
};

// ── Per-operation aliases ───────────────────────────────────────────────
/** `DELETE /api/v1/admin/clinic-blockouts/{date}` */
export type DeleteAdminClinicBlockoutsDate = Record<string, unknown>;

/** `DELETE /api/v1/appointment/hold/{id}` */
export type DeleteAppointmentHoldId = Record<string, unknown>;

/** `DELETE /api/v1/leave/remove/{leaveId}` */
export type DeleteLeaveRemoveLeaveId = Record<string, unknown>;

/** `DELETE /api/v1/report/{id}` */
export type DeleteReportId = Record<string, unknown>;

/** `DELETE /api/v1/review/{doctorId}` */
export type DeleteReviewDoctorId = Record<string, unknown>;

/** `DELETE /api/v1/user/me/family/{id}` */
export type DeleteUserMeFamilyId = Record<string, unknown>;

/** `DELETE /api/v1/user/me/family/{id}/guardians/{guardianId}` */
export type DeleteUserMeFamilyIdGuardiansGuardianId = Record<string, unknown>;

/** `GET /api/v1/admin/analytics` */
export type GetAdminAnalytics = GetAdminAnalyticsData;

/** `GET /api/v1/admin/audit/activity` */
export type GetAdminAuditActivity = GetAdminAuditActivityData;

/** `GET /api/v1/admin/audit/patient/{patientId}` */
export type GetAdminAuditPatientPatientId = GetAdminAuditPatientPatientIdData;

/** `GET /api/v1/admin/audit/patient/{patientId}/by-staff` */
export type GetAdminAuditPatientPatientIdByStaff = GetAdminAuditPatientPatientIdByStaffData;

/** `GET /api/v1/admin/clinic-blockouts` */
export type GetAdminClinicBlockouts = ({
  _id: string;
  date: string;
  endDate?: string;
  reason?: string;
  doctorId?: string;
  scope?: "clinic" | "doctor";
  createdAt?: string;
})[];

/** `GET /api/v1/admin/export/appointments` */
export type GetAdminExportAppointments = Record<string, unknown>;

/** `GET /api/v1/admin/export/patients` */
export type GetAdminExportPatients = Record<string, unknown>;

/** `GET /api/v1/admin/stats` */
export type GetAdminStats = GetAdminStatsData;

/** `GET /api/v1/admin/users` */
export type GetAdminUsers = ({
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: "patient" | "doctor" | "staff" | "admin";
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  profileImageUrl?: string;
  isActive?: boolean;
  doctorProfile?: {
    specializations?: string[];
    qualifications?: string[];
    languagesSpoken?: string[];
    experienceYears?: number;
    consultationFee?: number;
  };
})[];

/** `GET /api/v1/appointment` */
export type GetAppointment = GetAppointmentData;

/** `GET /api/v1/appointment/active` */
export type GetAppointmentActive = GetAppointmentActiveData;

/** `GET /api/v1/appointment/arrived` */
export type GetAppointmentArrived = GetAppointmentArrivedData;

/** `GET /api/v1/appointment/available-slots` */
export type GetAppointmentAvailableSlots = string[];

/** `GET /api/v1/appointment/{id}` */
export type GetAppointmentId = GetAppointmentIdData;

/** `GET /api/v1/appointment/{id}/ticket/qr` */
export type GetAppointmentIdTicketQr = Record<string, unknown>;

/** `GET /api/v1/appointment/slots` */
export type GetAppointmentSlots = GetAppointmentSlotsData;

/** `GET /api/v1/appointment/today` */
export type GetAppointmentToday = GetAppointmentTodayData;

/** `GET /api/v1/clinic/settings` */
export type GetClinicSettings = GetClinicSettingsData;

/** `GET /api/v1/consultation` */
export type GetConsultation = ({
  _id: string;
  appointmentId?: string | {
    _id: string;
  };
  patientId?: string | {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  };
  doctorId?: string | {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  };
  chiefComplaintDetails?: Record<string, unknown>;
  physicalGenerals?: Record<string, unknown>;
  mentalGenerals?: string;
  pastMedicalHistory?: string;
  diagnosis?: string;
  prescriptions?: ({
    _id?: string;
    remedyName: string;
    potency?: string | null;
    dosage: string;
    durationInDays: number;
  })[];
  doctorNotes?: string;
  followUpDate?: string;
  followUpStatus?: string;
  followUpReminderSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
})[];

/** `GET /api/v1/consultation/follow-ups` */
export type GetConsultationFollowUps = ({
  _id: string;
  appointmentId: string;
  doctorId?: {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  };
  patientId?: {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role?: "patient" | "doctor" | "staff" | "admin";
    phone?: string;
    email?: string;
  };
  diagnosis?: string;
  followUpDate?: string;
  followUpStatus?: string;
  createdAt?: string;
})[];

/** `GET /api/v1/consultation/history/{patientId}` */
export type GetConsultationHistoryPatientId = GetConsultationHistoryPatientIdData;

/** `GET /api/v1/consultation/latest/{patientId}` */
export type GetConsultationLatestPatientId = GetConsultationLatestPatientIdData;

/** `GET /api/v1/leave/my` */
export type GetLeaveMy = ({
  _id: string;
  doctorId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: string;
})[];

/** `GET /api/v1/notification` */
export type GetNotification = ({
  _id: string;
  recipientId: string;
  type: "leave-conflict" | "appointment-status" | "appointment-rescheduled" | "follow-up-due";
  title: string;
  body: string;
  link?: string;
  appointmentId?: string;
  readAt: string | null;
  createdAt: string;
})[];

/** `GET /api/v1/notification/unread-count` */
export type GetNotificationUnreadCount = GetNotificationUnreadCountData;

/** `GET /api/v1/report` */
export type GetReport = GetReportData;

/** `GET /api/v1/report/{id}/file/{index}` */
export type GetReportIdFileIndex = Record<string, unknown>;

/** `GET /api/v1/review` */
export type GetReview = GetReviewData;

/** `GET /api/v1/user/doctors` */
export type GetUserDoctors = GetUserDoctorsData;

/** `GET /api/v1/user/me` */
export type GetUserMe = GetUserMeData;

/** `GET /api/v1/user/me/export` */
export type GetUserMeExport = GetUserMeExportData;

/** `GET /api/v1/user/me/family` */
export type GetUserMeFamily = GetUserMeFamilyData;

/** `GET /api/v1/user/me/share-code` */
export type GetUserMeShareCode = GetUserMeShareCodeData;

/** `GET /api/v1/user/patients` */
export type GetUserPatients = GetUserPatientsData;

/** `PATCH /api/v1/admin/users/{id}/activate` */
export type PatchAdminUsersIdActivate = Record<string, unknown>;

/** `PATCH /api/v1/appointment/{id}/reschedule` */
export type PatchAppointmentIdReschedule = Record<string, unknown>;

/** `PATCH /api/v1/appointment/{id}/status` */
export type PatchAppointmentIdStatus = Record<string, unknown>;

/** `PATCH /api/v1/auth/email` */
export type PatchAuthEmail = null;

/** `PATCH /api/v1/auth/password` */
export type PatchAuthPassword = null;

/** `PATCH /api/v1/auth/phone` */
export type PatchAuthPhone = null;

/** `PATCH /api/v1/consultation/{id}/follow-up` */
export type PatchConsultationIdFollowUp = Record<string, unknown>;

/** `PATCH /api/v1/notification/{id}/read` */
export type PatchNotificationIdRead = PatchNotificationIdReadData;

/** `PATCH /api/v1/notification/read-all` */
export type PatchNotificationReadAll = null;

/** `PATCH /api/v1/user/me/family/{id}` */
export type PatchUserMeFamilyId = Record<string, unknown>;

/** `PATCH /api/v1/user/me/profile-image` */
export type PatchUserMeProfileImage = Record<string, unknown>;

/** `POST /api/v1/admin/clinic-blockouts` */
export type PostAdminClinicBlockouts = Record<string, unknown>;

/** `POST /api/v1/admin/team` */
export type PostAdminTeam = Record<string, unknown>;

/** `POST /api/v1/appointment` */
export type PostAppointment = Record<string, unknown>;

/** `POST /api/v1/appointment/check-in` */
export type PostAppointmentCheckIn = PostAppointmentCheckInData;

/** `POST /api/v1/appointment/hold` */
export type PostAppointmentHold = Record<string, unknown>;

/** `POST /api/v1/appointment/hold/{id}/book` */
export type PostAppointmentHoldIdBook = Record<string, unknown>;

/** `POST /api/v1/auth/forgot-password` */
export type PostAuthForgotPassword = null;

/** `POST /api/v1/auth/login` */
export type PostAuthLogin = PostAuthLoginData;

/** `POST /api/v1/auth/logout` */
export type PostAuthLogout = null;

/** `POST /api/v1/auth/refresh` */
export type PostAuthRefresh = PostAuthRefreshData;

/** `POST /api/v1/auth/register` */
export type PostAuthRegister = null;

/** `POST /api/v1/auth/resend-verification` */
export type PostAuthResendVerification = null;

/** `POST /api/v1/auth/reset-password` */
export type PostAuthResetPassword = null;

/** `POST /api/v1/auth/verify-email` */
export type PostAuthVerifyEmail = null;

/** `POST /api/v1/consultation` */
export type PostConsultation = Record<string, unknown>;

/** `POST /api/v1/leave/add` */
export type PostLeaveAdd = Record<string, unknown>;

/** `POST /api/v1/report` */
export type PostReport = PostReportData;

/** `POST /api/v1/review` */
export type PostReview = PostReviewData;

/** `POST /api/v1/user/me/family` */
export type PostUserMeFamily = PostUserMeFamilyData;

/** `POST /api/v1/user/me/family/add-by-code` */
export type PostUserMeFamilyAddByCode = Record<string, unknown>;

/** `POST /api/v1/user/me/family/{id}/leave` */
export type PostUserMeFamilyIdLeave = Record<string, unknown>;

/** `POST /api/v1/user/me/family/{id}/share-code` */
export type PostUserMeFamilyIdShareCode = PostUserMeFamilyIdShareCodeData;

/** `PUT /api/v1/admin/clinic-settings` */
export type PutAdminClinicSettings = Record<string, unknown>;
