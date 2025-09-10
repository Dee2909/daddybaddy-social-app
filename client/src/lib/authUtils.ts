export function isUnauthorizedError(error: any): boolean {
  if (!error) return false;
  
  // Check for 401 status code
  if (error.status === 401 || error.statusCode === 401) {
    return true;
  }
  
  // Check for 401 in message
  if (typeof error.message === 'string' && /^401: .*Unauthorized/.test(error.message)) {
    return true;
  }
  
  // Check for fetch response status
  if (error.response?.status === 401) {
    return true;
  }
  
  return false;
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  // Check for network-related error messages
  const networkErrorMessages = [
    'Network Error',
    'Failed to fetch',
    'Connection refused',
    'timeout',
    'ECONNREFUSED',
    'ENOTFOUND'
  ];
  
  const message = error.message?.toLowerCase() || '';
  return networkErrorMessages.some(msg => message.includes(msg.toLowerCase()));
}

export function getErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred';
  
  // Try to get a user-friendly message
  if (error.message) {
    return error.message;
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.statusText) {
    return error.statusText;
  }
  
  return 'An unexpected error occurred. Please try again.';
}