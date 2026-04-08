/**
 * exportFaculty.js - Exports faculty timetables to Excel using ExcelJS
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs-extra');

// Reuse same color palette as timetable export
const COLOR_PALETTE = [
  'FFB3BA', 'FFDFBA', 'FFFFBA', 'BAFFCB', 'BAE1FF',
  'E2BAFF', 'FFBAE1', 'FFA07A', '98FB98', '87CEEB',
  'DDA0DD', 'F0E68C', 'FFD700', 'FF6347', '9370DB'
];

/**
 * Generate a consistent color for a course code
 * @param {string} courseCode
 * @returns {string} Hex color code
 */
function getColorForCourse(courseCode) {
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
}

/**
 * Export faculty timetables to Excel
 * @param {Map<string, Object>} facultyMap - Map from extractFacultyTimetables
 * @param {Object} timeSlots - Time slots config
 * @param {string} outputPath - Path to save the Excel file
 * @returns {Promise<string>} Path to saved file
 */
async function exportFacultyTimetables(facultyMap, timeSlots, outputPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Faculty Timetable Generator';
  workbook.created = new Date();

  const slotLabels = timeSlots.slots.map(s => s.label);
  const slotIds = timeSlots.slots.map(s => s.id);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // ========== Sheet 0: Index ==========
  const indexSheet = workbook.addWorksheet('Index');

  // Header
  indexSheet.getRow(1).values = ['Faculty ID', 'Name', 'Email', 'Total Classes'];
  indexSheet.getRow(1).font = { bold: true };
  indexSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  indexSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Set column widths
  indexSheet.getColumn(1).width = 15;
  indexSheet.getColumn(2).width = 25;
  indexSheet.getColumn(3).width = 30;
  indexSheet.getColumn(4).width = 15;

  // Sort faculty by total classes descending
  const facultyList = Array.from(facultyMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.totalClasses - a.totalClasses);

  // Fill index rows
  for (let i = 0; i < facultyList.length; i++) {
    const f = facultyList[i];
    const row = indexSheet.getRow(i + 2);
    row.values = [f.id, f.info.name, f.info.email, f.totalClasses];
    row.alignment = { vertical: 'middle', horizontal: 'left' };

    // Borders
    for (let col = 1; col <= 4; col++) {
      row.getCell(col).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  }

  // Freeze header
  indexSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ========== One sheet per faculty ==========
  for (const f of facultyList) {
    // Sheet name (max 31 chars, sanitize special chars)
    let sheetName = f.info.name.replace(/[\\:*?\/[\]]/g, '').substring(0, 31);

    let sheet;
    try {
      sheet = workbook.addWorksheet(sheetName);
    } catch (e) {
      // Handle duplicate names
      sheetName = `${f.id} - ${f.info.name}`.replace(/[\\:*?\/[\]]/g, '').substring(0, 31);
      sheet = workbook.addWorksheet(sheetName);
    }

    // Header row
    sheet.getRow(1).values = ['Day \\ Slot', ...slotLabels];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Set column widths
    sheet.getColumn(1).width = 12;
    for (let i = 2; i <= slotLabels.length + 1; i++) {
      sheet.getColumn(i).width = 18;
    }

    // Create day rows
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const day = days[dayIndex];
      const row = sheet.getRow(dayIndex + 2);
      row.values = [day, ...Array(slotLabels.length).fill('')];
      row.alignment = { vertical: 'middle', horizontal: 'center' };

      // Fill cells with class info
      const dayGrid = f.grid[day] || {};
      for (let slotIndex = 0; slotIndex < slotLabels.length; slotIndex++) {
        const slotId = slotIds[slotIndex];
        const col = slotIndex + 2;

        if (dayGrid[slotId]) {
          const cell = sheet.getCell(row.number, col);
          const info = dayGrid[slotId];
          cell.value = `${info.course_code}\n${info.section}\n${info.room_name}`;

          // Color by course
          const color = getColorForCourse(info.course_code);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: `FF${color}` }
          };
        }
      }
    }

    // Apply borders to all cells
    for (let row = 1; row <= days.length + 1; row++) {
      for (let col = 1; col <= slotLabels.length + 1; col++) {
        const cell = sheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }

    // Freeze first row and first column
    sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  }

  // Ensure output directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Write the file
  await workbook.xlsx.writeFile(outputPath);

  return outputPath;
}

module.exports = {
  exportFacultyTimetables
};

// Test code
if (require.main === module) {
  console.log('=== Export Faculty Timetables Test ===\n');

  const { generateTimetable } = require('./timetable');
  const { loadRooms, loadFaculty, loadTimeSlots, loadAllCourses } = require('./dataLoader');
  const { extractFacultyTimetables } = require('./faculty');

  (async () => {
    try {
      const rooms = await loadRooms();
      const faculty = await loadFaculty();
      const timeSlots = await loadTimeSlots();
      const courses = await loadAllCourses();

      console.log('Generating timetable...');
      const timetable = generateTimetable(courses, rooms, timeSlots);
      console.log(`Generated ${timetable.length} entries`);

      console.log('\nExtracting faculty timetables...');
      const facultyMap = extractFacultyTimetables(timetable, faculty);
      console.log(`Found ${facultyMap.size} faculty`);

      const outputPath = path.join(__dirname, '..', 'outputs', 'FacultyTimetable.xlsx');
      console.log(`\nExporting to ${outputPath}...`);

      await exportFacultyTimetables(facultyMap, timeSlots, outputPath);

      console.log('✓ Excel file created successfully!');
      console.log(`  Location: ${outputPath}`);
    } catch (error) {
      console.error('Error:', error.message);
      console.error(error.stack);
    }
  })();
}
