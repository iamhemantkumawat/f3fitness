import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../lib/api';

const AuthContext = createContext(null);

// Helper functions to handle storage based on rememberMe preference
const getStoredToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

const getStoredUser = () => {
  const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

const setStoredAuth = (token, user, rememberMe) => {
  const storage = rememberMe ? localStorage : sessionStorage;
  // Clear both storages first
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  // Set in appropriate storage
  storage.setItem('token', token);
  storage.setItem('user', JSON.stringify(user));
  if (rememberMe) {
    localStorage.setItem('rememberMe', 'true');
  } else {
    localStorage.removeItem('rememberMe');
  }
};

const clearStoredAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('rememberMe');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(getStoredToken());

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();
      if (storedToken) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data);
          setToken(storedToken);
        } catch (error) {
          clearStoredAuth();
          setToken(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (credentials) => {
    const response = await authAPI.login(credentials);
    const { token: newToken, user: userData } = response.data;
    const rememberMe = credentials.rememberMe !== false; // Default to true if not specified
    setStoredAuth(newToken, userData, rememberMe);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const signup = async (data) => {
    const response = await authAPI.signup(data);
    const { token: newToken, user: userData } = response.data;
    setStoredAuth(newToken, userData, true); // Always remember for signup
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    // Update in the appropriate storage
    if (localStorage.getItem('token')) {
      localStorage.setItem('user', JSON.stringify(userData));
    } else if (sessionStorage.getItem('token')) {
      sessionStorage.setItem('user', JSON.stringify(userData));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
