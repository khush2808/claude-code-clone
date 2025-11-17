/**
 * Application configuration
 * Centralized configuration management for environment-based settings
 */

export const config = {
  /**
   * Check if the application is running in debug mode
   * Debug mode is enabled when NODE_ENV is set to 'debug'
   */
  isDebugMode(): boolean {
    return process.env.NODE_ENV === 'debug';
  },

  /**
   * Check if the application is running in production mode
   * Production mode is the default when NODE_ENV is not 'debug'
   */
  isProductionMode(): boolean {
    return !this.isDebugMode();
  },
};

