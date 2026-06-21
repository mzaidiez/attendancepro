import { Student, SpreadsheetInfo } from '../types';

/**
 * Fetch spreadsheets belonging to the user from Google Drive
 */
export async function fetchSpreadsheets(token: string): Promise<SpreadsheetInfo[]> {
  try {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.append('q', "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    url.searchParams.append('fields', 'files(id, name, webViewLink)');
    url.searchParams.append('orderBy', 'name');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`failed_fetch_drive: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error('Error fetching spreadsheets from Google Drive:', error);
    throw error;
  }
}

/**
 * Fetch a single spreadsheet by ID to retrieve its metadata
 */
export async function fetchSpreadsheetMetadata(token: string, spreadsheetId: string): Promise<SpreadsheetInfo> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`failed_fetch_metadata: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    return {
      id: spreadsheetId,
      name: data.properties?.title || 'Linked Google Sheet',
      webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    };
  } catch (error) {
    console.error('Error fetching spreadsheet metadata:', error);
    throw error;
  }
}

/**
 * Create a new spreadsheet with the designated title
 */
export async function createSpreadsheet(token: string, title: string): Promise<SpreadsheetInfo> {
  try {
    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`failed_create_sheet: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    return {
      id: data.spreadsheetId,
      name: data.properties.title,
      webViewLink: data.spreadsheetUrl,
    };
  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    throw error;
  }
}

/**
 * Setup default attendance header structures in a fresh Sheet
 */
export async function writeDefaultRoster(
  token: string, 
  spreadsheetId: string, 
  students: Student[]
): Promise<void> {
  try {
    // Write headers: A1 = "Student Name", B1 = "Email", C1 = "Attendance Demo Date"
    const headerRow = ['Student Name', 'Email', 'Session Status'];
    const rows = [headerRow];
    
    students.forEach(student => {
      rows.push([student.name, student.email || '', 'Not Taken']);
    });

    const range = 'Sheet1!A1:C' + (students.length + 1);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`failed_sheet_write: ${res.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('Error writing default roster:', error);
    throw error;
  }
}

/**
 * Fetch values from a spreadsheet
 */
export async function readSpreadsheetValues(
  token: string,
  spreadsheetId: string,
  range: string = 'Sheet1!A1:Z500'
): Promise<string[][] | null> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      // If the sheet name doesn't match default or range isn't valid, return null
      return null;
    }

    const data = await res.json();
    return data.values || null;
  } catch (error) {
    console.error('Error reading spreadsheet values:', error);
    return null;
  }
}

/**
 * Dynamic Synchronizer: Reads first, then intelligently maps student names and updates/creates the date column
 */
export async function syncAttendanceData(
  token: string,
  spreadsheetId: string,
  dateString: string,
  studentStatusList: Student[]
): Promise<void> {
  try {
    // 1. Read existing grid
    const existingValues = await readSpreadsheetValues(token, spreadsheetId, 'Sheet1!A1:Z500');
    
    // Default matrix if sheet is completely empty
    let matrix: string[][] = [];
    if (existingValues && existingValues.length > 0) {
      // clone to avoid side effects
      matrix = existingValues.map(row => [...row]);
    }

    if (matrix.length === 0) {
      // If completely empty, make standard columns
      const headers = ['Student Name', 'Email', dateString];
      matrix.push(headers);
      studentStatusList.forEach(student => {
        matrix.push([student.name, student.email || '', student.attendance]);
      });
    } else {
      // Matrix has data. Let's find/align headers
      const headers = matrix[0];
      
      // We assume column 0 is "Student Name" or similar, column 1 is "Email" or similar
      // Let's locate or add the date column
      let dateColIndex = headers.indexOf(dateString);
      if (dateColIndex === -1) {
        // Date column not found. Append to headers.
        headers.push(dateString);
        dateColIndex = headers.length - 1;
      }

      // Pad all rows to match columns length
      matrix.forEach((row, idx) => {
        if (idx > 0) {
          while (row.length < headers.length) {
            row.push('');
          }
        }
      });

      // Map existing students or insert new ones
      studentStatusList.forEach(student => {
        // Find existing student by name (case insensitive)
        let foundRowIndex = -1;
        for (let i = 1; i < matrix.length; i++) {
          const row = matrix[i];
          if (row[0] && row[0].trim().toLowerCase() === student.name.trim().toLowerCase()) {
            foundRowIndex = i;
            break;
          }
        }

        if (foundRowIndex !== -1) {
          // Update the specific cell at dateColIndex
          matrix[foundRowIndex][dateColIndex] = student.attendance;
          // Also sync email if not existing in cell 1
          if (!matrix[foundRowIndex][1] && student.email) {
            matrix[foundRowIndex][1] = student.email;
          }
        } else {
          // Student not in sheet. Create a new row for them!
          const newRow = new Array(headers.length).fill('');
          newRow[0] = student.name;
          newRow[1] = student.email || '';
          newRow[dateColIndex] = student.attendance;
          matrix.push(newRow);
        }
      });
    }

    // 2. Write the computed grid back to the spreadsheet
    const totalCols = matrix[0].length;
    const totalRows = matrix.length;
    
    // Define write range matching our matrix bounds (e.g. Sheet1!A1:D15)
    // Convert column number to letters (1=A, 2=B, etc.)
    const colLetter = getColumnLetter(totalCols);
    const range = `Sheet1!A1:${colLetter}${totalRows}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: matrix,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`failed_sheet_write: ${res.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('Error syncing attendance data:', error);
    throw error;
  }
}

/**
 * Converts index to spreadsheet column string letter (e.g. 1 -> A, 27 -> AA)
 */
function getColumnLetter(colNum: number): string {
  let letter = '';
  let temp = colNum;
  while (temp > 0) {
    const modulo = (temp - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    temp = Math.floor((temp - modulo) / 26);
  }
  return letter;
}
