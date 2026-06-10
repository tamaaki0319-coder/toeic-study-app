const STORAGE_KEY = "toeic-study-records";
const ANALYTICS_KEY = "toeic-google-analytics-id";

const form = document.querySelector("#studyForm");
const analyticsForm = document.querySelector("#analyticsForm");
const analyticsId = document.querySelector("#analyticsId");
const analyticsStatus = document.querySelector("#analyticsStatus");
const clearAnalyticsButton = document.querySelector("#clearAnalyticsButton");
const studyDate = document.querySelector("#studyDate");
const studyMinutes = document.querySelector("#studyMinutes");
const studyMemo = document.querySelector("#studyMemo");
const toeicScore = document.querySelector("#toeicScore");
const totalHours = document.querySelector("#totalHours");
const studyDays = document.querySelector("#studyDays");
const latestScore = document.querySelector("#latestScore");
const studyChart = document.querySelector("#studyChart");
const records = document.querySelector("#records");
const recordCount = document.querySelector("#recordCount");
const recordTemplate = document.querySelector("#recordTemplate");
const resetButton = document.querySelector("#resetButton");

let studyRecords = loadRecords();

studyDate.valueAsDate = new Date();
analyticsId.value = loadAnalyticsId();
setupAnalytics(analyticsId.value);
renderAnalyticsStatus();
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const record = {
    id: crypto.randomUUID(),
    date: studyDate.value,
    minutes: Number(studyMinutes.value),
    memo: studyMemo.value.trim(),
    score: toeicScore.value ? Number(toeicScore.value) : null,
    createdAt: new Date().toISOString()
  };

  studyRecords.push(record);
  saveRecords();
  trackEvent("study_record_added", {
    study_minutes: record.minutes,
    has_score: record.score !== null
  });
  form.reset();
  studyDate.valueAsDate = new Date();
  render();
});

analyticsForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const measurementId = analyticsId.value.trim().toUpperCase();
  if (measurementId && !isValidMeasurementId(measurementId)) {
    alert("測定IDは G- から始まる形式で入力してください。例: G-XXXXXXXXXX");
    return;
  }

  saveAnalyticsId(measurementId);
  analyticsId.value = measurementId;
  setupAnalytics(measurementId);
  renderAnalyticsStatus();
});

clearAnalyticsButton.addEventListener("click", () => {
  saveAnalyticsId("");
  analyticsId.value = "";
  renderAnalyticsStatus();
});

records.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;

  studyRecords = studyRecords.filter((record) => record.id !== button.dataset.id);
  saveRecords();
  trackEvent("study_record_deleted");
  render();
});

resetButton.addEventListener("click", () => {
  if (studyRecords.length === 0) return;
  const confirmed = confirm("すべての記録を削除しますか？");
  if (!confirmed) return;

  studyRecords = [];
  saveRecords();
  render();
});

function loadRecords() {
  const rawRecords = localStorage.getItem(STORAGE_KEY);
  if (!rawRecords) return [];

  try {
    return JSON.parse(rawRecords);
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(studyRecords));
}

function loadAnalyticsId() {
  return localStorage.getItem(ANALYTICS_KEY) || "";
}

function saveAnalyticsId(measurementId) {
  if (measurementId) {
    localStorage.setItem(ANALYTICS_KEY, measurementId);
    return;
  }

  localStorage.removeItem(ANALYTICS_KEY);
}

function isValidMeasurementId(measurementId) {
  return /^G-[A-Z0-9]+$/.test(measurementId);
}

function setupAnalytics(measurementId) {
  if (!measurementId || !isValidMeasurementId(measurementId)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  if (!document.querySelector(`script[data-analytics-id="${measurementId}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.analyticsId = measurementId;
    document.head.append(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", measurementId);
}

function renderAnalyticsStatus() {
  const measurementId = loadAnalyticsId();
  analyticsStatus.textContent = measurementId ? "設定済み" : "未設定";
}

function trackEvent(eventName, parameters = {}) {
  const measurementId = loadAnalyticsId();
  if (!measurementId || typeof window.gtag !== "function") return;

  window.gtag("event", eventName, parameters);
}

function render() {
  const sortedRecords = [...studyRecords].sort((a, b) => {
    return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
  });

  renderSummary(sortedRecords);
  renderChart(sortedRecords);
  renderRecords(sortedRecords);
}

function renderSummary(sortedRecords) {
  const totalMinutes = sortedRecords.reduce((sum, record) => sum + record.minutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const uniqueDays = new Set(sortedRecords.map((record) => record.date)).size;
  const newestScore = sortedRecords.find((record) => record.score !== null);

  totalHours.textContent = minutes === 0 ? `${hours}時間` : `${hours}時間${minutes}分`;
  studyDays.textContent = `${uniqueDays}日`;
  latestScore.textContent = newestScore ? `${newestScore.score}点` : "未記録";
  recordCount.textContent = `${sortedRecords.length}件`;
}

function renderChart(sortedRecords) {
  studyChart.innerHTML = "";

  if (sortedRecords.length === 0) {
    studyChart.innerHTML = '<p class="chart-empty">まだ記録がありません</p>';
    return;
  }

  const dailyMinutes = groupByDate(sortedRecords)
    .slice(0, 7)
    .reverse();
  const maxMinutes = Math.max(...dailyMinutes.map((record) => record.minutes));

  dailyMinutes.forEach((record) => {
    const barWrap = document.createElement("div");
    const bar = document.createElement("div");
    const minutes = document.createElement("span");
    const date = document.createElement("span");

    barWrap.className = "bar-wrap";
    bar.className = "bar";
    minutes.className = "bar-minutes";
    date.className = "bar-date";

    bar.style.height = `${Math.max((record.minutes / maxMinutes) * 100, 8)}%`;
    bar.title = `${formatDate(record.date)}: ${record.minutes}分`;
    minutes.textContent = `${record.minutes}分`;
    date.textContent = formatShortDate(record.date);

    barWrap.append(bar, minutes, date);
    studyChart.append(barWrap);
  });
}

function groupByDate(sortedRecords) {
  const dailyMap = new Map();

  sortedRecords.forEach((record) => {
    const current = dailyMap.get(record.date) || { date: record.date, minutes: 0 };
    current.minutes += record.minutes;
    dailyMap.set(record.date, current);
  });

  return [...dailyMap.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function renderRecords(sortedRecords) {
  records.innerHTML = "";

  if (sortedRecords.length === 0) {
    records.innerHTML = '<p class="records-empty">学習したら、まず1件記録してみましょう。</p>';
    return;
  }

  sortedRecords.forEach((record) => {
    const item = recordTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector(".record-date").textContent = formatDate(record.date);
    item.querySelector(".record-date").dateTime = record.date;
    item.querySelector(".record-memo").textContent = record.memo || "メモなし";
    item.querySelector(".record-minutes").textContent = `${record.minutes}分`;
    item.querySelector(".record-score").textContent = record.score ? `${record.score}点` : "スコアなし";
    item.querySelector(".delete-button").dataset.id = record.id;
    records.append(item);
  });
}

function formatDate(dateText) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date(`${dateText}T00:00:00`));
}

function formatShortDate(dateText) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric"
  }).format(new Date(`${dateText}T00:00:00`));
}
