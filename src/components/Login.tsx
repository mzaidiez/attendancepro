import React, { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, Mail, Lock, ShieldCheck, HelpCircle } from 'lucide-react';
import { googleSignIn } from '../lib/firebase';
import { UserSession } from '../types';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Default demo credentials showing on screen for easy verification
  const demoUser = 'teacher@class.com';
  const demoPass = 'securepass2026';

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      // Validate credentials
      if (email.trim().toLowerCase() === demoUser && password === demoPass) {
        onLoginSuccess({
          email: demoUser,
          displayName: 'Class Instructor',
          photoURL: null,
          authMethod: 'credentials',
          accessToken: null,
        });
      } else {
        setError('Invalid username or password. Please use the demo credentials provided below.');
      }
      setIsLoading(false);
    }, 800);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        onLoginSuccess({
          email: result.user.email,
          displayName: result.user.displayName || 'Google Instructor',
          photoURL: result.user.photoURL,
          authMethod: 'google',
          accessToken: result.accessToken,
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || 'Failed to authenticate with Google. Make sure you accepted the authentication popup.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" id="login-container">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
        id="login-card"
      >
        {/* Header Block */}
        <div className="p-8 text-center bg-gradient-to-br from-blue-50/50 to-white border-b border-slate-200" id="login-header">
          <div className="inline-flex p-3 bg-blue-600 rounded-lg text-white shadow-md shadow-blue-100 mb-4 animate-pulse">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="font-sans font-bold text-2xl tracking-tight text-slate-900">
            AttendSync Pro
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Access your student attendance tracking suite
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-start gap-2"
              id="login-error"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleCredentialsSubmit} className="space-y-4" id="credentials-form">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Username / Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="input-username"
                  type="email"
                  required
                  placeholder="name@school.com"
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="input-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-6" id="login-divider">
            <div className="absolute inset-x-0 h-px bg-slate-200" />
            <span className="relative bg-white px-3 text-xs text-slate-400 font-bold uppercase tracking-wider">
              or connect with
            </span>
          </div>

          {/* Google SSO Button */}
          <button
            id="btn-google-login"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-2 px-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm shadow-sm transition-colors cursor-pointer select-none disabled:opacity-50"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Credentials Helper Container */}
          <div className="mt-8 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5" id="credentials-helper">
            <HelpCircle className="h-4.5 w-4.5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-800">Demo Account Credentials:</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px] text-blue-700 font-bold">teacher@class.com</span>
                <span>/</span>
                <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px] text-blue-700 font-bold">securepass2026</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
