/**
 * Timetable Generator - Frontend Application
 */

// DOM Elements
const uploadBtn = document.getElementById('upload-btn');
const generateTimetableBtn = document.getElementById('generate-timetable-btn');
const generateExamBtn = document.getElementById('generate-exam-btn');
const generateFacultyBtn = document.getElementById('generate-faculty-btn');
const validateBtn = document.getElementById('validate-btn');
const examStartDate = document.getElementById('exam-start-date');

const fileList = document.getElementById('file-list');
const resultsContainer = document.getElementById('results-container');
const validationContainer = document.getElementById('validation-container');

const spinners = {
  timetable: document.getElementById('timetable-spinner'),
  exam: document.getElementById('exam-spinner'),
  faculty: document.getElementById('faculty-spinner')
};

// Set default exam start date to next Monday
function setDefaultExamDate() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 + 1;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  examStartDate.value = nextMonday.toISOString().split('T')[0];
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setDefaultExamDate();
  loadFileList();
});

// ========== Upload Functions ==========

uploadBtn.addEventListener('click', uploadFiles);

async function uploadFiles() {
  const roomsFile = document.getElementById('rooms-file').files[0];
  const facultyFile = document.getElementById('faculty-file').files[0];
  const timeSlotsFile = document.getElementById('time-slots-file').files[0];
  const coursesFiles = document.getElementById('courses-files').files;

  if (!roomsFile && !facultyFile && !timeSlotsFile && coursesFiles.length === 0) {
    showResult('Please select at least one file to upload.', 'error');
    return;
  }

  const formData = new FormData();
  if (roomsFile) formData.append('rooms', roomsFile);
  if (facultyFile) formData.append('faculty', facultyFile);
  if (timeSlotsFile) formData.append('time_slots', timeSlotsFile);
  for (const file of coursesFiles) {
    formData.append('courses', file);
  }

  setLoading(true);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      showResult(`Successfully uploaded ${data.uploadedFiles.length} file(s).`, 'success');
      loadFileList();
      // Reset file inputs
      document.getElementById('rooms-file').value = '';
      document.getElementById('faculty-file').value = '';
      document.getElementById('time-slots-file').value = '';
      document.getElementById('courses-files').value = '';
    } else {
      showResult(`Upload failed: ${data.error}`, 'error');
    }
  } catch (error) {
    showResult(`Upload failed: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function loadFileList() {
  try {
    const response = await fetch('/api/files');
    const files = await response.json();

    if (files.length === 0) {
      fileList.innerHTML = '<p class="file-item">No files uploaded yet.</p>';
      return;
    }

    fileList.innerHTML = files.map(file => `
      <div class="file-item">
        <div class="file-info">
          <span class="file-name">${file.name}</span>
          <span class="file-meta">${formatFileSize(file.size)} • Modified: ${formatDate(file.modified)}</span>
        </div>
        <button class="btn btn-danger" onclick="deleteFile('${file.name}')">Delete</button>
      </div>
    `).join('');
  } catch (error) {
    fileList.innerHTML = `<p class="file-item">Error loading files: ${error.message}</p>`;
  }
}

async function deleteFile(filename) {
  if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

  try {
    const response = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showResult(`File ${filename} deleted successfully.`, 'success');
      loadFileList();
    } else {
      showResult(`Delete failed: ${data.error}`, 'error');
    }
  } catch (error) {
    showResult(`Delete failed: ${error.message}`, 'error');
  }
}

// ========== Generate Functions ==========

generateTimetableBtn.addEventListener('click', generateTimetable);
generateExamBtn.addEventListener('click', generateExam);
generateFacultyBtn.addEventListener('click', generateFaculty);

async function generateTimetable() {
  setSpinner('timetable', true);

  try {
    const response = await fetch('/api/generate/timetable', {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      let message = `Generated ${data.conflicts.length === 0 ? 'valid' : 'invalid'} timetable with ${data.missingHours.length} missing hour entries.`;
      if (data.conflicts.length > 0) {
        message += ` ${data.conflicts.length} conflicts detected.`;
      }
      showResult(message, data.conflicts.length === 0 ? 'success' : 'warning');
      showDownloadButton(data.file);

      // Enable faculty timetable button
      generateFacultyBtn.disabled = false;
    } else {
      showResult(`Generation failed: ${data.error}`, 'error');
    }
  } catch (error) {
    showResult(`Generation failed: ${error.message}`, 'error');
  } finally {
    setSpinner('timetable', false);
  }
}

async function generateExam() {
  setSpinner('exam', true);

  try {
    const response = await fetch('/api/generate/exam', {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      let message = 'Exam schedule generated successfully.';
      if (data.conflicts.length > 0) {
        message += ` ${data.conflicts.length} conflicts detected.`;
        showResult(message, 'warning');
      } else {
        showResult(message, 'success');
      }
      showDownloadButton(data.file);
    } else {
      showResult(`Generation failed: ${data.error}`, 'error');
    }
  } catch (error) {
    showResult(`Generation failed: ${error.message}`, 'error');
  } finally {
    setSpinner('exam', false);
  }
}

async function generateFaculty() {
  setSpinner('faculty', true);

  try {
    const response = await fetch('/api/generate/faculty', {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      showResult(`Generated faculty timetables for ${data.facultyCount} faculty members.`, 'success');
      showDownloadButton(data.file);
    } else {
      showResult(`Generation failed: ${data.error}`, 'error');
    }
  } catch (error) {
    showResult(`Generation failed: ${error.message}`, 'error');
  } finally {
    setSpinner('faculty', false);
  }
}

// ========== Validation Functions ==========

validateBtn.addEventListener('click', runValidation);

async function runValidation() {
  setLoading(true);

  try {
    const response = await fetch('/api/validate');
    const data = await response.json();

    if (data.validation) {
      displayValidationResults(data.validation);
    } else {
      showResult('Validation failed to run.', 'error');
    }
  } catch (error) {
    showResult(`Validation failed: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function displayValidationResults(validation) {
  const { conflicts, missingHours, valid } = validation;

  let html = '<table class="validation-table">';
  html += '<thead><tr><th>Type</th><th>Description</th><th>Affected</th></tr></thead>';
  html += '<tbody>';

  if (conflicts.length === 0 && missingHours.length === 0) {
    html += '<tr class="ok">';
    html += '<td><span class="type-badge ok">OK</span></td>';
    html += '<td>No conflicts or missing hours detected</td>';
    html += '<td>-</td>';
    html += '</tr>';
  }

  // Add conflicts
  for (const conflict of conflicts) {
    html += '<tr class="conflict">';
    html += `<td><span class="type-badge conflict">${formatConflictType(conflict.type)}</span></td>`;
    html += `<td>${conflict.description}</td>`;
    html += `<td>${JSON.stringify(conflict.affected)}</td>`;
    html += '</tr>';
  }

  // Add missing hours
  for (const missing of missingHours) {
    html += '<tr class="warning">';
    html += `<td><span class="type-badge warning">MISSING HOURS</span></td>`;
    html += `<td>${missing.course_code} (${missing.section}): ${missing.type} - required ${missing.required}, allocated ${missing.allocated}</td>`;
    html += '<td>-</td>';
    html += '</tr>';
  }

  html += '</tbody></table>';

  validationContainer.innerHTML = html;
}

// ========== UI Helper Functions ==========

function showResult(message, type) {
  const className = type === 'success' ? 'result-success' :
                    type === 'error' ? 'result-error' : 'result-info';

  resultsContainer.innerHTML = `
    <div class="result-box ${className}">
      <h4>${type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notice'}</h4>
      <p>${message}</p>
    </div>
  `;
}

function showDownloadButton(filePath) {
  const filename = filePath.split('/').pop();
  const downloadHtml = `
    <a href="/api/download/${encodeURIComponent(filename)}" class="download-btn" download>
      Download Excel File
    </a>
  `;
  resultsContainer.insertAdjacentHTML('beforeend', downloadHtml);
}

function setSpinner(type, show) {
  spinners[type].style.display = show ? 'block' : 'none';
  if (type === 'timetable') generateTimetableBtn.disabled = show;
  if (type === 'exam') generateExamBtn.disabled = show;
  if (type === 'faculty') generateFacultyBtn.disabled = show;
}

function setLoading(loading) {
  uploadBtn.disabled = loading;
  validateBtn.disabled = loading;
  if (loading) {
    document.body.classList.add('loading');
  } else {
    document.body.classList.remove('loading');
  }
}

// ========== Utility Functions ==========

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatConflictType(type) {
  return type.replace(/_/g, ' ');
}
