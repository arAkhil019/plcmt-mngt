// utils/ipUtils.js

// Function to get client IP address
export async function getClientIP() {
  try {
    // Try multiple IP detection services in order of preference
    const ipServices = [
      'https://api.ipify.org?format=json',
      'https://ipapi.co/json/',
      'https://httpbin.org/ip'
    ];

    for (const service of ipServices) {
      try {
        const response = await fetch(service, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          
          // Handle different response formats
          if (data.ip) {
            return data.ip;
          } else if (data.origin) {
            return data.origin;
          } else if (data.query) {
            return data.query;
          }
        }
      } catch (error) {
        console.warn(`Failed to get IP from ${service}:`, error.message);
        continue;
      }
    }

    // Fallback: try to get from headers (if available)
    return getIPFromHeaders();
  } catch (error) {
    console.error('Error getting client IP:', error);
    return 'Unknown';
  }
}

// Try to get IP from request headers (for server-side)
function getIPFromHeaders() {
  try {
    // This will work in server-side environments
    if (typeof window === 'undefined') {
      // Server-side detection would be implemented here
      return 'Server-side detection needed';
    }
    
    // For client-side, we can't directly access headers
    return 'Client-side';
  } catch (error) {
    return 'Unknown';
  }
}

// Enhanced logging function that includes IP address
export async function logActivityWithIP(userId, userName, userEmail, action, details, metadata = {}) {
  try {
    const ipAddress = await getClientIP();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    
    const enhancedMetadata = {
      ...metadata,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
      clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'Unknown'
    };

    // Import the logging function dynamically to avoid circular dependencies
    const { logActivity } = await import('./activityLogger');
    
    return await logActivity(userId, userName, userEmail, action, details, enhancedMetadata);
  } catch (error) {
    console.error('Error logging activity with IP:', error);
    // Fallback to regular logging without IP
    try {
      const { logActivity } = await import('./activityLogger');
      return await logActivity(userId, userName, userEmail, action, details, metadata);
    } catch (fallbackError) {
      console.error('Fallback logging also failed:', fallbackError);
    }
  }
}
