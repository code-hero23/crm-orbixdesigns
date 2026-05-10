import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import type { User } from '../types/crm';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (identifier: string, password?: string, isGoogle?: boolean) => Promise<void>;
  logout: () => void;
  toggleRole: () => void; // Development only
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const fetchedUser = await authService.getMe();
          setUser(fetchedUser);
        } catch (error) {
          console.error('Failed to fetch user profile', error);
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (identifier: string, password?: string, isGoogle?: boolean) => {
    try {
      setIsLoading(true);
      let authResponse;
      if (isGoogle) {
        authResponse = await authService.googleLogin(identifier);
      } else {
        authResponse = await authService.login(identifier, password);
      }
      
      const { token, user: loggedInUser } = authResponse;
      localStorage.setItem('token', token);
      setUser(loggedInUser);
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const toggleRole = () => {
    setUser(prev => prev ? {
      ...prev,
      role: prev.role === 'ADMIN' ? 'CRE' : 'ADMIN'
    } : null);
  };

  // Expose helpers for development
  if (typeof window !== 'undefined') {
    (window as any).authHelpers = { toggleRole };
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, toggleRole }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
