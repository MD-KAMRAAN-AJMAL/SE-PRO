/**
 * SlotAllocator - Core slot allocation engine for timetable generation
 * Manages booking state for faculty, sections, and rooms
 */
class SlotAllocator {
  /**
   * @param {Object} timeSlots - { days: string[], slots: {id, label}[], breakSlots: [] }
   */
  constructor(timeSlots) {
    this.days = timeSlots.days;
    this.slots = timeSlots.slots;
    this.breakSlotIds = new Set(
      (timeSlots.breakSlots || []).map(s => s.id)
    );

    // Booking maps: Map<key, Set<"day-slot">>
    this.facultyBookings = new Map();
    this.sectionBookings = new Map();
    this.roomBookings = new Map();
  }

  /**
   * Create a day-slot key for booking maps
   * @param {string} day
   * @param {number} slotId
   * @returns {string}
   */
  _makeKey(day, slotId) {
    return `${day}-${slotId}`;
  }

  /**
   * Get or create a Set for a given map and key
   * @param {Map} map
   * @param {string} key
   * @returns {Set<string>}
   */
  _getBookings(map, key) {
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    return map.get(key);
  }

  /**
   * Check if a slot is free for all three constraints
   * @param {string} facultyId
   * @param {string} section
   * @param {string} roomId
   * @param {string} day
   * @param {number} slotId
   * @returns {boolean} true if slot is free
   */
  isSlotFree(facultyId, section, roomId, day, slotId) {
    const key = this._makeKey(day, slotId);

    const facultyBusy = this._getBookings(this.facultyBookings, facultyId).has(key);
    const sectionBusy = this._getBookings(this.sectionBookings, section).has(key);
    const roomBusy = this._getBookings(this.roomBookings, roomId).has(key);

    return !facultyBusy && !sectionBusy && !roomBusy;
  }

  /**
   * Book a slot for faculty, section, and room
   * @param {string} facultyId
   * @param {string} section
   * @param {string} roomId
   * @param {string} day
   * @param {number} slotId
   */
  bookSlot(facultyId, section, roomId, day, slotId) {
    const key = this._makeKey(day, slotId);

    this._getBookings(this.facultyBookings, facultyId).add(key);
    this._getBookings(this.sectionBookings, section).add(key);
    this._getBookings(this.roomBookings, roomId).add(key);
  }

