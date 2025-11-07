// =====================================
// FRONTEND INTEGRATION: SPRING + FLASK
// =====================================

// ✅ Java Spring Boot API base (Authentication)
const JAVA_BASE_URL = "http://localhost:5501/api/auth";

// ✅ Python Flask API base (Face Recognition + Attendance)
const PYTHON_BASE_URL = "http://localhost:5500";

let token = null;
let currentUser = null;
const $ = (id) => document.getElementById(id);

// ======================
// Toast Notifications
// ======================
function showToast(message, type = "info", duration = 3000) {
  const container = $("toastContainer");
  const toast = document.createElement("div");
  toast.className = `px-4 py-2 rounded-lg text-white shadow-md transition-opacity duration-300 ${
    type === "error" ? "bg-red-500" : type === "success" ? "bg-green-500" : "bg-indigo-500"
  }`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ======================
// Tab Switching
// ======================
$("loginTab").addEventListener("click", () => {
  $("loginForm").classList.remove("hidden");
  $("registerForm").classList.add("hidden");
});

$("registerTab").addEventListener("click", () => {
  $("registerForm").classList.remove("hidden");
  $("loginForm").classList.add("hidden");
});

// ======================
// Show Student Photo Upload Field
// ======================
$("registerRole").addEventListener("change", (e) => {
  if (e.target.value === "student") $("studentPhoto").classList.remove("hidden");
  else $("studentPhoto").classList.add("hidden");
});

// ======================
// REGISTER (Java + Flask)
// ======================
$("registerBtn").addEventListener("click", async () => {
  const role = $("registerRole").value;
  const id = $("registerId").value.trim();
  const name = $("registerName").value.trim();
  const email = $("registerEmail").value.trim();
  const password = $("registerPassword").value;
  const photo = $("studentPhoto").files[0];

  if (!email || !password) return showToast("Email & password required", "error");

  try {
    // Step 1 — Register in Java backend
    const res = await fetch(`${JAVA_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, email, password, role }),
    });

    if (!res.ok) {
      const err = await res.json();
      return showToast(`Registration failed: ${err.message || res.status}`, "error");
    }

    showToast("✅ Registered successfully in Java backend", "success");

    // Step 2 — Upload photo for students
    if (role === "student" && photo) {
      const formData = new FormData();
      formData.append("file", photo);
      formData.append("email", email);

      // Upload to Java backend
      const uploadRes = await fetch(`${JAVA_BASE_URL}/upload-photo`, {
        method: "POST",
        body: formData,
      });

      if (uploadRes.ok) {
        showToast("🧠 Photo saved in Java DB successfully", "success");
      } else {
        showToast("⚠️ Failed to save photo in DB", "error");
      }

      // Upload same photo to Flask
      const faceRes = await fetch(`${PYTHON_BASE_URL}/register`, {
        method: "POST",
        body: formData,
      });

      if (faceRes.ok) {
        showToast("📸 Face registered in Flask successfully", "success");
      } else {
        showToast("⚠️ Face registration failed (Flask)", "error");
      }
    }

    ["registerId", "registerName", "registerEmail", "registerPassword", "studentPhoto"].forEach(
      (id) => ($(id).value = "")
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Error connecting to backend", "error");
  }
});

// ======================
// LOGIN (Java backend)
// ======================
$("loginBtn").addEventListener("click", async () => {
  const role = $("loginRole").value;
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  if (!email || !password) return showToast("Enter email & password", "error");

  try {
    const res = await fetch(`${JAVA_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });

    if (!res.ok) {
      const err = await res.json();
      return showToast(`Login failed: ${err.message || res.status}`, "error");
    }

    const data = await res.json();
    token = data.token || "dummy-token";

    // ✅ Capture ID and name from Java backend
    currentUser = {
      id: data.id,
      name: data.name,
      email: data.email,
      role: (data.role || role).toLowerCase(), // normalize role
    };

    showToast("✅ Login successful", "success");
    onLoginSuccess(currentUser);
  } catch (err) {
    console.error(err);
    showToast("Connection error. Ensure backend is running.", "error");
  }
});

// ======================
// After Login (Fixed)
// ======================
function onLoginSuccess(user) {
  $("auth").classList.add("hidden");
  $("facultyPage").classList.add("hidden");
  $("studentPage").classList.add("hidden");

  const role = user.role.toLowerCase();

  if (role === "faculty") {
    $("facultyPage").classList.remove("hidden");
    showToast("👨‍🏫 Faculty logged in", "info");
  } else if (role === "student") {
    $("studentPage").classList.remove("hidden");
    showToast("🎓 Student logged in", "info");
    showStudentAttendance(user);
  } else {
    showToast("⚠️ Unknown role detected!", "error");
    $("auth").classList.remove("hidden");
  }
}

// ======================
// Faculty: Upload classroom image (Flask recognize)
// ======================
let lastRecognized = [];

$("uploadBtn").addEventListener("click", async () => {
  const file = $("imageInput").files[0];
  const session = $("sessionInput").value.trim() || "Default Lecture";
  if (!file) return showToast("Please choose a classroom image", "error");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("session", session);

  if (currentUser && currentUser.role === "faculty" && currentUser.id) {
    formData.append("marked_by", String(currentUser.id));
  }

  try {
    const res = await fetch(`${PYTHON_BASE_URL}/recognize`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      lastRecognized = data.recognized || [];
      displayResult(lastRecognized, session);
      showToast("✅ Attendance processed successfully", "success");
    } else {
      showToast(data.error || "Recognition failed", "error");
    }
  } catch (err) {
    console.error(err);
    showToast("Flask server not reachable", "error");
  }
});

function displayResult(presentArray, session) {
  $("result").innerHTML = `
    <div class="font-semibold">Session: ${session}</div>
    <div class="mt-2 text-sm text-green-700">
      Present (${presentArray.length}): ${presentArray.join(", ") || "— none —"}
    </div>
  `;
}

// ======================
// Export Attendance CSV (Faculty)
// ======================
$("exportBtn").addEventListener("click", () => {
  const date = $("dateInput").value;
  if (!date) return showToast("Select a date before exporting", "error");
  if (!lastRecognized.length) return showToast("No attendance data to export", "error");

  const rows = [["#", "Name"]];
  lastRecognized.forEach((name, i) => rows.push([i + 1, name]));

  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("📄 Attendance CSV exported", "success");
});

// ======================
// STUDENT ATTENDANCE (Fetch by user_id)
// ======================
async function showStudentAttendance(user) {
  $("studentAttendance").innerHTML = `<p class="text-sm text-gray-700">Fetching attendance for ${user.name}...</p>`;

  if (!user.id) {
    $("studentAttendance").innerHTML = `<p class="text-red-600">User ID missing in login response.</p>`;
    return;
  }

  try {
    const res = await fetch(`${PYTHON_BASE_URL}/attendance/${user.id}`);
    const data = await res.json();

    if (res.ok && data.count > 0) {
      const recordsHTML = data.attendance
        .map(
          (r) =>
            `<li class="leading-6">${r.date} — <span class="italic">${r.lecture_name || "N/A"}</span> — <strong>${r.status}</strong></li>`
        )
        .join("");

      $("studentAttendance").innerHTML = `
        <p class="font-semibold text-green-700">✅ Attendance History</p>
        <ul class="text-sm text-gray-700 mt-2">${recordsHTML}</ul>
        <p class="mt-2 text-gray-500 text-sm">Total Present: ${data.count}</p>
      `;
    } else {
      $("studentAttendance").innerHTML = `<p class="text-red-600 font-semibold">❌ No attendance records found.</p>`;
    }
  } catch (err) {
    console.error(err);
    $("studentAttendance").innerHTML = `<p class="text-red-600">Error fetching attendance data.</p>`;
  }
}

// ======================
// Logout
// ======================
function logout() {
  token = null;
  currentUser = null;
  ["facultyPage", "studentPage"].forEach((id) => $(id).classList.add("hidden"));
  $("auth").classList.remove("hidden");
  showToast("Logged out successfully", "info");
}

$("logoutBtn1").addEventListener("click", logout);
$("logoutBtn2").addEventListener("click", logout);
