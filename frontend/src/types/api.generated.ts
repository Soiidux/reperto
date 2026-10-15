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
 * 8 with a named response type.
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

export type GetNotificationUnreadCountData = {
  unread: number;
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
    specialization?: string;
    qualification?: string;
    experience?: number;
    consultationFee?: number;
    averageRating?: number;
    totalReviews?: number;
  };
}[];

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
export type GetAdminAnalytics = Record<string, unknown>;

/** `GET /api/v1/admin/audit/activity` */
export type GetAdminAuditActivity = Record<string, unknown>;

/** `GET /api/v1/admin/audit/patient/{patientId}` */
export type GetAdminAuditPatientPatientId = Record<string, unknown>;

/** `GET /api/v1/admin/audit/patient/{patientId}/by-staff` */
export type GetAdminAuditPatientPatientIdByStaff = Record<string, unknown>;

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
export type GetAdminStats = Record<string, unknown>;

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
    specialization?: string;
    qualification?: string;
    experience?: number;
    consultationFee?: number;
    averageRating?: number;
    totalReviews?: number;
  };
})[];

/** `GET /api/v1/appointment` */
export type GetAppointment = Record<string, unknown>;

/** `GET /api/v1/appointment/active` */
export type GetAppointmentActive = Record<string, unknown>;

/** `GET /api/v1/appointment/arrived` */
export type GetAppointmentArrived = Record<string, unknown>;

/** `GET /api/v1/appointment/available-slots` */
export type GetAppointmentAvailableSlots = Record<string, unknown>;

/** `GET /api/v1/appointment/{id}` */
export type GetAppointmentId = Record<string, unknown>;

/** `GET /api/v1/appointment/{id}/ticket/qr` */
export type GetAppointmentIdTicketQr = Record<string, unknown>;

/** `GET /api/v1/appointment/slots` */
export type GetAppointmentSlots = Record<string, unknown>;

/** `GET /api/v1/appointment/today` */
export type GetAppointmentToday = Record<string, unknown>;

/** `GET /api/v1/clinic/settings` */
export type GetClinicSettings = GetClinicSettingsData;

/** `GET /api/v1/consultation` */
export type GetConsultation = Record<string, unknown>;

/** `GET /api/v1/consultation/follow-ups` */
export type GetConsultationFollowUps = Record<string, unknown>;

/** `GET /api/v1/consultation/history/{patientId}` */
export type GetConsultationHistoryPatientId = Record<string, unknown>;

/** `GET /api/v1/consultation/latest/{patientId}` */
export type GetConsultationLatestPatientId = Record<string, unknown>;

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
export type GetReport = ({
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

/** `GET /api/v1/report/{id}/file/{index}` */
export type GetReportIdFileIndex = Record<string, unknown>;

/** `GET /api/v1/review` */
export type GetReview = GetReviewData;

/** `GET /api/v1/user/doctors` */
export type GetUserDoctors = Record<string, unknown>;

/** `GET /api/v1/user/me` */
export type GetUserMe = Record<string, unknown>;

/** `GET /api/v1/user/me/export` */
export type GetUserMeExport = Record<string, unknown>;

/** `GET /api/v1/user/me/family` */
export type GetUserMeFamily = GetUserMeFamilyData;

/** `GET /api/v1/user/me/share-code` */
export type GetUserMeShareCode = Record<string, unknown>;

/** `GET /api/v1/user/patients` */
export type GetUserPatients = GetUserPatientsData;

/** `PATCH /api/v1/admin/users/{id}/activate` */
export type PatchAdminUsersIdActivate = Record<string, unknown>;

/** `PATCH /api/v1/appointment/{id}/reschedule` */
export type PatchAppointmentIdReschedule = Record<string, unknown>;

/** `PATCH /api/v1/appointment/{id}/status` */
export type PatchAppointmentIdStatus = Record<string, unknown>;

/** `PATCH /api/v1/auth/email` */
export type PatchAuthEmail = Record<string, unknown>;

/** `PATCH /api/v1/auth/password` */
export type PatchAuthPassword = Record<string, unknown>;

/** `PATCH /api/v1/auth/phone` */
export type PatchAuthPhone = Record<string, unknown>;

/** `PATCH /api/v1/consultation/{id}/follow-up` */
export type PatchConsultationIdFollowUp = Record<string, unknown>;

/** `PATCH /api/v1/notification/{id}/read` */
export type PatchNotificationIdRead = Record<string, unknown>;

/** `PATCH /api/v1/notification/read-all` */
export type PatchNotificationReadAll = Record<string, unknown>;

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
export type PostAppointmentCheckIn = Record<string, unknown>;

/** `POST /api/v1/appointment/hold` */
export type PostAppointmentHold = Record<string, unknown>;

/** `POST /api/v1/appointment/hold/{id}/book` */
export type PostAppointmentHoldIdBook = Record<string, unknown>;

/** `POST /api/v1/auth/forgot-password` */
export type PostAuthForgotPassword = Record<string, unknown>;

/** `POST /api/v1/auth/login` */
export type PostAuthLogin = Record<string, unknown>;

/** `POST /api/v1/auth/logout` */
export type PostAuthLogout = Record<string, unknown>;

/** `POST /api/v1/auth/refresh` */
export type PostAuthRefresh = Record<string, unknown>;

/** `POST /api/v1/auth/register` */
export type PostAuthRegister = Record<string, unknown>;

/** `POST /api/v1/auth/resend-verification` */
export type PostAuthResendVerification = Record<string, unknown>;

/** `POST /api/v1/auth/reset-password` */
export type PostAuthResetPassword = Record<string, unknown>;

/** `POST /api/v1/auth/verify-email` */
export type PostAuthVerifyEmail = Record<string, unknown>;

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
export type PostUserMeFamilyIdShareCode = Record<string, unknown>;

/** `PUT /api/v1/admin/clinic-settings` */
export type PutAdminClinicSettings = Record<string, unknown>;
