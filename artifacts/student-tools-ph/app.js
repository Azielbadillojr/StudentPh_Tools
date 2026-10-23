const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORAGE = { theme: "student-tools-ph-theme", planner: "student-tools-ph-planner", grades: "student-tools-ph-grade-inputs", gwa: "student-tools-ph-gwa-inputs" };

// Theme preference is intentionally the only preference stored outside the planner.
const root = document.documentElement;
let savedTheme = null;
try {
  savedTheme = localStorage.getItem(STORAGE.theme);
} catch {
  // Keep the app usable when browser storage is disabled.
}
if (savedTheme === "dark") root.dataset.theme = "dark";
function updateThemeButton() {
  const dark = root.dataset.theme === "dark";
  const button = $("#theme-toggle");
  if (!button) return;
  button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  $(".theme-label", button).textContent = dark ? "Dark" : "Light";
  $(".theme-icon", button).textContent = dark ? "☼" : "◐";
}
$("#theme-toggle")?.addEventListener("click", () => {
  const dark = root.dataset.theme !== "dark";
  root.dataset.theme = dark ? "dark" : "light";
  try {
    localStorage.setItem(STORAGE.theme, dark ? "dark" : "light");
  } catch {
    // The theme still changes for the current page when storage is disabled.
  }
  updateThemeButton();
});
updateThemeButton();

