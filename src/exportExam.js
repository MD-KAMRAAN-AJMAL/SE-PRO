/**
 * exportExam.js - Exports exam schedule to Excel using ExcelJS
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs-extra');

/**
 * Export exam schedule to Excel
 * @param {Array} examEntries - Exam entries from generateExamSchedule
 * @param {string} outputPath - Path to save the Excel file
 * @returns {Promise<string>} Path to saved file
 */
async function exportExamSchedule(examEntries, outputPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Exam Scheduler';
  workbook.created = new Date();

  // Get unique dates sorted
  const dates = [...new Set(examEntries.map(e => e.date))].sort();

  // ========== Sheet 1: Schedule Grid ==========
  const gridSheet = workbook.addWorksheet('Schedule Grid');

  // Header row
  gridSheet.getRow(1).values = ['Date', 'Morning (9:00-12:00)', 'Afternoon (2:00-5:00)'];
  gridSheet.getRow(1).font = { bold: true };
  gridSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  gridSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Set column widths
  gridSheet.getColumn(1).width = 15;
  gridSheet.getColumn(2).width = 40;
  gridSheet.getColumn(3).width = 40;

  // Fill in dates and exams
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const row = gridSheet.getRow(i + 2);
    const dateExams = examEntries.filter(e => e.date === date);

    row.values = [
      date,
      dateExams.filter(e => e.slot === 1).map(e => e.course_code).join(', '),
      dateExams.filter(e => e.slot === 2).map(e => e.course_code).join(', ')
    ];

    row.alignment = { vertical: 'middle', horizontal: 'left' };

    // Alternate row colors
    const isEven = (i + 2) % 2 === 0;
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? 'FFF0F0F0' : 'FFFFFFFF' }
    };

    // Borders
    for (let col = 1; col <= 3; col++) {
      row.getCell(col).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  }

  // Freeze header row
  gridSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ========== Sheet 2: Detailed List ==========
  const detailSheet = workbook.addWorksheet('Detailed List');

  // Header row
  detailSheet.getRow(1).values = ['Date', 'Slot', 'Course Code', 'Course Name', 'Sections', 'Rooms', 'Invigilators'];
  detailSheet.getRow(1).font = { bold: true };
  detailSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  detailSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Set column widths
  detailSheet.getColumn(1).width = 15;
  detailSheet.getColumn(2).width = 10;
  detailSheet.getColumn(3).width = 15;
  detailSheet.getColumn(4).width = 30;
  detailSheet.getColumn(5).width = 20;
  detailSheet.getColumn(6).width = 20;
  detailSheet.getColumn(7).width = 30;

  // Fill in exam entries
  for (let i = 0; i < examEntries.length; i++) {
    const exam = examEntries[i];
    const row = detailSheet.getRow(i + 2);

    const invigilatorNames = exam.invigilators
      ? exam.invigilators.map(inv => inv.name || inv.faculty_id).join(', ')
      : '';

    row.values = [
      exam.date,
      exam.slot === 1 ? 'Morning' : 'Afternoon',
      exam.course_code,
      exam.course_name,
      exam.sections.join(', '),
      exam.rooms.join(', '),
      invigilatorNames
    ];

    row.alignment = { vertical: 'middle', horizontal: 'left' };

    // Alternate row colors
    const isEven = (i + 2) % 2 === 0;
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? 'FFF0F0F0' : 'FFFFFFFF' }
    };

    // Borders
    for (let col = 1; col <= 7; col++) {
      row.getCell(col).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  }

  // Freeze header row
  detailSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ========== Sheet 3: Course Legend ==========
  const legendSheet = workbook.addWorksheet('Course Legend');

  // Build course info map
  const courseMap = new Map();
  for (const exam of examEntries) {
    if (!courseMap.has(exam.course_code)) {
      courseMap.set(exam.course_code, {
        course_code: exam.course_code,
        course_name: exam.course_name,
        sections: new Set(),
        totalStrength: 0,
        roomsNeeded: new Set()
      });
    }
    const course = courseMap.get(exam.course_code);
    exam.sections.forEach(s => course.sections.add(s));
    exam.rooms.forEach(r => course.roomsNeeded.add(r));
  }

  // Header row
  legendSheet.getRow(1).values = ['Course Code', 'Full Name', 'Sections', 'Total Strength', 'Rooms Used'];
  legendSheet.getRow(1).font = { bold: true };
  legendSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  legendSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Set column widths
  legendSheet.getColumn(1).width = 15;
  legendSheet.getColumn(2).width = 35;
  legendSheet.getColumn(3).width = 20;
  legendSheet.getColumn(4).width = 15;
  legendSheet.getColumn(5).width = 20;

  // Fill in course info
  let rowIdx = 2;
  for (const course of courseMap.values()) {
    const row = legendSheet.getRow(rowIdx);
    row.values = [
      course.course_code,
      course.course_name,
      Array.from(course.sections).join(', '),
      course.totalStrength || 'N/A',
      Array.from(course.roomsNeeded).join(', ')
    ];

    row.alignment = { vertical: 'middle', horizontal: 'left' };

    // Alternate row colors
    const isEven = rowIdx % 2 === 0;
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? 'FFF0F0F0' : 'FFFFFFFF' }
    };

    // Borders
    for (let col = 1; col <= 5; col++) {
      row.getCell(col).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }

    rowIdx++;
  }

  // Freeze header row
  legendSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Ensure output directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Write the file
  await workbook.xlsx.writeFile(outputPath);

  return outputPath;
}

module.exports = {
  exportExamSchedule
};

// Test code
if (require.main === module) {
  console.log('=== Export Exam Schedule Test ===\n');

  const { generateExamSchedule } = require('./exam');
  const { loadRooms, loadFaculty, loadTimeSlots, loadAllCourses } = require('./dataLoader');

  (async () => {
    try {
      const rooms = await loadRooms();
      const faculty = await loadFaculty();
      const timeSlots = await loadTimeSlots();
      const courses = await loadAllCourses();

      console.log('Generating exam schedule...');
      const config = {
        startDate: '2025-11-01',
        daysAvailable: 14,
        slotsPerDay: 2
      };

      const schedule = generateExamSchedule(courses, rooms, config);
      console.log(`Generated ${schedule.length} exam entries`);

      const outputPath = path.join(__dirname, '..', 'outputs', 'ExamSchedule.xlsx');
      console.log(`\nExporting to ${outputPath}...`);

      await exportExamSchedule(schedule, outputPath);

      console.log('✓ Excel file created successfully!');
      console.log(`  Location: ${outputPath}`);
    } catch (error) {
      console.error('Error:', error.message);
      console.error(error.stack);
    }
  })();
}
