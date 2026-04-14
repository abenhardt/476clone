/**
 * AuthCharacterContext.tsx
 *
 * Lets auth pages (LoginPage, RegisterPage) signal the camp counselor
 * characters rendered by AuthLayout without prop-drilling through <Outlet />.
 *
 * Usage in a page:
 *   const { setMode } = useAuthCharacter();
 *   setMode('peek');   // password field focused
 *   setMode('error');  // login failed
 *   setMode('cheer');  // login succeeded
 */

import { createContext, useContext, useState, type ReactNode } from 'react';

export type CharacterMode =
  | 'idle'      // gentle float bob (default)
  | 'peek'      // turn away — password field is focused (privacy!)
  | 'error'     // hop back in alarm — auth failed
  | 'cheer'     // jump and celebrate — success
  | 'excited';  // energetic loop — register page welcome

interface AuthCharacterContextType {
  mode: CharacterMode;
  setMode: (mode: CharacterMode) => void;
}

const AuthCharacterContext = createContext<AuthCharacterContextType>({
  mode: 'idle',
  setMode: () => {},
});

export function AuthCharacterProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CharacterMode>('idle');
  return (
    <AuthCharacterContext.Provider value={{ mode, setMode }}>
      {children}
    </AuthCharacterContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthCharacter() {
  return useContext(AuthCharacterContext);
}
