/**
 * Developer Mode Context
 * 
 * Manages developer mode state across the app with AsyncStorage persistence.
 * When enabled, shows a log viewer overlay with real-time logs.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVELOPER_MODE_KEY = 'developer_mode_enabled';

interface DeveloperModeContextType {
  isDeveloperMode: boolean;
  toggleDeveloperMode: () => Promise<void>;
  enableDeveloperMode: () => Promise<void>;
  disableDeveloperMode: () => Promise<void>;
}

const DeveloperModeContext = createContext<DeveloperModeContextType | undefined>(undefined);

interface DeveloperModeProviderProps {
  children: ReactNode;
}

export const DeveloperModeProvider: React.FC<DeveloperModeProviderProps> = ({ children }) => {
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load developer mode state from AsyncStorage on mount
  useEffect(() => {
    loadDeveloperModeState();
  }, []);

  const loadDeveloperModeState = async () => {
    try {
      const value = await AsyncStorage.getItem(DEVELOPER_MODE_KEY);
      const enabled = value === 'true';
      setIsDeveloperMode(enabled);
      console.log(`🔧 [DEV-MODE] Loaded developer mode state: ${enabled}`);
    } catch (error) {
      console.error('🔧 [DEV-MODE] Failed to load developer mode state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const enableDeveloperMode = async () => {
    try {
      await AsyncStorage.setItem(DEVELOPER_MODE_KEY, 'true');
      setIsDeveloperMode(true);
      console.log('🔧 [DEV-MODE] Developer mode ENABLED');
    } catch (error) {
      console.error('🔧 [DEV-MODE] Failed to enable developer mode:', error);
    }
  };

  const disableDeveloperMode = async () => {
    try {
      await AsyncStorage.setItem(DEVELOPER_MODE_KEY, 'false');
      setIsDeveloperMode(false);
      console.log('🔧 [DEV-MODE] Developer mode DISABLED');
    } catch (error) {
      console.error('🔧 [DEV-MODE] Failed to disable developer mode:', error);
    }
  };

  const toggleDeveloperMode = async () => {
    if (isDeveloperMode) {
      await disableDeveloperMode();
    } else {
      await enableDeveloperMode();
    }
  };

  const value: DeveloperModeContextType = {
    isDeveloperMode,
    toggleDeveloperMode,
    enableDeveloperMode,
    disableDeveloperMode,
  };

  // Don't render children until we've loaded the state
  if (isLoading) {
    return null;
  }

  return (
    <DeveloperModeContext.Provider value={value}>
      {children}
    </DeveloperModeContext.Provider>
  );
};

export const useDeveloperMode = (): DeveloperModeContextType => {
  const context = useContext(DeveloperModeContext);
  if (context === undefined) {
    throw new Error('useDeveloperMode must be used within a DeveloperModeProvider');
  }
  return context;
};

export default DeveloperModeContext;

