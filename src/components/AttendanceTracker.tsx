import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserSession, 
  Student, 
  SpreadsheetInfo, 
  AttendanceStatus 
} from '../types';
import { 
  fetchSpreadsheets, 
  createSpreadsheet, 
  readSpreadsheetValues, 
  syncAttendanceData,
  fetchSpreadsheetMetadata
} from '../lib/googleSheets';
import { googleSignIn, handleSignOut } from '../lib/firebase';
import { 
  Check, 
  X, 
  Clock, 
  Share2, 
  CircleDot, 
  FolderLock, 
  Plus, 
  FileSpreadsheet, 
  RefreshCw, 
  ExternalLink, 
  Calendar, 
  LogOut, 
  User as UserIcon, 
  AlertCircle, 
  Sparkle, 
  CheckCheck,
  FolderSync,
  BarChart3,
  LayoutGrid
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

interface AttendanceTrackerProps {
  session: UserSession;
  onLogout: () => void;
  onSessionUpdate: (session: UserSession) => void;
}

// Pre-configured default students for quick start
const INITIAL_STUDENTS: Student[] = [
  { id: '1', name: 'Alexander Wright', email: 'alex.w@academy.edu', attendance: 'none' },
  { id: '2', name: 'Beatrix Vane', email: 'b.vane@academy.edu', attendance: 'none' },
  { id: '3', name: 'Cassian Mercer', email: 'c.mercer@academy.edu', attendance: 'none' },
  { id: '4', name: 'Delilah Sterling', email: 'd.sterling@academy.edu', attendance: 'none' },
  { id: '5', name: 'Ezra Vance', email: 'e.vance@academy.edu', attendance: 'none' },
  { id: '6', name: 'Fiona Gallagher', email: 'f.gall@academy.edu', attendance: 'none' },
  { id: '7', name: 'Gideon Thorne', email: 'g.thorne@academy.edu', attendance: 'none' },
];

export default function AttendanceTracker({ session, onLogout, onSessionUpdate }: AttendanceTrackerProps) {
  // Roster state
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');

  // Date selection state
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Sheets integration state
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<SpreadsheetInfo | null>(null);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState('Biology 101 Attendance');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [manualSheetInput, setManualSheetInput] = useState('');
  const [isLinkingManualSheet, setIsLinkingManualSheet] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'dashboard'>('grid');

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Load spreadsheet roster state
  const [isPullingRoster, setIsPullingRoster] = useState(false);

  // Fetch spreadsheets once Google token is available
  useEffect(() => {
    if (session.accessToken) {
      loadSpreadsheets();
    }
  }, [session.accessToken]);

  const loadSpreadsheets = async () => {
    if (!session.accessToken) return;
    setIsLoadingSheets(true);
    setErrorMessage(null);
    try {
      const sheetsList = await fetchSpreadsheets(session.accessToken);
      setSpreadsheets(sheetsList);
      
      // Auto-select first spreadsheet if available
      if (sheetsList.length > 0 && !selectedSheet) {
        setSelectedSheet(sheetsList[0]);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not load spreadsheets from your Drive. Please verify your connection.');
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        onSessionUpdate({
          ...session,
          authMethod: 'google',
          accessToken: result.accessToken,
          photoURL: result.user.photoURL,
          displayName: result.user.displayName || session.displayName,
        });
      }
    } catch (err) {
      console.error('Failed to link Google account:', err);
    }
  };

  const handleLinkManualSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session.accessToken || !manualSheetInput.trim()) return;

    setIsLinkingManualSheet(true);
    setErrorMessage(null);
    try {
      const matches = manualSheetInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const sheetId = matches ? matches[1] : manualSheetInput.trim();

      if (!sheetId || sheetId.length < 15) {
        throw new Error('Invalid Google Sheet ID or URL. Please verify the copied link format.');
      }

      const meta = await fetchSpreadsheetMetadata(session.accessToken, sheetId);
      
      setSpreadsheets((prev) => {
        if (prev.some((s) => s.id === meta.id)) return prev;
        return [meta, ...prev];
      });
      setSelectedSheet(meta);
      setManualSheetInput('');
      setSyncStatus('success');
      setSyncMessage(`Successfully linked sheet: "${meta.name}"`);
      setTimeout(() => setSyncStatus('idle'), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to sync with this spreadsheet. Confirm your Google account has permission to read/edit this file.');
    } finally {
      setIsLinkingManualSheet(false);
    }
  };

  const handleCreateNewSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session.accessToken || !newSheetTitle.trim()) return;

    setIsCreatingSheet(true);
    setErrorMessage(null);
    try {
      const newSheet = await createSpreadsheet(session.accessToken, newSheetTitle.trim());
      setSpreadsheets((prev) => [newSheet, ...prev]);
      setSelectedSheet(newSheet);
      setShowCreateModal(false);
      
      // Auto trigger sync dialog or success
      setSyncStatus('success');
      setSyncMessage(`Spreadsheet "${newSheet.name}" was successfully created in your Google Drive.`);
      setTimeout(() => setSyncStatus('idle'), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Failed to create new spreadsheet. Please try again.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Pull existing roster from spreadsheet if available
  const handleLoadRosterFromSheet = async () => {
    if (!session.accessToken || !selectedSheet) return;
    setIsPullingRoster(true);
    setErrorMessage(null);
    try {
      const values = await readSpreadsheetValues(session.accessToken, selectedSheet.id, 'Sheet1!A1:B100');
      if (values && values.length > 1) {
        const loadedStudents: Student[] = [];
        // Skip header row
        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          if (row[0]) {
            loadedStudents.push({
              id: `${i}`,
              name: row[0],
              email: row[1] || '',
              attendance: 'none'
            });
          }
        }
        if (loadedStudents.length > 0) {
          setStudents(loadedStudents);
          setSyncStatus('success');
          setSyncMessage(`Imported ${loadedStudents.length} students from Google Sheet.`);
          setTimeout(() => setSyncStatus('idle'), 3000);
        } else {
          setErrorMessage('No student data was found in the Google Sheet. Default list preserved.');
        }
      } else {
        setErrorMessage('This worksheet does not contain a structured roster (missing "Student Name" columns).');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to read roster from Sheet. Check if the sheet structure is accessible.');
    } finally {
      setIsPullingRoster(false);
    }
  };

  // Add individual student to roster list
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    const newStudent: Student = {
      id: Date.now().toString(),
      name: newStudentName.trim(),
      email: newStudentEmail.trim() || undefined,
      attendance: 'none',
    };

    setStudents((prev) => [...prev, newStudent]);
    setNewStudentName('');
    setNewStudentEmail('');
  };

  const handleRemoveStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSetAllAttendance = (status: AttendanceStatus) => {
    setStudents((prev) => prev.map((s) => ({ ...s, attendance: status })));
  };

  const handleSetStudentAttendance = (id: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, attendance: status } : s))
    );
  };

  // Sync click triggers the warning modal (least privilege / security rule requirement)
  const handleInitiateSync = () => {
    // Audit check: Are we connected to google sheet?
    if (!selectedSheet) {
      setErrorMessage('Please select or create a Google Sheet to write data to.');
      return;
    }
    // Audit check: Did we set any student's status?
    const hasUnmarked = students.some(s => s.attendance === 'none');
    if (hasUnmarked) {
      const confirmProceed = window.confirm('Some students do not have attendance marked yet. Do you want to proceed with syncing?');
      if (!confirmProceed) return;
    }
    setShowConfirmModal(true);
  };

  const handleExecuteSync = async () => {
    setShowConfirmModal(false);
    if (!session.accessToken || !selectedSheet) return;

    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('Syncing grid data with Google Sheets...');
    
    try {
      await syncAttendanceData(session.accessToken, selectedSheet.id, date, students);
      setSyncStatus('success');
      setSyncMessage(`Attendance record for ${date} successfully synced to Google Sheet.`);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setSyncMessage(err.message || 'An error occurred during sheet synchronization. Verify authorization.');
    } finally {
      setIsSyncing(false);
    }
  };

  const totalUsers = students.length;
  const presentCount = students.filter(s => s.attendance === 'present').length;
  const lateCount = students.filter(s => s.attendance === 'late').length;
  const absentCount = students.filter(s => s.attendance === 'absent').length;
  const unmarkedCount = students.filter(s => s.attendance === 'none').length;

  const attendanceRate = totalUsers > 0 
    ? Math.round(((presentCount + (lateCount * 0.7)) / totalUsers) * 100) 
    : 0;

  const getInsights = () => {
    if (totalUsers === 0) return 'No students registered.';
    if (attendanceRate >= 90) return 'Exceptional class participation! Keep up the great engagement momentum.';
    if (attendanceRate >= 75) return 'Healthy class participation. Some minor student gaps are present.';
    return 'Attendance attention required. Consider contacting absentees to reassess class connection.';
  };

  const chartData = [
    { name: 'Present', value: presentCount, fill: '#10b981' },
    { name: 'Late', value: lateCount, fill: '#f59e0b' },
    { name: 'Absent', value: absentCount, fill: '#f43f5e' },
    { name: 'Unmarked', value: unmarkedCount, fill: '#94a3b8' }
  ].filter(item => item.value > 0 || item.name === 'Present');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="tracker-root">
      {/* Navbar section */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm" id="nav-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded text-white font-bold">
              A
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-lg block">
                AttendSync Pro
              </span>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block -mt-1.5">
                Google Sheets Sync
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Profile display */}
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              {session.photoURL ? (
                <img referrerPolicy="no-referrer" src={session.photoURL} alt={session.displayName || ''} className="h-6 w-6 rounded-full ring-2 ring-blue-50" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {session.displayName?.charAt(0) || 'T'}
                </div>
              )}
              <div className="text-left leading-none">
                <span className="text-xs font-semibold text-slate-700 block">{session.displayName}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">{session.email}</span>
              </div>
            </div>

            <button
              id="btn-logout"
              onClick={async () => {
                await handleSignOut();
                onLogout();
              }}
              className="p-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Primary body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6" id="main-content">
        {/* Left Column: Config Panel & Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Status Box & Error warnings */}
          {errorMessage && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex gap-3 shadow-sm animate-pulse"
              id="error-banner"
            >
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm">Connection / Load Error</span>
                <p className="mt-1 leading-relaxed text-slate-700">{errorMessage}</p>
                <div className="mt-2.5 flex items-center gap-3">
                  <a
                    href="https://drive.google.com/drive/u/0/search?q=type:spreadsheet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-white border border-rose-200 text-rose-700 hover:bg-rose-100/50 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors shadow-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Browse Google Drive
                  </a>
                  <button 
                    onClick={() => setErrorMessage(null)}
                    className="text-rose-600 hover:text-rose-800 underline font-semibold transition-colors cursor-pointer text-[11px]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Sync Status Overlay / Card */}
          {syncStatus !== 'idle' && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`p-4 rounded-xl border text-xs shadow-md ${
                syncStatus === 'success' 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                  : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {syncStatus === 'success' ? (
                  <CheckCheck className="h-5 w-5 text-emerald-600 animate-bounce" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-rose-600" />
                )}
                <div>
                  <span className="font-bold">{syncStatus === 'success' ? 'Synchronized' : 'Sync Error'}</span>
                  <p className="mt-0.5">{syncMessage}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Google Connection Guard Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs" id="integration-config-card">
            <h2 className="font-sans font-medium text-slate-900 text-sm tracking-tight mb-4 flex items-center gap-2">
              <FileSpreadsheet className="h-4.5 w-4.5 text-blue-600" />
              Google Sheets Integration
            </h2>

            {session.authMethod !== 'google' && !session.accessToken ? (
              <div className="rounded-xl bg-blue-50/40 border border-blue-100 p-4 text-center">
                <p className="text-xs text-slate-600 leading-relaxed mb-3.5">
                  You are signed in locally. Connect your Google account to enable auto-saving attendance data to Google Sheets.
                </p>
                <button
                  id="btn-connect-google"
                  onClick={handleConnectGoogle}
                  className="w-full flex items-center justify-center gap-2.5 py-2 px-3 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs shadow-xs transition-colors cursor-pointer select-none"
                >
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4.5 w-4.5 shrink-0">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  <span>Connect Google Account</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Sheet selector */}
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                    Select Target Google Sheet
                  </label>
                  
                  {isLoadingSheets ? (
                    <div className="flex items-center gap-2 py-2 px-3 border border-slate-200 rounded-lg text-slate-400 text-xs bg-slate-50/50">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Fetching sheets from Drive...</span>
                    </div>
                  ) : spreadsheets.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-lg p-3 text-center bg-slate-50">
                      <span className="text-xs text-slate-500 block">No spreadsheets found.</span>
                      <button
                        id="btn-open-create-blank"
                        onClick={() => setShowCreateModal(true)}
                        className="mt-1.5 text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        Create a blank sheet
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        id="sheet-selector"
                        className="w-full text-xs text-slate-600 border border-slate-200 rounded-lg py-2 pl-2 pr-8 bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={selectedSheet?.id || ''}
                        onChange={(e) => {
                          const sheet = spreadsheets.find(x => x.id === e.target.value);
                          if (sheet) setSelectedSheet(sheet);
                        }}
                      >
                        {spreadsheets.map((sheet) => (
                          <option key={sheet.id} value={sheet.id}>
                            📂 {sheet.name}
                          </option>
                        ))}
                      </select>
                      
                      {selectedSheet && (
                        <div className="flex items-center gap-1.5 justify-between">
                          <a
                            href={selectedSheet.webViewLink || `https://docs.google.com/spreadsheets/d/${selectedSheet.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 font-medium transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>View Spreadsheet in Sheets</span>
                          </a>

                          <button
                            onClick={handleLoadRosterFromSheet}
                            disabled={isPullingRoster}
                            className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-700 font-bold disabled:opacity-50 cursor-pointer"
                          >
                            <RefreshCw className={`h-3 w-3 ${isPullingRoster ? 'animate-spin' : ''}`} />
                            <span>Load Sheet Roster</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    id="btn-refresh-sheets"
                    onClick={loadSpreadsheets}
                    disabled={isLoadingSheets}
                    className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Reload List</span>
                  </button>

                  <button
                    id="btn-trigger-create-modal"
                    onClick={() => setShowCreateModal(true)}
                    className="flex-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Sheet</span>
                  </button>
                </div>

                {/* Manual Sheet Link option */}
                <div className="border-t border-slate-200 pt-3.5">
                  <form onSubmit={handleLinkManualSheet} className="space-y-2">
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      Or link spreadsheet by URL / ID
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Paste Google Sheet URL/ID"
                        value={manualSheetInput}
                        onChange={(e) => setManualSheetInput(e.target.value)}
                        className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={isLinkingManualSheet || !manualSheetInput.trim()}
                        className="py-1.5 px-3 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40"
                      >
                        {isLinkingManualSheet ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          'Link'
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Direct Google Drive browser link */}
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                  <span className="font-semibold">Searching for files?</span>
                  <a
                    href="https://drive.google.com/drive/u/0/search?q=type:spreadsheet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Browse Google Drive
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Date Selector Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs" id="date-config-card">
            <h2 className="font-sans font-medium text-slate-900 text-sm tracking-tight mb-3 flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-blue-600" />
              Session Calendar
            </h2>
            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
              Attendance data will be captured under the chosen date column header on the spreadsheet.
            </p>
            <div className="relative">
              <input
                id="session-date-picker"
                type="date"
                className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Setup manual Roster editor card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs" id="roster-editor-card">
            <h2 className="font-sans font-medium text-slate-900 text-sm tracking-tight mb-1 flex items-center gap-2">
              <UserIcon className="h-4.5 w-4.5 text-blue-600" />
              Add Student to List
            </h2>
            <p className="text-[11px] text-slate-500 mb-4 font-normal">
              Register a student to the interactive class list locally.
            </p>

            <form onSubmit={handleAddStudent} className="space-y-3" id="add-student-form">
              <div>
                <input
                  id="student-name-input"
                  type="text"
                  required
                  placeholder="Full Name"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                />
              </div>
              <div>
                <input
                  id="student-email-input"
                  type="email"
                  placeholder="Email Address (optional)"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                />
              </div>
              <button
                id="btn-add-student"
                type="submit"
                className="w-full py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Append Student</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Attendance Workspace */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col" id="workspace-card">
            {/* Header toolbar */}
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50/50 to-white flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="font-sans font-semibold text-slate-900 text-base tracking-tight flex items-center gap-1.5">
                    {activeTab === 'grid' ? 'Attendance Grid' : 'Analytics Dashboard'}
                    <span className="bg-blue-100 text-blue-800 font-bold text-[10px] px-2 py-0.5 rounded-full">
                      {students.length} students
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {activeTab === 'grid' 
                      ? 'Mark statuses, manage students, and push live reports.' 
                      : 'Live visual insights, rate distribution, and registry analysis.'}
                  </p>
                </div>

                {/* Segmented Tab buttons */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 grid grid-cols-2 self-start sm:self-auto w-full sm:w-64">
                  <button
                    onClick={() => setActiveTab('grid')}
                    className={`py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'grid' 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>Grid View</span>
                  </button>
                  <button
                    id="btn-generate-dashboard"
                    onClick={() => setActiveTab('dashboard')}
                    className={`py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'dashboard' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Dashboard</span>
                  </button>
                </div>
              </div>

              {/* Filters shown ONLY in Grid View */}
              {activeTab === 'grid' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 pt-4 gap-3">
                  <span className="text-[11px] text-slate-400 font-medium">Quick adjustments:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      id="btn-bulk-present"
                      onClick={() => handleSetAllAttendance('present')}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Check className="h-3 w-3" />
                      <span>All Present</span>
                    </button>
                    <button
                      id="btn-bulk-absent"
                      onClick={() => handleSetAllAttendance('absent')}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <X className="h-3 w-3" />
                      <span>All Absent</span>
                    </button>
                    <button
                      id="btn-bulk-clear"
                      onClick={() => handleSetAllAttendance('none')}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List block or Dashboard block */}
            {activeTab === 'dashboard' ? (
              <div className="p-6 sm:p-8 space-y-6" id="dashboard-analytics-view">
                {/* Visual stats metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Attendance Rate</span>
                      <h4 className="text-3xl font-extrabold text-slate-900 mt-1">{attendanceRate}%</h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                      Weighted metrics: present count with a 70% late-adjustment factor.
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Class Status Insight</span>
                      <h4 className="text-base font-semibold text-slate-800 mt-2 leading-snug">
                        {attendanceRate >= 90 ? 'Highly Engaged class' : attendanceRate >= 75 ? 'Moderate Engagement' : 'Needs Intervention'}
                      </h4>
                    </div>
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-110 rounded-md p-2 mt-2 leading-relaxed">
                      {getInsights()}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fulfillment</span>
                      <h4 className="text-3xl font-extrabold text-slate-900 mt-1">
                        {students.length - unmarkedCount} <span className="text-sm font-normal text-slate-400">/ {students.length}</span>
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                      Percentage mapped: {Math.round(((students.length - unmarkedCount) / (students.length || 1)) * 100)}% of current roster marked.
                    </p>
                  </div>
                </div>

                {/* Charts block */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Chart 1: Bar distribution */}
                  <div className="border border-slate-200 rounded-xl p-5 bg-white">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                      Headcount Distribution
                    </h3>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                            labelStyle={{ fontWeight: 'bold' }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Status Proportions */}
                  <div className="border border-slate-200 rounded-xl p-5 bg-white flex flex-col">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                      Attendance Proportion percentage
                    </h3>
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6">
                      <div className="h-44 w-44 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {chartData.map((entry, idx) => (
                                <Cell key={`cell-pie-${idx}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Legend detail list */}
                      <div className="space-y-2.5 w-full">
                        {chartData.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                              <span className="font-semibold text-slate-600">{entry.name}</span>
                            </div>
                            <span className="font-mono font-bold text-slate-900">
                              {entry.value} ({Math.round((entry.value / (students.length || 1)) * 100)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subsections: Attendance list highlights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="border border-slate-200 rounded-xl p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-3 flex items-center gap-1.5">
                      <X className="h-4 w-4" />
                      Absent list ({absentCount})
                    </h3>
                    {absentCount === 0 ? (
                      <p className="text-xs text-slate-400 italic">No absentees marked for today's session.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {students.filter(s => s.attendance === 'absent').map(s => (
                          <div key={s.id} className="flex justify-between items-center bg-rose-50/50 border border-rose-100 rounded-lg p-2 text-xs">
                            <span className="font-semibold text-slate-800">{s.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{s.email || 'No email registered'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-xl p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-3 flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Late Arrivals ({lateCount})
                    </h3>
                    {lateCount === 0 ? (
                      <p className="text-xs text-slate-400 italic">No late students reported.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {students.filter(s => s.attendance === 'late').map(s => (
                          <div key={s.id} className="flex justify-between items-center bg-amber-50/50 border border-amber-100 rounded-lg p-2 text-xs">
                            <span className="font-semibold text-slate-800">{s.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{s.email || 'No email'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Grid view */
              students.length === 0 ? (
                <div className="p-16 text-center" id="empty-roster-state">
                  <div className="inline-flex p-4 bg-slate-50 border border-slate-100 rounded-full text-slate-400 mb-3">
                    <UserIcon className="h-8 w-8" />
                  </div>
                  <h3 className="font-sans font-medium text-slate-800 text-sm">Class Roster is Empty</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Add student names manually using the left sidebar parser or select "Load Sheet Roster" if connected to Google Drive.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  <table className="w-full text-left border-collapse" id="attendance-table">
                    <thead>
                      <tr className="bg-slate-50/40 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        <th className="px-6 py-3">Student info</th>
                        <th className="px-6 py-3 text-center w-64">Attendance Status</th>
                        <th className="px-6 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((student, idx) => (
                        <tr key={student.id} className="hover:bg-slate-50/35 transition-colors group">
                          <td className="px-6 py-4.5">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-slate-300 text-xs w-4">
                                {idx + 1}
                              </span>
                              <div>
                                <span className="text-xs font-semibold text-slate-800 block">
                                  {student.name}
                                </span>
                                {student.email && (
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    {student.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="flex items-center justify-center gap-1">
                              {/* Present checkbox button */}
                              <button
                                id={`status-present-${student.id}`}
                                onClick={() => handleSetStudentAttendance(student.id, 'present')}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                  student.attendance === 'present'
                                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs shadow-emerald-200'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
                                }`}
                              >
                                <Check className="h-3.5 w-3.5 shrink-0" />
                                <span>Present</span>
                              </button>

                              {/* Late button */}
                              <button
                                id={`status-late-${student.id}`}
                                onClick={() => handleSetStudentAttendance(student.id, 'late')}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                  student.attendance === 'late'
                                    ? 'bg-amber-500 border-amber-600 text-white shadow-xs shadow-amber-200'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-600'
                                }`}
                              >
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                <span>Late</span>
                              </button>

                              {/* Absent button */}
                              <button
                                id={`status-absent-${student.id}`}
                                onClick={() => handleSetStudentAttendance(student.id, 'absent')}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                  student.attendance === 'absent'
                                    ? 'bg-rose-500 border-rose-600 text-white shadow-xs shadow-rose-200'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600'
                                }`}
                              >
                                <X className="h-3.5 w-3.5 shrink-0" />
                                <span>Absent</span>
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4.5 text-right w-12">
                            <button
                              id={`remove-student-${student.id}`}
                              onClick={() => handleRemoveStudent(student.id)}
                              className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer select-none opacity-0 group-hover:opacity-100"
                              title="Delete Student"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Sync control summary footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Quick stats panel */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Pres: <strong className="text-slate-700">{students.filter(x => x.attendance === 'present').length}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Late: <strong className="text-slate-700">{students.filter(x => x.attendance === 'late').length}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Abs: <strong className="text-slate-700">{students.filter(x => x.attendance === 'absent').length}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  Unmarked: <strong className="text-slate-700">{students.filter(x => x.attendance === 'none').length}</strong>
                </span>
              </div>

              {/* Master Sync Action button */}
              <button
                id="btn-master-sync"
                onClick={handleInitiateSync}
                disabled={isSyncing || students.length === 0}
                className="w-full sm:w-auto py-2.5 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-lg shadow-md hover:shadow-blue-100 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    <span>Sync to Google Sheets</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Roster sheet creation modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-sans font-medium text-slate-900 text-sm flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  Create Spreadsheet
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <form onSubmit={handleCreateNewSheet} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                    Spreadsheet Title
                  </label>
                  <input
                    id="new-sheet-title-input"
                    type="text"
                    required
                    placeholder="e.g. Calculus II Attendance"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2 text-slate-500 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-create-sheet-submit"
                    type="submit"
                    disabled={isCreatingSheet}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1"
                  >
                    {isCreatingSheet ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Create Sheet'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog before editing/syncing on user's Sheet (least privilege mandate) */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100"
              id="confirm-sync-modal"
            >
              <div className="flex items-start gap-3.5 mb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Share2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-sans font-semibold text-slate-900 text-sm">
                    Confirm Google Sheets Sync
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Please approve rewriting/creating rows in your chosen Google Spreadsheet.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50/65 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2 mb-5">
                <div className="flex items-center justify-between">
                  <span>Sheet Location:</span>
                  <strong className="text-slate-800 shrink-0 select-all">{selectedSheet?.name}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Target Date Column:</span>
                  <strong className="text-slate-800 shrink-0">{date}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Students Synced:</span>
                  <strong className="text-slate-800 shrink-0">{students.length}</strong>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="btn-execute-sync-confirm"
                  onClick={handleExecuteSync}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-100"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Confirm and Sync</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
