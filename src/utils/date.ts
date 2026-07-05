/**
 * Utility functions for date calculations
 */

export function calculateDaysBetween(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }
  
  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) return 0;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function parseWarrantyPeriodToMonths(periodStr: string): number {
  const normalized = periodStr.toLowerCase().trim();
  
  // Try to match "N year(s)" or "N ปี"
  const yearMatch = normalized.match(/(\d+)\s*(year|yr|ปี)/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10) * 12;
  }
  
  // Try to match "N month(s)" or "N เดือน"
  const monthMatch = normalized.match(/(\d+)\s*(month|mo|mth|เดือน)/);
  if (monthMatch) {
    return parseInt(monthMatch[1], 10);
  }
  
  // Fallback to integer parses if it's just a number (assume months or years?)
  const numOnly = parseInt(normalized, 10);
  if (!isNaN(numOnly)) {
    // If number is <= 5, probably years, else months
    return numOnly <= 5 ? numOnly * 12 : numOnly;
  }
  
  return 12; // default to 1 year
}

export function calculateRemainingWarranty(purchaseDateStr: string, periodStr: string): {
  daysRemaining: number;
  text: string;
  isExpired: boolean;
} {
  if (!purchaseDateStr || !periodStr) {
    return { daysRemaining: 0, text: "ไม่มีข้อมูลประกัน", isExpired: true };
  }

  const purchaseDate = new Date(purchaseDateStr);
  if (isNaN(purchaseDate.getTime())) {
    return { daysRemaining: 0, text: "รูปแบบวันที่ไม่ถูกต้อง", isExpired: true };
  }

  const months = parseWarrantyPeriodToMonths(periodStr);
  
  // Calculate warranty end date
  const endDate = new Date(purchaseDate);
  endDate.setMonth(endDate.getMonth() + months);
  
  const today = new Date();
  // Clear time components for comparison
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  const diffTime = endDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const formattedEndDate = endDate.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  if (daysRemaining < 0) {
    return {
      daysRemaining,
      text: `หมดอายุประกันแล้ว (สิ้นสุด ${formattedEndDate})`,
      isExpired: true
    };
  }

  return {
    daysRemaining,
    text: `เหลือประกันอีก ${daysRemaining} วัน (สิ้นสุด ${formattedEndDate})`,
    isExpired: false
  };
}

export function isJobOverdue(assignedDateStr: string, status: string, closeDateStr?: string): boolean {
  if (!assignedDateStr) return false;
  
  const assigned = new Date(assignedDateStr);
  if (isNaN(assigned.getTime())) return false;
  
  // If the job is completed, compare with closeDate. Otherwise, compare with today's date.
  const end = (status === 'Completed' && closeDateStr) ? new Date(closeDateStr) : new Date();
  if (isNaN(end.getTime())) return false;
  
  assigned.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - assigned.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 30;
}

export function isClaimOverdue(receivedDateStr: string, status: string, daysLimit = 30): boolean {
  if (!receivedDateStr || status === 'Completed') return false;
  
  const received = new Date(receivedDateStr);
  if (isNaN(received.getTime())) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  received.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - received.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > daysLimit;
}
