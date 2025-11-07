// app.js — full integrated version (Java + Flask + CSV export)

const JAVA_BASE_URL = "http://localhost:5501/api/auth";   // Spring Boot backend
const PYTHON_BASE_URL = "http://localhost:5500";          // Flask backend

let token = null;
const $ = id => document.getElementById(id);

// ======================
// Toast notifications
// ======================
function showToast(message, type = 'info', duration = 3000) {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `px-4 py-2 rounded-lg text-white shadow-md transition-opacity duration-300 ${
    type === 'error'
      ? 'bg-red-500'
      : type === 'success'
      ? 'bg-green-500'
      : 'bg-indigo-500'
  }`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ======================
// TAB SWITCHING
// ======================
$('loginTab').addEventListener('click', () => {
  $('loginForm').classList.remove('hidden');
  $('registerForm').classList.add('hidden');
});

$('registerTab').addEventListener('click', () => {
  $('registerForm').classList.remove('hidden');
  $('loginForm').classList.add('hidden');
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

  try {
    // Step 1 — Register user in Java backend
    const res = await fetch(`${JAVA_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, email, password, role })
    });

    if (!res.ok) {
      const err = await res.json();
      return showToast(`Registration failed: ${err.message || res.status}`, 'error');
    }

    showToast('✅ Registered successfully in Java backend', 'success');

    // Step 2 — Upload photo (only for student)
    if (role === 'student' && photo) {
      const formData = new FormData();
      formData.append("file", photo);
      formData.append("email", email);

      const uploadRes = await fetch(`${JAVA_BASE_URL}/upload-photo`, {
        method: "POST",
        body: formData
      });

      if (uploadRes.ok) {
        showToast('🧠 Photo saved in DB (Java) successfully', 'success');
      } else {
        showToast('⚠️ Failed to save photo in DB', 'error');
      }

      // Step 3 — Send same photo to Flask for face registration
      const faceRes = await fetch(`${PYTHON_BASE_URL}/register`, {
        method: "POST",
        body: formData
      });

      if (faceRes.ok) {
        showToast('📸 Face registered in Flask AI', 'success');
      } else {
        showToast('⚠️ Face registration failed (Flask)', 'error');
      }
    }

    // Reset fields
    ['registerId','registerName','registerEmail','registerPassword','studentPhoto'].forEach(id => $(id).value = '');
  } catch (err) {
    console.error(err);
    showToast('❌ Error connecting to backend', 'error');
  }
});

// ======================
// LOGIN (Java backend)
// ======================
$('loginBtn').addEventListener('click', async () => {
  const role = $('loginRole').value;
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;

  if (!email || !password)
    return showToast('Enter email & password', 'error');

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
    token = data.token || "dummy-token";
    showToast('✅ Login successful', 'success');

    onLoginSuccess({ email, role }, role);
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
  } else {
    $('studentPage').classList.remove('hidden');
    showStudentAttendance(user);
  }
  showToast(`${role.charAt(0).toUpperCase() + role.slice(1)} logged in`, 'info');
}

// ======================
// Faculty: Upload classroom image (Flask recognize)
// ======================
let lastRecognized = [];

$('uploadBtn').addEventListener('click', async () => {
  const file = $('imageInput').files[0];
  const session = $('sessionInput').value.trim() || 'DefaultSession';
  if (!file) return showToast('Please choose a classroom image', 'error');

  const formData = new FormData();
  formData.append("file", file);
  formData.append("session", session);

  try {
    const res = await fetch(`${PYTHON_BASE_URL}/recognize`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (res.ok) {
      lastRecognized = data.recognized || [];
      displayResult(lastRecognized, session);
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
    <div class="font-semibold">Session: ${session}</div>
    <div class="mt-2 text-sm text-green-700">
      Present (${presentArray.length}): ${presentArray.join(', ') || '— none —'}
    </div>
  `;
}

// ======================
// Export Attendance CSV (Faculty)
// ======================
$('exportBtn').addEventListener('click', () => {
  const date = $('dateInput').value;
  if (!date) return showToast('Select a date before exporting', 'error');
  if (!lastRecognized.length) return showToast('No attendance data to export', 'error');

  const rows = [["#", "Name"]];
  lastRecognized.forEach((name, i) => rows.push([i + 1, name]));

  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('📄 Attendance CSV exported', 'success');
});

// ======================
// Student Attendance Placeholder
// ======================
function showStudentAttendance(user) {
  $('studentAttendance').innerHTML = `
    <p class="text-sm text-gray-700">Fetching attendance for ${user.email}...</p>
  `;
  // TODO: connect to Java API for attendance history if implemented
}

// ======================
// Logout
// ======================
function logout() {
  token = null;
  ['facultyPage','studentPage'].forEach(id => $(id).classList.add('hidden'));
  $('auth').classList.remove('hidden');
  showToast('Logged out successfully', 'info');
}

$('logoutBtn1').addEventListener('click', logout);
$('logoutBtn2').addEventListener('click', logout);
