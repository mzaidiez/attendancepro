import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google Auth Provider with necessary Google Sheets and Google Drive permissions
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');

// Keep the access token in memory as required. Do NOT store in localStorage for security.
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize Auth listener. Can be used to hook into state updates.
export const initAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If there is a user but no cached token, we can trigger sign-in again
        // or check if we have a way to prompt. Let's trigger failure so user connects.
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure();
    }
  });
};

// Start Google sign-in with pop-up
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google OAuth access token from sign-in response.');
    }
    
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google authorization failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Fetch current in-memory access token
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Manually update/set the token (useful for manual updates or restorations)
export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Sign out from application
export const handleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
export { app };
