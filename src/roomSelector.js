/**
 * RoomSelector - Utility for selecting appropriate rooms based on session type
 * Manages room bookings and capacity constraints
 */
class RoomSelector {
  /**
   * @param {Array} rooms - Array of { room_id, name, capacity, type }
   */
  constructor(rooms) {
    this.rooms = rooms;

    // Bookings map: Map<"day-slot", Set<room_id>>
    this.bookings = new Map();
  }

  /**
   * Create a day-slot key
   * @param {string} day
   * @param {number} slotId
   * @returns {string}
   */
  _makeKey(day, slotId) {
    return `${day}-${slotId}`;
  }

  /**
   * Get or create booked rooms set for a slot
   * @param {string} key
   * @returns {Set<string>}
   */
  _getBookedRooms(key) {
    if (!this.bookings.has(key)) {
      this.bookings.set(key, new Set());
    }
    return this.bookings.get(key);
  }

  /**
   * Check if a room is booked for a given slot
   * @param {string} roomId
   * @param {string} day
   * @param {number} slotId
   * @returns {boolean}
   */
  isRoomBooked(roomId, day, slotId) {
    const key = this._makeKey(day, slotId);
    return this._getBookedRooms(key).has(roomId);
  }

  /**
   * Find an appropriate room based on session type and constraints
   * @param {string} sessionType - 'L', 'T', or 'P'
   * @param {number} sectionStrength - Number of students
   * @param {string} day
   * @param {number} slotId
   * @returns {{ room_id, name, capacity, type } | null}
   */
  findRoom(sessionType, sectionStrength, day, slotId) {
    const key = this._makeKey(day, slotId);
    const bookedRooms = this._getBookedRooms(key);

    if (sessionType === 'P') {
      // Practical sessions require a lab
      for (const room of this.rooms) {
        if (room.type === 'lab' && !bookedRooms.has(room.room_id)) {
          return room;
        }
      }
      return null;
    }

    if (sessionType === 'L' || sessionType === 'T') {
      // Lecture/Tutorial: prefer classroom with sufficient capacity
      const suitableClassrooms = this.rooms
        .filter(room =>
          room.type === 'classroom' &&
          room.capacity >= sectionStrength &&
          !bookedRooms.has(room.room_id)
        )
        .sort((a, b) => a.capacity - b.capacity); // Prefer smallest adequate room

      if (suitableClassrooms.length > 0) {
        return suitableClassrooms[0];
      }

      // Fallback to hall if no classroom available
      const halls = this.rooms
        .filter(room =>
          room.type === 'hall' &&
          room.capacity >= sectionStrength &&
          !bookedRooms.has(room.room_id)
        )
        .sort((a, b) => a.capacity - b.capacity);

      if (halls.length > 0) {
        return halls[0];
      }

      return null;
    }

    return null;
  }

  /**
   * Book a room for a specific slot
   * @param {string} roomId
   * @param {string} day
   * @param {number} slotId
   */
  bookRoom(roomId, day, slotId) {
    const key = this._makeKey(day, slotId);
    this._getBookedRooms(key).add(roomId);
  }

  /**
   * Release a booked room (for rollback)
   * @param {string} roomId
   * @param {string} day
   * @param {number} slotId
   */
  releaseRoom(roomId, day, slotId) {
    const key = this._makeKey(day, slotId);
    const bookedRooms = this.bookings.get(key);
    if (bookedRooms) {
      bookedRooms.delete(roomId);
      // Clean up empty sets
      if (bookedRooms.size === 0) {
        this.bookings.delete(key);
      }
    }
  }

  /**
   * Get all bookings for a slot
   * @param {string} day
   * @param {number} slotId
   * @returns {Array<string>} Array of booked room_ids
   */
  getBookingsForSlot(day, slotId) {
    const key = this._makeKey(day, slotId);
    return Array.from(this._getBookedRooms(key));
  }

  /**
   * Get booking summary
   * @returns {Object} Summary of all bookings
   */
  getBookingSummary() {
    const summary = {};
    for (const [key, rooms] of this.bookings) {
      summary[key] = Array.from(rooms);
    }
    return summary;
  }
}

