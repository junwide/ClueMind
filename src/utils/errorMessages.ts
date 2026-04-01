/**
 * Error messages for DropMind application
 * Centralized error message management for consistent user experience
 */

export const ERROR_MESSAGES = {
  // IO Errors
  IO_FILE_NOT_FOUND: 'File not found. Please check the file path.',
  IO_PERMISSION_DENIED: 'Permission denied. Please check file permissions.',
  IO_DISK_FULL: 'Disk is full. Please free up space and try again.',
  IO_UNKNOWN: 'A file operation error occurred.',

  // JSON/Serialization Errors
  JSON_PARSE_ERROR: 'Invalid data format. The data may be corrupted.',
  JSON_INVALID_STRUCTURE: 'Data structure is invalid.',
  SERIALIZATION_ERROR: 'Failed to process data.',

  // Sidecar Errors
  SIDECAR_NOT_RUNNING: 'Background service is not running. Please restart the application.',
  SIDECAR_CONNECTION_FAILED: 'Failed to connect to background service.',
  SIDECAR_TIMEOUT: 'Background service did not respond in time.',
  SIDECAR_UNKNOWN: 'Background service error occurred.',

  // API Errors
  API_NETWORK_ERROR: 'Network error. Please check your internet connection.',
  API_RATE_LIMIT: 'Too many requests. Please wait and try again.',
  API_UNAUTHORIZED: 'Authentication required. Please check your credentials.',
  API_NOT_FOUND: 'Resource not found.',
  API_SERVER_ERROR: 'Server error. Please try again later.',
  API_UNKNOWN: 'API request failed.',

  // Storage Errors
  STORAGE_WRITE_FAILED: 'Failed to save data.',
  STORAGE_READ_FAILED: 'Failed to read data.',
  STORAGE_DELETE_FAILED: 'Failed to delete data.',
  STORAGE_UNKNOWN: 'Storage operation failed.',

  // Validation Errors
  VALIDATION_REQUIRED_FIELD: 'This field is required.',
  VALIDATION_INVALID_FORMAT: 'Invalid format.',
  VALIDATION_OUT_OF_RANGE: 'Value is out of acceptable range.',
  VALIDATION_UNKNOWN: 'Invalid input.',

  // Config Errors
  CONFIG_LOAD_FAILED: 'Failed to load configuration.',
  CONFIG_SAVE_FAILED: 'Failed to save configuration.',
  CONFIG_INVALID: 'Configuration is invalid.',
  CONFIG_UNKNOWN: 'Configuration error occurred.',

  // Keyring Errors
  KEYRING_NOT_FOUND: 'Credential not found.',
  KEYRING_ACCESS_DENIED: 'Access to credential store denied.',
  KEYRING_UNKNOWN: 'Credential store error.',

  // Generic Errors
  UNKNOWN_ERROR: 'An unexpected error occurred.',
  OPERATION_FAILED: 'Operation failed.',
} as const;

export const SUCCESS_MESSAGES = {
  // IO Success
  IO_FILE_SAVED: 'File saved successfully.',
  IO_FILE_LOADED: 'File loaded successfully.',
  IO_FILE_DELETED: 'File deleted successfully.',

  // Storage Success
  STORAGE_SAVED: 'Data saved successfully.',
  STORAGE_LOADED: 'Data loaded successfully.',
  STORAGE_DELETED: 'Data deleted successfully.',

  // API Success
  API_REQUEST_SUCCESS: 'Request completed successfully.',
  API_CONNECTED: 'Connected successfully.',

  // Sidecar Success
  SIDECAR_STARTED: 'Background service started.',
  SIDECAR_STOPPED: 'Background service stopped.',
  SIDECAR_HEALTHY: 'Background service is healthy.',

  // Config Success
  CONFIG_SAVED: 'Configuration saved.',
  CONFIG_LOADED: 'Configuration loaded.',
  CONFIG_RESET: 'Configuration reset to defaults.',

  // Generic Success
  OPERATION_SUCCESS: 'Operation completed successfully.',
  CHANGES_SAVED: 'Changes saved.',
} as const;

/**
 * Maps error codes from backend to user-friendly messages
 */
export function getErrorMessage(errorType: string, details?: string): string {
  const baseMessage = ERROR_MESSAGES[errorType as keyof typeof ERROR_MESSAGES]
    || ERROR_MESSAGES.UNKNOWN_ERROR;

  return details ? `${baseMessage} ${details}` : baseMessage;
}

/**
 * Maps success codes to user-friendly messages
 */
export function getSuccessMessage(successType: string): string {
  return SUCCESS_MESSAGES[successType as keyof typeof SUCCESS_MESSAGES]
    || SUCCESS_MESSAGES.OPERATION_SUCCESS;
}

/**
 * Error types matching backend AppError enum
 */
export type AppErrorType =
  | 'Io'
  | 'Json'
  | 'Sidecar'
  | 'Api'
  | 'Storage'
  | 'Validation'
  | 'Config'
  | 'Keyring'
  | 'Serialization';

/**
 * Maps backend error types to frontend error messages
 */
export function mapBackendError(errorType: AppErrorType, message: string): string {
  const prefixMap: Record<AppErrorType, string> = {
    Io: 'File operation error',
    Json: 'Data format error',
    Sidecar: 'Background service error',
    Api: 'API error',
    Storage: 'Storage error',
    Validation: 'Validation error',
    Config: 'Configuration error',
    Keyring: 'Credential error',
    Serialization: 'Data processing error',
  };

  return `${prefixMap[errorType]}: ${message}`;
}
