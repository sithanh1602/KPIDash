import type { AuthUser, ImportResult, Role, SheetData, SheetRow, WeekListItem, WeekMeta, WeekReport } from '@shared/types';
import type { SheetKey } from '@shared/sheets';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function doRefreshToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let res = await fetch(path, { ...options, headers });

  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    if (!refreshPromise) {
      refreshPromise = doRefreshToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(path, { ...options, headers });
    }
  }

  if (!res.ok) {
    let message = 'Lỗi kết nối máy chủ';
    try {
      const err = await res.json();
      if (err.error) message = err.error;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ------------------------------ Auth API ---------------------------------- */

export async function apiLogin(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
  const data = await apiFetch<{ accessToken: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function apiRefresh(): Promise<{ accessToken: string; user: AuthUser } | null> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return data;
  } catch {
    return null;
  }
}

export async function apiLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}

/* ------------------------------ Weeks API --------------------------------- */

export async function apiListWeeks(): Promise<WeekListItem[]> {
  return apiFetch<WeekListItem[]>('/api/weeks');
}

export interface CreateWeekPayload {
  weekNumber: number;
  startDate: string;
  endDate: string;
}

export async function apiCreateWeek(payload: CreateWeekPayload): Promise<WeekMeta> {
  return apiFetch<WeekMeta>('/api/weeks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiGetWeekReport(weekId: number): Promise<WeekReport> {
  return apiFetch<WeekReport>(`/api/weeks/${weekId}/report`);
}

export async function apiUpdateWeek(weekId: number, patch: Partial<WeekMeta>): Promise<WeekMeta> {
  return apiFetch<WeekMeta>(`/api/weeks/${weekId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function apiDeleteWeek(weekId: number): Promise<void> {
  return apiFetch<void>(`/api/weeks/${weekId}`, { method: 'DELETE' });
}

/* ------------------------------ Members API ------------------------------- */

export interface MemberWithCount {
  id: number;
  name: string;
  role: string;
  active: boolean;
  weekCount: number;
}

export async function apiListMembers(): Promise<MemberWithCount[]> {
  return apiFetch<MemberWithCount[]>('/api/members');
}

export async function apiCreateMember(data: { name: string; role?: string }): Promise<MemberWithCount> {
  return apiFetch<MemberWithCount>('/api/members', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateMember(id: number, data: { name: string; role?: string; active?: boolean }): Promise<MemberWithCount> {
  return apiFetch<MemberWithCount>(`/api/members/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiGetWeekMembers(weekId: number): Promise<{ id: number; name: string; role: string }[]> {
  return apiFetch<{ id: number; name: string; role: string }[]>(`/api/weeks/${weekId}/members`);
}

export async function apiSetWeekMembers(weekId: number, memberIds: number[]): Promise<{ id: number; name: string; role: string }[]> {
  return apiFetch<{ id: number; name: string; role: string }[]>(`/api/weeks/${weekId}/members`, {
    method: 'PUT',
    body: JSON.stringify({ memberIds }),
  });
}

/* ------------------------------ Sheet API --------------------------------- */

export async function apiLoadSheet(weekId: number, sheetKey: SheetKey): Promise<SheetData> {
  return apiFetch<SheetData>(`/api/weeks/${weekId}/sheets/${sheetKey}`);
}

export async function apiSaveSheet(weekId: number, sheetKey: SheetKey, rows: SheetRow[]): Promise<void> {
  return apiFetch<void>(`/api/weeks/${weekId}/sheets/${sheetKey}`, {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  });
}

export async function apiImportSheet(weekId: number, sheetKey: SheetKey, fileName: string, fileBase64: string): Promise<ImportResult> {
  return apiFetch<ImportResult>(`/api/weeks/${weekId}/sheets/${sheetKey}/import`, {
    method: 'POST',
    body: JSON.stringify({ fileName, fileBase64 }),
  });
}

export function getTemplateUrl(weekId: number, sheetKey: SheetKey, ext: 'xlsx' | 'csv'): string {
  return `/api/weeks/${weekId}/templates/${sheetKey}.${ext}${accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''}`;
}

export async function apiDownloadTemplate(weekId: number, sheetKey: SheetKey, ext: 'xlsx' | 'csv'): Promise<void> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`/api/weeks/${weekId}/templates/${sheetKey}.${ext}`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) {
    throw new Error('Không thể tải file mẫu. Vui lòng đăng nhập lại.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mau_${sheetKey}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------ User Management & Profile API ----------------- */

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export async function apiListUsers(): Promise<ManagedUser[]> {
  return apiFetch<ManagedUser[]>('/api/users');
}

export async function apiGetOnlineUsers(): Promise<{
  totalOnline: number;
  maxCapacity: number;
  users: Array<{ id: number; name: string; role: string; lastSeen: number }>;
}> {
  return apiFetch('/api/users/online');
}

export async function apiGetRedisStatus(): Promise<{
  connected: boolean;
  host?: string;
  port?: number;
  usedMemory?: string;
  maxMemory?: string;
  maxUsers?: number;
}> {
  return apiFetch('/api/users/redis-status');
}

export async function apiCreateUser(data: {
  name: string;
  email: string;
  password?: string;
  role: Role;
}): Promise<ManagedUser> {
  return apiFetch<ManagedUser>('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateUser(
  userId: number,
  patch: {
    name?: string;
    email?: string;
    role?: Role;
    active?: boolean;
    password?: string;
  },
): Promise<ManagedUser> {
  return apiFetch<ManagedUser>(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function apiUpdateMyProfile(data: { name: string }): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/users/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function apiChangeMyPassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  return apiFetch<void>('/api/users/profile/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiExportExcel(weekId: number, sections?: string[], selectedQaTypes?: string[]): Promise<Blob> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`/api/weeks/${weekId}/export/excel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sections, selectedQaTypes }),
  });
  if (!res.ok) throw new ApiError(res.status, 'Không thể xuất file Excel');
  return res.blob();
}

/* ------------------------------ Tool QA Import API ------------------------ */

export interface ToolQaParsedData {
  cuboids: number;
  totalWarnings: number;
  warningPercent: number;
  s: number;
  k: number;
  z: number;
  h: number;
  o: number;
  d: number;
  riskHigh: number;
  riskMid: number;
  riskLow: number;
  highRiskTracks: Array<{
    trackNo: string;
    className: string;
    totalIssues: number;
    warnings: string;
    symptom: string;
  }>;
  suggestedCoaching: {
    focusTags: string;
    commonErrors: string;
    training: string;
    goals: string;
  };
}

export interface ToolQaPreviewResponse {
  fileName: string;
  fileSize: number;
  parsed: ToolQaParsedData;
  suggestedMemberId: number | null;
}

export interface QaStoredFile {
  id: number;
  week_id: number;
  member_id: number;
  member_name: string;
  file_name: string;
  file_size: number;
  metrics: ToolQaParsedData;
  created_at: string;
}

export async function apiParseToolQaPreview(
  weekId: number,
  fileName: string,
  fileBase64: string,
): Promise<ToolQaPreviewResponse> {
  return apiFetch<ToolQaPreviewResponse>(`/api/weeks/${weekId}/qa/parse-preview`, {
    method: 'POST',
    body: JSON.stringify({ fileName, fileBase64 }),
  });
}

export async function apiApplyToolQaResult(
  weekId: number,
  payload: {
    memberId: number;
    jobCode: string;
    qcName: string;
    fileName: string;
    fileBase64: string;
    metrics: ToolQaParsedData;
    applyToCoaching?: boolean;
    applyToSharedTracks?: boolean;
  },
): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>(`/api/weeks/${weekId}/qa/apply-tool-result`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiListQaFiles(weekId: number): Promise<QaStoredFile[]> {
  return apiFetch<QaStoredFile[]>(`/api/weeks/${weekId}/qa/files`);
}

export async function apiDownloadQaFile(weekId: number, fileId: number, fileName: string): Promise<void> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`/api/weeks/${weekId}/qa/files/${fileId}/download`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) throw new ApiError(res.status, 'Không thể tải file lưu trữ');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function apiDeleteQaFile(weekId: number, fileId: number): Promise<void> {
  return apiFetch<void>(`/api/weeks/${weekId}/qa/files/${fileId}`, {
    method: 'DELETE',
  });
}
