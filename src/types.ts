export type AttendanceStatus = 'present' | 'absent' | 'late' | 'none';

export interface Student {
  id: string;
  name: string;
  email?: string;
  attendance: AttendanceStatus;
}

export interface SpreadsheetInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface UserSession {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  authMethod: 'credentials' | 'google';
  accessToken: string | null; // Google API token if connected
}
