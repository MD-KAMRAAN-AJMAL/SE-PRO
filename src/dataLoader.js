const fs = require('fs-extra');
const csv = require('csv-parser');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Parse rooms.csv
 * @returns {Promise<Array>} Array of room objects
 */
async function loadRooms() {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(path.join(DATA_DIR, 'rooms.csv'))
      .pipe(csv())
      .on('data', (row) => {
        results.push({
          room_id: row.room_id,
          name: row.name,
          capacity: parseInt(row.capacity, 10),
          type: row.type
        });
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * Parse faculty.csv
 * @returns {Promise<Array>} Array of faculty objects
 */
async function loadFaculty() {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(path.join(DATA_DIR, 'faculty.csv'))
      .pipe(csv())
      .on('data', (row) => {
        results.push({
          faculty_id: row.faculty_id,
          name: row.name,
          email: row.email,
          department: row.department
        });
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * Read time_slots.json
 * @returns {Promise<Object>} { days, slots, breakSlots }
 */
async function loadTimeSlots() {
  const data = await fs.readJson(path.join(DATA_DIR, 'time_slots.json'));
  const slots = data.slots.filter(slot => !slot.is_break);
  const breakSlots = data.slots.filter(slot => slot.is_break === true);
  return {
    days: data.days,
    slots,
    breakSlots
  };
}

/**
 * Parse a courses CSV file
 * @param {string} filename - Name of the CSV file in /data/
 * @returns {Promise<Array>} Array of course objects
 */
async function loadCourses(filename) {
  return new Promise((resolve, reject) => {
    const results = [];
    const filePath = path.join(DATA_DIR, filename);

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        results.push({
          course_code: row.course_code,
          name: row.name,
          faculty_id: row.faculty_id,
          L: parseInt(row.L, 10),
          T: parseInt(row.T, 10),
          P: parseInt(row.P, 10),
          S: parseInt(row.S, 10),
          C: parseInt(row.C, 10),
          section: row.section,
          is_elective: row.is_elective === 'true',
          section_strength: parseInt(row.section_strength, 10)
        });
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * Load all course files matching courses_*.csv
 * @returns {Promise<Array>} Flat array of all courses
 */
async function loadAllCourses() {
  const files = await fs.readdir(DATA_DIR);
  const courseFiles = files.filter(f => f.startsWith('courses_') && f.endsWith('.csv'));

  const allCourses = [];
  for (const file of courseFiles) {
    const courses = await loadCourses(file);
    allCourses.push(...courses);
  }
  return allCourses;
}

module.exports = {
  loadRooms,
  loadFaculty,
  loadTimeSlots,
  loadCourses,
  loadAllCourses
};
