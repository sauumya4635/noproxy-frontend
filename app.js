// app.js — connected to real backends

const JAVA_BASE_URL = "http://localhost:5501/api/auth";   // Spring Boot backend
const PYTHON_BASE_URL = "http://localhost:5500";          // Flask backend

let token = null;
const $ = id => document.getElementById(id);

// ======================
// Toast notifications
// ======================
function showToast(message, type='info', duration=3000) {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration + 300);
}

// ======================
// TAB SWITCHING
// ======================
$('loginTab').addEventListener('click', () => {
  $('loginForm').classList.remove('hidden');
  $('registerForm').classList.add('hidden');
  $('loginTab').classList.add('active');
  $('registerTab').classList.remove('active');
});

$('registerTab').addEventListener('click', () => {
  $('registerForm').classList.remove('hidden');
  $('loginForm').classList.add('hidden');
  $('registerTab').classList.add('active');
  $('loginTab').classList.remove('active');
});

// ======================
// SHOW STUDENT PHOTO FIELD
// ======================
$('registerRole').addEventListener('change', e => {
  if (e.target.value === 'student') $('studentPhoto').classList.remove('hidden');
  else $('studentPhoto').classList.add('hidden');
});

// ======================
// REGISTER (Java + Flask for student)
// ======================
$('registerBtn').addEventListener('click', async () => {
  const role = $('registerRole').value;
  const id = $('registerId').value.trim();
  const name = $('registerName').value.trim();
  const email = $('registerEmail').value.trim();
  const password = $('registerPassword').value;
  const photo = $('studentPhoto').files[0];

  if (!email || !password)
    return showToast('Email & password required', 'error');

  // Step 1 — Register user in Java backend
  try {
    const res = await fetch(`${JAVA_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, email, password, role })
    });

    if (!res.ok) {
      const err = await res.json();
      return showToast(`Registration failed: ${err.message || res.status}`, 'error');
    }

    showToast('✅ Registered successfully on Java backend', 'success');

    // Step 2 — If student, send photo to Flask backend
    if (role === 'student' && photo) {
      const formData = new FormData();
      formData.append("file", photo);

      const faceRes = await fetch(`${PYTHON_BASE_URL}/register`, {
        method: "POST",
        body: formData
      });

      if (faceRes.ok) {
        showToast('🧠 Face registered successfully!', 'success');
      } else {
        showToast('⚠️ Face upload failed (Flask)', 'error');
      }
    }

    // Reset form
    $('registerId').value = '';
    $('registerName').value = '';
    $('registerEmail').value = '';
    $('registerPassword').value = '';
    $('studentPhoto').value = '';
  } catch (err) {
    console.error(err);
    showToast('Error connecting to backend.', 'error');
  }
});

// ======================
// LOGIN (Java backend)
// ======================
$('loginBtn').addEventListener('click', async () => {
  const role = $('loginRole').value;
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;

  if (!email || !password) return showToast('Enter email & password', 'error');

  try {
    const res = await fetch(`${JAVA_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role })
    });

    if (!res.ok) {
      const err = await res.json();
      return showToast(`Login failed: ${err.message || res.status}`, 'error');
    }

    const data = await res.json();
    token = data.token || "dummy-token"; // store auth token if backend provides one
    showToast('✅ Login successful', 'success');

    const user = { email, role };
    onLoginSuccess(user, role);
  } catch (err) {
    console.error(err);
    showToast('Connection error. Ensure backend is running.', 'error');
  }
});

// ======================
// After login
// ======================
function onLoginSuccess(user, role) {
  $('auth').classList.add('hidden');
  if (role === 'faculty') {
    $('facultyPage').classList.remove('hidden');
    showToast(`Faculty logged in: ${user.email}`, 'info');
  } else {
    $('studentPage').classList.remove('hidden');
    showStudentAttendance(user);
    showToast(`Student logged in: ${user.email}`, 'info');
  }
}

// ======================
// Faculty: Upload classroom image (Flask recognize)
// ======================
$('uploadBtn').addEventListener('click', async () => {
  const file = $('imageInput').files[0];
  const session = $('sessionInput').value.trim() || 'DefaultSession';
  if (!file) return showToast('Please choose a file', 'error');

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${PYTHON_BASE_URL}/recognize`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (res.ok) {
      displayResult(data.recognized || [], session);
      showToast('✅ Attendance processed successfully', 'success');
    } else {
      showToast(data.error || 'Recognition failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Flask server not reachable', 'error');
  }
});

function displayResult(presentArray, session) {
  $('result').innerHTML = `
    <div class="font-semibold">Result (${session})</div>
    <div class="mt-2">Present: <strong>${presentArray.length}</strong></div>
    <div class="mt-2"><em>Recognized:</em> ${presentArray.join(', ') || '— none —'}</div>
  `;
}

// ======================
// Export Attendance (Faculty)
// ======================
$('exportBtn').addEventListener('click', () => {
  const date = $('dateInput').value;
  if (!date) return showToast('Choose a date', 'error');
  showToast('Export feature handled on backend (to be integrated).', 'info');
});

// ======================
// Student Attendance Placeholder
// ======================
function showStudentAttendance(user) {
  $('studentAttendance').innerHTML = `
    <p class="text-sm">Fetching attendance from backend...</p>
  `;
  // TODO: connect to Java API if attendance retrieval is available
}

// ======================
// Logout
// ======================
function logout() {
  token = null;
  $('facultyPage').classList.add('hidden');
  $('studentPage').classList.add('hidden');
  $('auth').classList.remove('hidden');
  $('loginEmail').value = '';
  $('loginPassword').value = '';
  $('registerEmail').value = '';
  $('registerPassword').value = '';
  $('registerId').value = '';
  $('registerName').value = '';
  $('studentPhoto').value = '';
}

$('logoutBtn1').addEventListener('click', logout);
$('logoutBtn2').addEventListener('click', logout);