function makeInput(placeholder, type = "number", min, max, step) {
  const input = document.createElement("input");
  input.type = type;
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder);
  input.dataset.testid = `input-${placeholder.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (type === "number") {
    input.min = String(min);
    if (max !== undefined) input.max = String(max);
    input.step = String(step || "any");
    input.inputMode = "decimal";
  }
  return input;
}
function addEntryRow(target, kind) {
  const row = document.createElement("div");
  row.className = "input-row";
  if (kind === "grade") {
    const name = makeInput("Item name", "text");
    const score = makeInput("Score %", "number", 0, 100, 0.1);
    const weight = makeInput("Weight %", "number", 0, 100, 0.1);
    score.setAttribute("aria-label", "Score percentage");
    weight.setAttribute("aria-label", "Weight percentage");
    name.value = target.children.length === 0 ? "Quiz" : "";
    score.value = "";
    weight.value = "";
    row.append(name, score, weight);
  } else {
    const name = makeInput("Subject name", "text");
    const grade = makeInput("Grade 1.0–5.0", "number", 1, 5, 0.1);
    const units = makeInput("Units", "number", 0.1, 99, 0.5);
    grade.setAttribute("aria-label", "Grade value from 1.0 to 5.0");
    units.setAttribute("aria-label", "Subject units");
    row.append(name, grade, units);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-row";
  remove.setAttribute("aria-label", `Remove ${kind === "grade" ? "grade item" : "subject"}`);
  remove.textContent = "×";
  remove.addEventListener("click", () => {
    row.remove();
    updateRowLabels(target, kind);
  });
  row.append(remove);
  target.append(row);
  updateRowLabels(target, kind);
}
function updateRowLabels(target, kind) {
  $$(".input-row", target).forEach((row, index) => {
    const labels = kind === "grade" ? ["Item name", "Score %", "Weight %"] : ["Subject name", "Grade value", "Units"];
    row.setAttribute("aria-label", `${kind === "grade" ? "Grade item" : "Subject"} ${index + 1}`);
    [...row.querySelectorAll("input")].forEach((input, i) => input.setAttribute("aria-label", `${labels[i]}${index + 1}`));
  });
}
const gradeRows = $("#grade-rows");
const gwaRows = $("#gwa-rows");
if (gradeRows && gwaRows) {
  addEntryRow(gradeRows, "grade");
  addEntryRow(gradeRows, "grade");
  addEntryRow(gwaRows, "gwa");
  addEntryRow(gwaRows, "gwa");
  function loadCalculatorRows(target, kind, key) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (!Array.isArray(saved) || !saved.length) return;
      target.replaceChildren();
      saved.slice(0, 30).forEach(entry => {
        addEntryRow(target, kind);
        const inputs = [...target.lastElementChild.querySelectorAll("input")];
        inputs.forEach((input, index) => {
          input.value = typeof entry[index] === "string" ? entry[index] : "";
        });
      });
    } catch {
      // Corrupt or unavailable local data should never prevent using the calculators.
    }
  }
  function saveCalculatorRows(target, key) {
    try {
      localStorage.setItem(key, JSON.stringify($$(".input-row", target).map(row => [...row.querySelectorAll("input")].map(input => input.value))));
    } catch {
      // Calculations continue to work if browser storage is unavailable.
    }
  }
  loadCalculatorRows(gradeRows, "grade", STORAGE.grades);
  loadCalculatorRows(gwaRows, "gwa", STORAGE.gwa);
  gradeRows.addEventListener("input", () => saveCalculatorRows(gradeRows, STORAGE.grades));
  gwaRows.addEventListener("input", () => saveCalculatorRows(gwaRows, STORAGE.gwa));
  gradeRows.addEventListener("click", event => { if (event.target.closest(".remove-row")) saveCalculatorRows(gradeRows, STORAGE.grades); });
  gwaRows.addEventListener("click", event => { if (event.target.closest(".remove-row")) saveCalculatorRows(gwaRows, STORAGE.gwa); });
  $("#add-grade-row").addEventListener("click", () => { addEntryRow(gradeRows, "grade"); saveCalculatorRows(gradeRows, STORAGE.grades); });
  $("#add-gwa-row").addEventListener("click", () => { addEntryRow(gwaRows, "gwa"); saveCalculatorRows(gwaRows, STORAGE.gwa); });
  $("#calculate-grade").addEventListener("click", () => {
    const rows = $$(".input-row", gradeRows);
    const values = rows.map(row => {
      const [, score, weight] = [...row.querySelectorAll("input")].map(input => input.value.trim());
      return { score: Number(score), weight: Number(weight), valid: score !== "" && weight !== "" };
    });
    const result = $("#grade-result");
    const hint = $("#grade-hint");
    const active = values.filter(value => value.valid);
    const totalWeight = active.reduce((sum, value) => sum + value.weight, 0);
    const invalid = values.some(value => value.valid && (value.score < 0 || value.score > 100 || value.weight <= 0 || value.weight > 100));
    if (!active.length) {
      result.textContent = "—";
      hint.textContent = "Enter at least one score and weight to calculate.";
      return;
    }
    if (invalid) {
      result.textContent = "Check inputs";
      hint.textContent = "Scores must be 0–100, and each weight must be greater than 0.";
      return;
    }
    if (Math.abs(totalWeight - 100) > 0.05) {
      result.textContent = "—";
      hint.textContent = `Your weights add up to ${totalWeight.toFixed(1)}%. Make them total 100% for a final grade.`;
      return;
    }
    const weighted = active.reduce((sum, value) => sum + value.score * value.weight, 0) / totalWeight;
    result.textContent = `${weighted.toFixed(2)}%`;
    hint.textContent = "Based on your scores and weights totaling 100%.";
  });
  $("#calculate-gwa").addEventListener("click", () => {
    const values = $$(".input-row", gwaRows).map(row => {
      const [, grade, units] = [...row.querySelectorAll("input")].map(input => input.value.trim());
      return { grade: Number(grade), units: Number(units), valid: grade !== "" && units !== "" };
    });
    const active = values.filter(value => value.valid);
    const result = $("#gwa-result");
    const hint = $("#gwa-hint");
    if (!active.length) {
      result.textContent = "—";
      hint.textContent = "Add a subject, grade value, and units to get your GWA.";
      return;
    }
    if (active.some(value => value.grade < 1 || value.grade > 5 || value.units <= 0)) {
      result.textContent = "Check inputs";
      hint.textContent = "Grade values must be 1.0–5.0 and units must be greater than 0.";
      return;
    }
    const units = active.reduce((sum, value) => sum + value.units, 0);
    const gwa = active.reduce((sum, value) => sum + value.grade * value.units, 0) / units;
    result.textContent = gwa.toFixed(2);
    hint.textContent = `${units.toFixed(1)} total units · lower GWA is better.`;
  });
}

// Focus timer
let timerDuration = 25 * 60;
let remaining = timerDuration;
let timerInterval = null;
function renderTimer() {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  $("#timer-display").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  $("#timer-ring").style.setProperty("--timer-progress", `${((timerDuration - remaining) / timerDuration) * 100}%`);
}
$$(".preset-button").forEach(button => button.addEventListener("click", () => {
  if (timerInterval) return;
  $$(".preset-button").forEach(item => {
    const selected = item === button;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  timerDuration = Number(button.dataset.minutes) * 60;
  remaining = timerDuration;
  $("#timer-status").textContent = "READY WHEN YOU ARE";
  $("#timer-message").textContent = "Put your phone aside. You’ve got this.";
  $("#timer-start").innerHTML = 'Start focusing <span aria-hidden="true">→</span>';
  renderTimer();
}));
$("#timer-start")?.addEventListener("click", () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    $("#timer-start").innerHTML = 'Resume session <span aria-hidden="true">→</span>';
    $("#timer-status").textContent = "PAUSED";
    $("#timer-message").textContent = "Take a breath. Resume whenever you’re ready.";
    return;
  }
  if (remaining <= 0) remaining = timerDuration;
  $("#timer-status").textContent = "FOCUS IN PROGRESS";
  $("#timer-start").textContent = "Pause session";
  $("#timer-message").textContent = "Stay with one task. You’re making progress.";
  timerInterval = window.setInterval(() => {
    remaining -= 1;
    renderTimer();
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      $("#timer-status").textContent = "SESSION COMPLETE";
      $("#timer-start").innerHTML = 'Start another <span aria-hidden="true">→</span>';
      $("#timer-message").textContent = "Nice work. Take a short break before your next session.";
    }
  }, 1000);
});
$("#timer-reset")?.addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;
  remaining = timerDuration;
  $("#timer-status").textContent = "READY WHEN YOU ARE";
  $("#timer-start").innerHTML = 'Start focusing <span aria-hidden="true">→</span>';
  $("#timer-message").textContent = "Put your phone aside. You’ve got this.";
  renderTimer();
});
if ($("#timer-display")) renderTimer();

// Planner is stored on this device only.
function readTasks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE.planner) || "[]");
    return Array.isArray(parsed) ? parsed.filter(task => task && typeof task.id === "string" && typeof task.title === "string") : [];
  } catch {
    return [];
  }
}
let tasks = readTasks();
function persistTasks() {
  try {
    localStorage.setItem(STORAGE.planner, JSON.stringify(tasks));
    return true;
  } catch {
    $("#planner-error").textContent = "Couldn’t save this task. Check your browser storage settings and try again.";
    return false;
  }
}
function renderTasks() {
  const list = $("#planner-list");
  if (!list) return;
  list.replaceChildren();
  const count = $("#planner-count");
  count.textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "planner-empty";
    empty.innerHTML = '<span class="empty-mark" aria-hidden="true">＋</span><strong>A clear page is a good start.</strong><p>Add a task above and it’ll stay right here on this device.</p>';
    list.append(empty);
    return;
  }
  const ordered = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.date || "9999").localeCompare(b.date || "9999"));
  for (const task of ordered) {
    const item = document.createElement("div");
    item.className = `task-item${task.done ? " is-done" : ""}`;
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-check";
    check.checked = Boolean(task.done);
    check.setAttribute("aria-label", `${task.done ? "Mark incomplete" : "Mark complete"}: ${task.title}`);
    check.dataset.testid = `checkbox-task-${task.id}`;
    check.addEventListener("change", () => {
      tasks = tasks.map(entry => entry.id === task.id ? { ...entry, done: check.checked } : entry);
      persistTasks();
      renderTasks();
    });
    const copy = document.createElement("div");
    copy.className = "task-copy";
    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;
    const meta = document.createElement("span");
    meta.className = "task-meta";
    meta.textContent = task.date ? `Due ${new Date(`${task.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No due date";
    copy.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "task-actions";
    const badge = document.createElement("span");
    const priority = ["high", "normal", "low"].includes(task.priority) ? task.priority : "normal";
    badge.className = `priority-badge ${priority === "normal" ? "" : priority}`;
    badge.textContent = priority === "high" ? "Important" : priority === "low" ? "Flexible" : "Normal";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "task-delete";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Delete task: ${task.title}`);
    remove.dataset.testid = `button-delete-task-${task.id}`;
    remove.addEventListener("click", () => {
      tasks = tasks.filter(entry => entry.id !== task.id);
      persistTasks();
      renderTasks();
    });
    actions.append(badge, remove);
    item.append(check, copy, actions);
    list.append(item);
  }
}
$("#planner-form")?.addEventListener("submit", event => {
  event.preventDefault();
  const titleInput = $("#task-title");
  const title = titleInput.value.trim();
  const error = $("#planner-error");
  if (!title) {
    error.textContent = "Add a short task name first.";
    titleInput.focus();
    return;
  }
  const date = $("#task-date").value;
  const now = new Date();
  const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  if (date && date < localToday) {
    error.textContent = "Choose today or a future date for this task.";
    $("#task-date").focus();
    return;
  }
  error.textContent = "";
  tasks.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, date, priority: $("#task-priority").value, done: false });
  if (persistTasks()) {
    event.currentTarget.reset();
    renderTasks();
    titleInput.focus();
  }
});
renderTasks();