  /**
   * Find the first free slot for a given faculty and section
   * @param {string} facultyId
   * @param {string} section
   * @param {string} preferredRoomId - Room to check first (optional)
   * @returns {{day: string, slot: number, room_id: string} | null}
   */
  findFreeSlot(facultyId, section, preferredRoomId) {
    // Get all rooms from the roomBookings map keys
    const allRooms = Array.from(this.roomBookings.keys());

    // If preferred room exists and is not yet tracked, add it
    if (preferredRoomId && !this.roomBookings.has(preferredRoomId)) {
      allRooms.push(preferredRoomId);
    }

    // If no rooms tracked yet, we can't book - return null
    if (allRooms.length === 0) {
      return null;
    }

    // Try each day
    for (const day of this.days) {
      // Try each slot
      for (const slot of this.slots) {
        // Try preferred room first, then others
        const roomOrder = [preferredRoomId, ...allRooms.filter(r => r !== preferredRoomId)].filter(Boolean);

        for (const roomId of roomOrder) {
          if (this.isSlotFree(facultyId, section, roomId, day, slot.id)) {
            return {
              day,
              slot: slot.id,
              room_id: roomId
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Find consecutive free slots for lab sessions
   * @param {string} facultyId
   * @param {string} section
   * @param {string} roomId
   * @param {number} count - Number of consecutive slots needed
   * @returns {Array<{day: string, slot: number}> | null}
   */
  findContiguousSlots(facultyId, section, roomId, count) {
    // Sort slots by id to ensure sequential ordering
    const sortedSlots = [...this.slots].sort((a, b) => a.id - b.id);

    for (const day of this.days) {
      // Find sequences of consecutive non-break slots
      let sequence = [];

      for (const slot of sortedSlots) {
        // Skip break slots
        if (this.breakSlotIds.has(slot.id)) {
          sequence = [];
          continue;
        }

        const key = this._makeKey(day, slot.id);
        const isFree = this.isSlotFree(facultyId, section, roomId, day, slot.id);

        if (!isFree) {
          sequence = [];
          continue;
        }

        // Check if this slot is consecutive with the previous
        if (sequence.length === 0 || slot.id === sequence[sequence.length - 1].slot + 1) {
          sequence.push({ day, slot: slot.id });
        } else {
          // Not consecutive, start new sequence
          sequence = [{ day, slot: slot.id }];
        }

        if (sequence.length === count) {
          return sequence;
        }
      }
    }

    return null;
  }

  /**
   * Get booking summary for debugging
   * @returns {Object} Summary of all bookings
   */
  getBookingSummary() {
    return {
      facultyBookings: Object.fromEntries(
        Array.from(this.facultyBookings.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      sectionBookings: Object.fromEntries(
        Array.from(this.sectionBookings.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      roomBookings: Object.fromEntries(
        Array.from(this.roomBookings.entries()).map(([k, v]) => [k, Array.from(v)])
      )
    };
  }
}

// Test code - runs only when executed directly
if (require.main === module) {
  console.log('=== SlotAllocator Tests ===\n');

  const mockTimeSlots = {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    slots: [
      { id: 1, label: '8:00-8:55' },
      { id: 2, label: '9:00-9:55' },
      { id: 3, label: '10:00-10:55' },
      { id: 4, label: '11:00-11:55' },
      { id: 6, label: '1:00-1:55' },
      { id: 7, label: '2:00-2:55' },
      { id: 8, label: '3:00-3:55' }
    ],
    breakSlots: [{ id: 5, label: 'LUNCH', is_break: true }]
  };

  const allocator = new SlotAllocator(mockTimeSlots);

  // Initialize room bookings (simulate rooms from dataLoader)
  const rooms = ['R101', 'R102', 'L201', 'L202', 'H301'];
  rooms.forEach(r => {
    if (!allocator.roomBookings.has(r)) {
      allocator.roomBookings.set(r, new Set());
    }
  });

  // Test 1: Initial slot should be free
  console.log('Test 1: isSlotFree (initial)');
  const free1 = allocator.isSlotFree('F01', 'CSEA-I', 'R101', 'Monday', 1);
  console.log(`  Monday slot 1 free: ${free1} (expected: true)`);
  console.assert(free1 === true, 'Initial slot should be free');

  // Test 2: Book a slot
  console.log('\nTest 2: bookSlot');
  allocator.bookSlot('F01', 'CSEA-I', 'R101', 'Monday', 1);
  const busy1 = allocator.isSlotFree('F01', 'CSEA-I', 'R101', 'Monday', 1);
  console.log(`  Monday slot 1 free after booking: ${busy1} (expected: false)`);
  console.assert(busy1 === false, 'Booked slot should be busy');

  // Test 3: Same faculty busy, different section free
  console.log('\nTest 3: Faculty conflict');
  const facultyBusy = allocator.isSlotFree('F01', 'CSEB-I', 'R102', 'Monday', 1);
  const sectionFree = allocator.isSlotFree('F02', 'CSEA-I', 'R101', 'Monday', 1);
  console.log(`  F01 with CSEB-I: ${facultyBusy} (expected: false - faculty busy)`);
  console.log(`  F02 with CSEA-I: ${sectionFree} (expected: false - room busy)`);
  console.assert(facultyBusy === false, 'Faculty should be busy');
  console.assert(sectionFree === false, 'Room should be busy');

  // Test 4: findFreeSlot
  console.log('\nTest 4: findFreeSlot');
  const found = allocator.findFreeSlot('F01', 'CSEA-I', 'R101');
  console.log(`  Found slot: ${JSON.stringify(found)}`);
  console.log(`  Expected: Monday slot 2 or later (slot 1 is booked)`);
  console.assert(found !== null, 'Should find a free slot');
  console.assert(!(found.day === 'Monday' && found.slot === 1), 'Should not return booked slot');

  // Test 5: findContiguousSlots
  console.log('\nTest 5: findContiguousSlots (need 2 consecutive)');
  const contiguous = allocator.findContiguousSlots('F02', 'CSEA-I', 'L201', 2);
  console.log(`  Found contiguous slots: ${JSON.stringify(contiguous)}`);
  console.assert(contiguous !== null, 'Should find contiguous slots');
  console.assert(contiguous.length === 2, 'Should return 2 slots');

  // Test 6: Contiguous slots should not cross break
  console.log('\nTest 6: Contiguous slots respect break');
  // Book slots 1,2,3 on Monday
  allocator.bookSlot('F03', 'CSEA-I', 'R101', 'Monday', 1);
  allocator.bookSlot('F03', 'CSEA-I', 'R101', 'Monday', 2);
  allocator.bookSlot('F03', 'CSEA-I', 'R101', 'Monday', 3);
  // Slot 5 is break, so requesting 3 consecutive should find Tuesday 1,2,3
  const contig3 = allocator.findContiguousSlots('F03', 'CSEA-I', 'R101', 3);
  console.log(`  3 consecutive slots: ${JSON.stringify(contig3)}`);
  console.assert(contig3 !== null, 'Should find 3 consecutive slots');
  console.assert(contig3.length === 3, 'Should return 3 slots');
  console.assert(contig3[0].slot + 1 === contig3[1].slot && contig3[1].slot + 1 === contig3[2].slot, 'Slots should be consecutive');

  // Print summary
  console.log('\n=== Booking Summary ===');
  console.log(JSON.stringify(allocator.getBookingSummary(), null, 2));

  console.log('\n=== All tests passed! ===');
}

module.exports = SlotAllocator;
