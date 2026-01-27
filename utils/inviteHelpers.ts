// Utility function to calculate time remaining until expiry
export const getTimeUntilExpiry = (expiryDate: string): { 
  hours: number; 
  isExpiringSoon: boolean; 
  isExpired: boolean;
  displayText: string;
} => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  
  const isExpired = diffMs < 0;
  const isExpiringSoon = hours < 24 && hours >= 0;
  
  let displayText = '';
  if (isExpired) {
    displayText = 'Expired';
  } else if (hours < 1) {
    const minutes = Math.floor(diffMs / (1000 * 60));
    displayText = `Expires in ${minutes}m`;
  } else if (hours < 24) {
    displayText = `Expires in ${hours}h`;
  } else {
    const days = Math.floor(hours / 24);
    displayText = `Expires in ${days}d`;
  }
  
  return { hours, isExpiringSoon, isExpired, displayText };
};

// Format date for display
export const formatInviteDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
