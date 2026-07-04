/**
 * CSV Utility Helper for WSS_TechLink
 * Handles secure and robust parsing and generation of CSV files.
 */

// Safe CSV parser that handles quotes and commas
export function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Double quotes inside quotes means a single escaped quote
        currentValue += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      row.push(currentValue.trim());
      if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
        result.push(row);
      }
      row = [];
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  // Handle final value
  if (currentValue !== '' || row.length > 0) {
    row.push(currentValue.trim());
    result.push(row);
  }

  return result;
}

// Convert data rows to CSV string
export function generateCSV(headers: string[], data: Record<string, any>[], keys: string[]): string {
  const headerLine = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
  
  const contentLines = data.map(item => {
    return keys.map(key => {
      let value = item[key];
      if (value === undefined || value === null) {
        value = '';
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      } else {
        value = String(value);
      }
      return `"${value.replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headerLine, ...contentLines].join('\n');
}

// Download trigger helper for CSV/XLSX text
export function downloadFile(filename: string, content: string, contentType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: contentType }); // Add BOM for excel Thai characters support
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
