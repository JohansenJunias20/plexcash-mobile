import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

export type OrientationType = 'portrait' | 'landscape';

export interface OrientationInfo {
  orientation: OrientationType;
  isLandscape: boolean;
  isPortrait: boolean;
  isTablet: boolean;
  width: number;
  height: number;
}

/**
 * Hook to detect device orientation and screen dimensions
 * Returns orientation info that updates when device rotates
 */
export const useOrientation = (): OrientationInfo => {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  useEffect(() => {
    const onChange = ({ window }: { window: ScaledSize }) => {
      setDimensions({ width: window.width, height: window.height });
    };

    const subscription = Dimensions.addEventListener('change', onChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  const { width, height } = dimensions;
  const isLandscape = width > height;
  const isPortrait = !isLandscape;
  
  // Consider device a tablet if smallest dimension is >= 600dp
  const smallestDimension = Math.min(width, height);
  const isTablet = smallestDimension >= 600;

  return {
    orientation: isLandscape ? 'landscape' : 'portrait',
    isLandscape,
    isPortrait,
    isTablet,
    width,
    height,
  };
};

