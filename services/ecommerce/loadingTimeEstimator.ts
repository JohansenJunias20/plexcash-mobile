/**
 * Loading Time Estimator Service
 * 
 * Tracks and estimates loading times for order fetching operations
 * Uses historical data stored in AsyncStorage for better predictions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@order_loading_history';
const MAX_HISTORY_SIZE = 10; // Keep last 10 loading times

export interface LoadingHistoryEntry {
  orderCount: number;
  duration: number; // in milliseconds
  timestamp: number;
}

export interface LoadingEstimate {
  estimatedSeconds: number;
  estimatedRange: { min: number; max: number };
  confidence: 'low' | 'medium' | 'high';
}

export interface LoadingProgress {
  elapsedSeconds: number;
  estimatedTotalSeconds: number;
  estimatedRemainingSeconds: number;
  progressPercentage: number;
  status: 'starting' | 'loading' | 'almost-done' | 'finishing';
}

class LoadingTimeEstimator {
  private history: LoadingHistoryEntry[] = [];
  private isInitialized = false;

  /**
   * Initialize the estimator by loading historical data
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
        console.log('📊 [LoadingEstimator] Loaded history:', this.history.length, 'entries');
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ [LoadingEstimator] Failed to load history:', error);
      this.history = [];
      this.isInitialized = true;
    }
  }

  /**
   * Record a completed loading operation
   */
  async recordLoadingTime(orderCount: number, duration: number): Promise<void> {
    const entry: LoadingHistoryEntry = {
      orderCount,
      duration,
      timestamp: Date.now(),
    };

    this.history.push(entry);

    // Keep only the most recent entries
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-MAX_HISTORY_SIZE);
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
      console.log('📊 [LoadingEstimator] Recorded:', {
        orderCount,
        durationSeconds: (duration / 1000).toFixed(1),
        historySize: this.history.length,
      });
    } catch (error) {
      console.error('❌ [LoadingEstimator] Failed to save history:', error);
    }
  }

  /**
   * Get estimated loading time based on historical data
   */
  getEstimate(orderCount?: number): LoadingEstimate {
    // Default fallback estimate
    const defaultEstimate: LoadingEstimate = {
      estimatedSeconds: 8,
      estimatedRange: { min: 5, max: 15 },
      confidence: 'low',
    };

    if (this.history.length === 0) {
      return defaultEstimate;
    }

    // Calculate average duration
    const totalDuration = this.history.reduce((sum, entry) => sum + entry.duration, 0);
    const avgDuration = totalDuration / this.history.length;
    const avgSeconds = Math.round(avgDuration / 1000);

    // If we know the order count, try to estimate based on similar loads
    if (orderCount !== undefined && orderCount > 0) {
      const similarLoads = this.history.filter(
        (entry) => Math.abs(entry.orderCount - orderCount) < orderCount * 0.3 // Within 30%
      );

      if (similarLoads.length > 0) {
        const similarAvg = similarLoads.reduce((sum, entry) => sum + entry.duration, 0) / similarLoads.length;
        const similarSeconds = Math.round(similarAvg / 1000);
        
        return {
          estimatedSeconds: similarSeconds,
          estimatedRange: {
            min: Math.max(1, Math.round(similarSeconds * 0.7)),
            max: Math.round(similarSeconds * 1.3),
          },
          confidence: similarLoads.length >= 3 ? 'high' : 'medium',
        };
      }
    }

    // Use overall average
    return {
      estimatedSeconds: avgSeconds,
      estimatedRange: {
        min: Math.max(1, Math.round(avgSeconds * 0.7)),
        max: Math.round(avgSeconds * 1.3),
      },
      confidence: this.history.length >= 5 ? 'medium' : 'low',
    };
  }

  /**
   * Calculate real-time progress during loading
   */
  calculateProgress(startTime: number, estimate: LoadingEstimate): LoadingProgress {
    const elapsedMs = Date.now() - startTime;
    // Use decimal seconds for smoother progress updates
    const elapsedSeconds = parseFloat((elapsedMs / 1000).toFixed(1));
    const estimatedTotalSeconds = estimate.estimatedSeconds;

    // Calculate remaining seconds with decimal precision
    const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);
    const estimatedRemainingSeconds = Math.ceil(remainingSeconds);

    // Calculate progress percentage with smooth updates (cap at 95%)
    const rawPercentage = (elapsedSeconds / estimatedTotalSeconds) * 100;
    const progressPercentage = Math.min(95, Math.round(rawPercentage));

    let status: LoadingProgress['status'] = 'loading';
    if (elapsedSeconds < 1) {
      status = 'starting';
    } else if (progressPercentage >= 90) {
      status = 'almost-done';
    } else if (progressPercentage >= 95) {
      status = 'finishing';
    }

    return {
      elapsedSeconds,
      estimatedTotalSeconds,
      estimatedRemainingSeconds,
      progressPercentage,
      status,
    };
  }
}

// Export singleton instance
export const loadingTimeEstimator = new LoadingTimeEstimator();

