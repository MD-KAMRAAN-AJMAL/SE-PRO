/**
 * exportTimetable.js - Exports timetable to Excel using ExcelJS
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs-extra');

// Preset palette of 15 colors for courses
const COLOR_PALETTE = [
  'FFB3BA', // Light pink
  'FFDFBA', // Light peach
  'FFFFBA', // Light yellow
  'BAFFCB', // Light green
  'BAE1FF', // Light blue
  'E2BAFF', // Light purple
  'FFBAE1', // Light magenta
  'FFA07A', // Light salmon
  '98FB98', // Pale green
  '87CEEB', // Sky blue
  'DDA0DD', // Plum
  'F0E68C', // Khaki
  'FFD700', // Gold
  'FF6347', // Tomato
  '9370DB'  // Medium purple
];

/**
 * Generate a consistent color for a course code
 * @param {string} courseCode
 * @returns {string} Hex color code
 */
function getColorForCourse(courseCode) {
  // Use hash of course code to pick consistent color
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
}

/**
 * Export timetable entries to Excel
 * @param {Array} entries - Timetable entries from generateTimetable
 * @param {Object} timeSlots - Time slots config
 * @param {string} outputPath - Path to save the Excel file
 * @returns {Promise<string>} Path to saved file
 */
async function exportTimetable(entries, timeSlots, outputPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Timetable Generator';
  workbook.created = new Date();

  // Get unique sections
  const sections = [...new Set(entries.map(e => e.section))].sort();

  // Get slot labels (only non-break slots)
  const slotLabels = timeSlots.slots.map(s => s.label);
  const slotIds = timeSlots.slots.map(s => s.id);

  // Days in order
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Create a sheet for each section
  for (const section of sections) {
    const sheet = workbook.addWorksheet(section);

    // Set up header row
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
      row.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }

    // Filter entries for this section
    const sectionEntries = entries.filter(e => e.section === section);

    // Track which cells are filled (for lab merging)
    const filledCells = new Set();

    // Fill in the timetable
    for (const entry of sectionEntries) {
      const dayIndex = days.indexOf(entry.day);
      if (dayIndex === -1) continue;

      const row = dayIndex + 2;

      // Handle single slot or multiple slots (lab)
      const slots = Array.isArray(entry.slot_id) ? entry.slot_id : [entry.slot_id];

      for (let i = 0; i < slots.length; i++) {
        const slotId = slots[i];
        const slotIndex = slotIds.indexOf(slotId);
        if (slotIndex === -1) continue;

        const col = slotIndex + 2; // +2 because col 1 is day name
        const cellKey = `${row}-${col}`;

        if (filledCells.has(cellKey)) continue;

        const cell = sheet.getCell(row, col);
        cell.value = `${entry.course_code}\n${entry.faculty_id}\n${entry.room_name}`;

        // Apply color for this course
        const color = getColorForCourse(entry.course_code);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${color}` }
        };

        // If this is a lab (multiple slots), merge cells
        if (slots.length > 1 && i === 0) {
          const nextSlotIndex = slotIds.indexOf(slots[1]);
          if (nextSlotIndex === slotIndex + 1) {
            // Consecutive slots - merge
            sheet.mergeCells(row, col, row, col + 1);
            filledCells.add(`${row}-${col + 1}`);
          }
        }

        filledCells.add(cellKey);
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
    sheet.views = [
      {
        state: 'frozen',
        xSplit: 1,
        ySplit: 1
      }
    ];
  }

  // Create Legend sheet
  const legendSheet = workbook.addWorksheet('Legend');

  // Header
  legendSheet.getRow(1).values = ['Course Code', 'Course Name', 'Faculty', 'Sessions per week', 'Color'];
  legendSheet.getRow(1).font = { bold: true };
  legendSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  legendSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Get unique courses
  const courseMap = new Map();
  for (const entry of entries) {
    const key = entry.course_code;
    if (!courseMap.has(key)) {
      courseMap.set(key, {
        course_code: entry.course_code,
        course_name: entry.course_name,
        faculty_id: entry.faculty_id,
        sessions: 0,
        color: getColorForCourse(entry.course_code)
      });
    }
    courseMap.get(key).sessions += 1;
  }

  // Fill legend rows
  let rowIdx = 2;
  for (const course of courseMap.values()) {
    const row = legendSheet.getRow(rowIdx);
    row.values = [course.course_code, course.course_name, course.faculty_id, course.sessions, ''];

    // Add color indicator
    const colorCell = legendSheet.getCell(rowIdx, 5);
    colorCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${course.color}` }
    };

    rowIdx++;
  }

  // Set column widths for legend
  legendSheet.getColumn(1).width = 15;
  legendSheet.getColumn(2).width = 30;
  legendSheet.getColumn(3).width = 15;
  legendSheet.getColumn(4).width = 20;
  legendSheet.getColumn(5).width = 10;

  // Ensure output directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Write the file
  await workbook.xlsx.writeFile(outputPath);

  return outputPath;
}

module.exports = {
  exportTimetable
};

// Test code
if (require.main === module) {
  console.log('=== Export Timetable Test ===\n');

  const { generateTimetable } = require('./timetable');
  const { loadRooms, loadFaculty, loadTimeSlots, loadAllCourses } = require('./dataLoader');

  (async () => {
    try {
      const rooms = await loadRooms();
      const faculty = await loadFaculty();
      const timeSlots = await loadTimeSlots();
      const courses = await loadAllCourses();

      console.log('Generating timetable...');
      const timetable = generateTimetable(courses, rooms, timeSlots);

      console.log(`Generated ${timetable.length} entries`);

      const outputPath = path.join(__dirname, '..', 'outputs', 'Timetable.xlsx');
      console.log(`\nExporting to ${outputPath}...`);

      await exportTimetable(timetable, timeSlots, outputPath);

      console.log('✓ Excel file created successfully!');
      console.log(`  Location: ${outputPath}`);
    } catch (error) {
      console.error('Error:', error.message);
      console.error(error.stack);
    }
  })();
}