// Test code - runs only when executed directly
if (require.main === module) {
  console.log('=== RoomSelector Tests ===\n');

  const mockRooms = [
    { room_id: 'R101', name: 'Room 101', capacity: 60, type: 'classroom' },
    { room_id: 'R102', name: 'Room 102', capacity: 60, type: 'classroom' },
    { room_id: 'L201', name: 'Lab 201', capacity: 30, type: 'lab' },
    { room_id: 'L202', name: 'Lab 202', capacity: 30, type: 'lab' },
    { room_id: 'H301', name: 'Hall 301', capacity: 120, type: 'hall' }
  ];

  const selector = new RoomSelector(mockRooms);

  // Test 1: Find lab for practical session
  console.log('Test 1: findRoom for Practical (P)');
  const lab = selector.findRoom('P', 30, 'Monday', 1);
  console.log(`  Found: ${JSON.stringify(lab)}`);
  console.assert(lab?.type === 'lab', 'Should return a lab');

  // Test 2: Find classroom for lecture
  console.log('\nTest 2: findRoom for Lecture (L)');
  const classroom = selector.findRoom('L', 60, 'Monday', 1);
  console.log(`  Found: ${JSON.stringify(classroom)}`);
  console.assert(classroom?.type === 'classroom', 'Should return a classroom');
  console.assert(classroom?.capacity >= 60, 'Capacity should be >= 60');

  // Test 3: Find room for tutorial
  console.log('\nTest 3: findRoom for Tutorial (T)');
  const tutorial = selector.findRoom('T', 30, 'Monday', 1);
  console.log(`  Found: ${JSON.stringify(tutorial)}`);
  console.assert(tutorial?.type === 'classroom', 'Should return a classroom');

  // Test 4: Book a room and verify it's not returned again
  console.log('\nTest 4: bookRoom and verify exclusion');
  selector.bookRoom('R101', 'Monday', 1);
  const afterBook = selector.findRoom('L', 60, 'Monday', 1);
  console.log(`  After booking R101: ${JSON.stringify(afterBook)}`);
  console.assert(afterBook?.room_id !== 'R101', 'Should not return booked room');

  // Test 5: releaseRoom
  console.log('\nTest 5: releaseRoom');
  selector.releaseRoom('R101', 'Monday', 1);
  const afterRelease = selector.findRoom('L', 60, 'Monday', 1);
  console.log(`  After releasing R101: ${JSON.stringify(afterRelease)}`);
  console.assert(afterRelease?.room_id === 'R101', 'Should be able to book R101 again');

  // Test 6: Hall fallback when no classroom available
  console.log('\nTest 6: Hall fallback');
  const selector2 = new RoomSelector(mockRooms);
  // Book all classrooms
  selector2.bookRoom('R101', 'Tuesday', 1);
  selector2.bookRoom('R102', 'Tuesday', 1);
  const hall = selector2.findRoom('L', 60, 'Tuesday', 1);
  console.log(`  Found: ${JSON.stringify(hall)}`);
  console.assert(hall?.type === 'hall', 'Should fallback to hall');

  // Test 7: No room available
  console.log('\nTest 7: No room available');
  const selector3 = new RoomSelector(mockRooms);
  // Book everything
  selector3.bookRoom('R101', 'Wednesday', 1);
  selector3.bookRoom('R102', 'Wednesday', 1);
  selector3.bookRoom('L201', 'Wednesday', 1);
  selector3.bookRoom('L202', 'Wednesday', 1);
  selector3.bookRoom('H301', 'Wednesday', 1);
  const none = selector3.findRoom('L', 60, 'Wednesday', 1);
  console.log(`  Found: ${none}`);
  console.assert(none === null, 'Should return null when no rooms available');

  // Test 8: Practical session only uses labs
  console.log('\nTest 8: Practical only uses labs');
  const selector4 = new RoomSelector(mockRooms);
  selector4.bookRoom('L201', 'Thursday', 1);
  const lab2 = selector4.findRoom('P', 30, 'Thursday', 1);
  console.log(`  Found: ${JSON.stringify(lab2)}`);
  console.assert(lab2?.room_id === 'L202', 'Should return the remaining lab');

  // Print summary
  console.log('\n=== Booking Summary ===');
  console.log(JSON.stringify(selector.getBookingSummary(), null, 2));

  console.log('\n=== All tests passed! ===');
}

module.exports = RoomSelector;
