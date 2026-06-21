import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { initAuth, setAccessToken } from './lib/firebase';
import { UserSession } from './types';
import Login from './components/Login';
import AttendanceTracker from './components/AttendanceTracker';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Standard initialization of Firebase Auth state listener
    const unsubscribe = initAuth(
      (user, token) => {
        setSession({
          email: user.email,
          displayName: user.displayName || 'Google Instructor',
          photoURL: user.photoURL,
          authMethod: 'google',
          accessToken: token,
        });
        setIsInitializing(false);
      },
      () => {
        // Fallback or unauthenticated state
        setIsInitializing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
    if (userSession.accessToken) {
      setAccessToken(userSession.accessToken);
    }
  };

  const handleLogout = () => {
    setSession(null);
    setAccessToken(null);
  };

  const handleSessionUpdate = (updatedSession: UserSession) => {
    setSession(updatedSession);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4" id="app-loading">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest animate-pulse">
            Booting System...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900" id="app-root">
      <AnimatePresence mode="wait">
        {!session ? (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Login onLoginSuccess={handleLoginSuccess} />
          </motion.div>
        ) : (
          <motion.div
            key="tracker"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AttendanceTracker
              session={session}
              onLogout={handleLogout}
              onSessionUpdate={handleSessionUpdate}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
