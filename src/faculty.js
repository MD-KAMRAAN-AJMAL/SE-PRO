/**
 * faculty.js - Extract faculty-specific timetables from main timetable
 */

/**
 * Extract faculty timetables from timetable entries
 * @param {Array} timetableEntries - Entries from generateTimetable
 * @param {Array} facultyList - Faculty from dataLoader
 * @returns {Map<string, Object>} Map<faculty_id, { info, grid, totalClasses }>
 */
function extractFacultyTimetables(timetableEntries, facultyList) {
  const facultyMap = new Map();

  // Build faculty info lookup
  const facultyInfo = new Map();
  for (const f of facultyList) {
    facultyInfo.set(f.faculty_id, {
      faculty_id: f.faculty_id,
      name: f.name,
      email: f.email,
      department: f.department
    });
  }

  // Group entries by faculty
  const entriesByFaculty = new Map();
  for (const entry of timetableEntries) {
    if (!entriesByFaculty.has(entry.faculty_id)) {
      entriesByFaculty.set(entry.faculty_id, []);
    }
    entriesByFaculty.get(entry.faculty_id).push(entry);
  }

  // Build grid for each faculty
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  for (const [facultyId, entries] of entriesByFaculty) {
    const info = facultyInfo.get(facultyId) || {
      faculty_id: facultyId,
      name: 'Unknown',
      email: 'Unknown',
      department: 'Unknown'
    };

    // Initialize grid
    const grid = {};
    for (const day of days) {
      grid[day] = {};
    }

    // Fill grid with entries
    for (const entry of entries) {
      const { day, slot_id, course_code, section, room_name, type } = entry;

      // Handle single slot or multiple slots (labs)
      const slots = Array.isArray(slot_id) ? slot_id : [slot_id];

      for (const slot of slots) {
        if (!grid[day]) grid[day] = {};
        grid[day][slot] = {
          course_code,
          section,
          room_name,
          type
        };
      }
    }

    // Count total classes (each entry is a class session)
    const totalClasses = entries.length;

    facultyMap.set(facultyId, {
      info,
      grid,
      totalClasses
    });
  }

  return facultyMap;
}

module.exports = {
  extractFacultyTimetables
};

// Test code
if (require.main === module) {
  console.log('=== Faculty Timetable Extractor Tests ===\n');

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

      console.log('\nExtracting faculty timetables...');
      const facultyTimetables = extractFacultyTimetables(timetable, faculty);

      console.log(`\nFound ${facultyTimetables.size} faculty with classes:\n`);

      for (const [facultyId, data] of facultyTimetables) {
        console.log(`${data.info.name} (${facultyId}):`);
        console.log(`  Email: ${data.info.email}`);
        console.log(`  Department: ${data.info.department}`);
        console.log(`  Total Classes: ${data.totalClasses}`);
        console.log(`  Grid days: ${Object.keys(data.grid).join(', ')}`);

        // Show Monday schedule as sample
        if (data.grid.Monday && Object.keys(data.grid.Monday).length > 0) {
          console.log('  Monday schedule:');
          for (const [slot, info] of Object.entries(data.grid.Monday)) {
            console.log(`    Slot ${slot}: ${info.course_code} (${info.section}) - ${info.room_name} [${info.type}]`);
          }
        }
        console.log();
      }

      console.log('=== All tests complete! ===');
    } catch (error) {
      console.error('Error:', error.message);
      console.error(error.stack);
    }
  })();
}
