"use strict";

// 서버 없이 실행하는 데모입니다. 금액은 모두 '이 기부자에게 배분된 금액'입니다.
const STORAGE_KEY = "ongi-demo-v1";
const organizations = [
  { id: "meal", name: "따뜻한 한 끼", region: "서울 성북구", description: "돌봄이 필요한 아이들에게 든든한 식사를 전합니다. 식재료 구입부터 도시락 전달까지, 매일의 식사를 함께합니다.", directRate: 90, since: "2021", icon: "meal" },
  { id: "learn", name: "내일을 그리는 아이들", region: "부산 영도구", description: "아이들이 배움의 기회를 놓치지 않도록 학용품과 교육 자료를 지원합니다. 작은 배움이 더 큰 내일로 이어집니다.", directRate: 85, since: "2020", icon: "book" }
];
const icons = {
  home: '<path d="m3 10 9-7 9 7v10H4V10"/><path d="M9 20v-7h6v7"/>',
  list: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  building: '<path d="M3 21h18M6 21V5l6-2 6 2v16M10 8h4M10 12h4M10 21v-5h4v5"/>',
  bell: '<path d="M5 16h14l-2-3V9a5 5 0 0 0-10 0v4l-2 3ZM10 20h4"/>',
  heart: '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 5 3 11 8 15 5-4 12-10 8-15Z"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8V5l14-3v3M21 11h-6v5h6M17 13.5h.1"/>',
  check: '<path d="m8 12 3 3 5-6"/><circle cx="12" cy="12" r="9"/>',
  meal: '<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-5 3-5 10 0 10"/>',
  book: '<path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1v15"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.heart}</svg>`;
const money = value => new Intl.NumberFormat("ko-KR").format(value);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const org = id => organizations.find(item => item.id === id);
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const seed = () => ({
  donations: [
    { id: "d1", orgId: "meal", amount: 100000, date: "2026-11-01" },
    { id: "d2", orgId: "learn", amount: 50000, date: "2026-11-05" }
  ],
  expenses: [
    { id: "e1", orgId: "meal", title: "아이들을 위한 신선한 식재료 구입", category: "식사 지원", amount: 45000, date: "2026-11-23", attachment: null },
    { id: "e2", orgId: "learn", title: "새 학기를 준비하는 학용품 전달", category: "교육 지원", amount: 30000, date: "2026-11-21", attachment: null },
    { id: "e3", orgId: "meal", title: "따뜻한 도시락 만들기", category: "식사 지원", amount: 30000, date: "2026-11-18", attachment: null }
  ],
  notifications: [
    { id: "n1", title: "따뜻한 마음이 한 끼의 식사가 되었어요", text: "따뜻한 한 끼에서 식재료 구입 내역 45,000원과 예시 증빙을 공개했어요.", date: "2026-11-23", read: false, expenseId: "e1" },
    { id: "n2", title: "아이들의 새로운 시작을 함께했어요", text: "내일을 그리는 아이들에서 학용품 지원 내역 30,000원과 예시 증빙을 공개했어요.", date: "2026-11-21", read: false, expenseId: "e2" }
  ]
});
// Each change gets its own key, so simultaneous tabs never replace a snapshot.
const CHANGE_PREFIX = `${STORAGE_KEY}:change:`;
const validId = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validText = value => typeof value === "string" && value.trim().length > 0;
function cleanState(value) {
  let repaired = false;
  const list = (name, clean) => {
    if (!Array.isArray(value?.[name])) { repaired = true; return []; }
    const seen = new Set();
    return value[name].flatMap(item => {
      const result = item && typeof item === "object" && clean(item);
      if (!result || seen.has(result.id)) { repaired = true; return []; }
      seen.add(result.id);
      return [result];
    });
  };
  const record = item => validId(item.id) && !!org(item.orgId) &&
    Number.isSafeInteger(item.amount) && item.amount > 0 && item.amount <= 1000000000 && validDate(item.date);
  const donations = list("donations", item => record(item) &&
    ({ id: item.id, orgId: item.orgId, amount: item.amount, date: item.date }));
  const expenses = list("expenses", item => {
    if (!record(item) || !validText(item.title) || item.title.length > 80 ||
      !["식사 지원", "교육 지원", "운영 지원"].includes(item.category)) return null;
    let attachment = null;
    if (item.attachment != null) {
      const a = item.attachment;
      if (typeof a === "object" && validText(a.name) &&
        ["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(a.type) &&
        typeof a.data === "string" && a.data.length <= 2800000 &&
        a.data.startsWith(`data:${a.type};base64,`) &&
        /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(a.data)) {
        attachment = { name: a.name, type: a.type, data: a.data };
      } else repaired = true;
    }
    return { id: item.id, orgId: item.orgId, amount: item.amount, date: item.date,
      title: item.title, category: item.category, attachment };
  });
  const notifications = list("notifications", item => validId(item.id) && validId(item.expenseId) &&
    validText(item.title) && validText(item.text) && validDate(item.date) && typeof item.read === "boolean" &&
    ({ id: item.id, expenseId: item.expenseId, title: item.title, text: item.text, date: item.date, read: item.read }));
  return { state: { donations, expenses, notifications }, repaired };
}
function loadState() {
  let repaired = false, base;
  const saved = localStorage.getItem(STORAGE_KEY);
  try { base = saved === null ? seed() : JSON.parse(saved); }
  catch { base = seed(); repaired = true; }
  const cleaned = cleanState(base);
  repaired ||= cleaned.repaired;
  const next = cleaned.state, readIds = new Set();
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CHANGE_PREFIX)) keys.push(key);
  }
  for (const key of keys.sort()) {
    try {
      const change = JSON.parse(localStorage.getItem(key));
      const cleanedChange = cleanState(change);
      repaired ||= cleanedChange.repaired;
      for (const name of ["donations", "expenses", "notifications"]) {
        for (const item of cleanedChange.state[name]) {
          if (!next[name].some(existing => existing.id === item.id)) next[name].unshift(item);
        }
      }
      if (!Array.isArray(change?.readIds) || !change.readIds.every(validId)) repaired = true;
      else change.readIds.forEach(id => readIds.add(id));
    } catch { repaired = true; }
  }
  next.notifications = next.notifications.filter(n => {
    if (!next.expenses.some(e => e.id === n.expenseId)) { repaired = true; return false; }
    if (readIds.has(n.id)) n.read = true;
    return true;
  });
  return { state: next, repaired };
}
let state, recoveryNeeded = false, storageAvailable = true;
try {
  const loaded = loadState();
  state = loaded.state;
  recoveryNeeded = loaded.repaired;
} catch { state = seed(); storageAvailable = false; }
const main = document.querySelector("#main");
const dialog = document.querySelector("#dialog");
let currentView = "home";
let toastTimer;
function toast(message) {
  const target = document.querySelector("#toast");
  target.textContent = message;
  target.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { target.hidden = true; }, 4500);
}
function commit(next, reportError = toast) {
  // Persist additions and read receipts only; never write an older full state.
  const change = { donations: [], expenses: [], notifications: [], readIds: [] };
  for (const name of ["donations", "expenses", "notifications"]) {
    change[name] = next[name].filter(item => !state[name].some(old => old.id === item.id));
  }
  change.readIds = next.notifications.filter(n => n.read && !state.notifications.find(old => old.id === n.id)?.read).map(n => n.id);
  try {
    const latest = loadState().state;
    for (const expense of change.expenses) {
      const balance = availableExpenseAmount(latest, expense.orgId, expense.date);
      if (expense.amount > balance) {
        state = latest;
        reportError(`다른 탭의 최신 기록을 확인했어요. ${expense.date}에 추가 등록 가능한 사용액은 ${money(balance)}원입니다.`);
        return false;
      }
      latest.expenses.push(expense);
    }
    localStorage.setItem(`${CHANGE_PREFIX}${Date.now()}-${uid()}`, JSON.stringify(change));
    state = loadState().state;
    storageAvailable = true;
  }
  catch { reportError("저장 공간이 부족하거나 저장이 차단되어 반영하지 못했어요. 더 작은 파일로 다시 시도해 주세요."); return false; }
  return true;
}
const sum = items => items.reduce((total, item) => total + item.amount, 0);
function availableExpenseAmount(data, orgId, date) {
  // A backdated expense must leave every later day's balance nonnegative too.
  // Dates have no time component, so donations and expenses on a day are netted.
  const daily = new Map([[date, 0]]);
  for (const [records, sign] of [[data.donations, 1], [data.expenses, -1]]) {
    for (const item of records) {
      if (item.orgId === orgId) daily.set(item.date, (daily.get(item.date) || 0) + sign * item.amount);
    }
  }
  let balance = 0, available = Infinity;
  for (const day of [...daily.keys()].sort()) {
    balance += daily.get(day);
    if (day >= date) available = Math.min(available, balance);
  }
  return Math.max(0, available);
}
const sortedExpenses = () => [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));
function pageHeading(title, description, action = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p class="subtitle">${description}</p></div>${action}</div>`;
}
function stats() {
  const donated = sum(state.donations), used = sum(state.expenses);
  const meals = Math.floor(sum(state.expenses.filter(e => e.category === "식사 지원")) / 5000);
  return `<div class="stats">
    <div class="stat"><div class="stat-top">누적 기부금<span class="stat-icon">${icon("wallet")}</span></div><div class="stat-value">${money(donated)}<small>원</small></div><div class="stat-note">${new Set(state.donations.map(d => d.orgId)).size}곳에 전한 따뜻한 마음</div></div>
    <div class="stat"><div class="stat-top">사용이 확인된 금액<span class="stat-icon">${icon("check")}</span></div><div class="stat-value">${money(used)}<small>원</small></div><div class="stat-note">기부금의 <strong>${donated ? Math.round(used / donated * 100) : 0}%</strong>가 사용되었어요</div></div>
    <div class="stat"><div class="stat-top">함께 만든 변화<span class="stat-icon">${icon("meal")}</span></div><div class="stat-value">${meals}<small>끼의 식사</small></div><div class="stat-note">식사 지원금 5,000원당 1끼로 추산</div></div>
  </div>`;
}
function expenseRow(item) {
  return `<article class="expense"><span class="expense-symbol ${item.category === "교육 지원" ? "blue" : ""}">${icon(org(item.orgId).icon)}</span><div class="expense-info"><h3>${escapeHTML(item.title)}</h3><div class="metadata">${org(item.orgId).name} · ${item.date}</div><span class="category-tag">${escapeHTML(item.category)}</span></div><div class="expense-side"><strong>${money(item.amount)}원</strong><button class="proof-button" data-proof="${item.id}">증빙 보기</button></div></article>`;
}
function distribution() {
  const total = sum(state.expenses);
  const colors = ["#31826a", "#a0bdb0", "#d4dfd6"];
  const categories = ["식사 지원", "교육 지원", "운영 지원"].map((name, i) => ({ name, amount: sum(state.expenses.filter(e => e.category === name)), color: colors[i] }));
  let cursor = 0;
  const stops = categories.map(c => { const start = cursor; cursor += total ? c.amount / total * 100 : 0; return `${c.color} ${start}% ${cursor}%`; }).join(",");
  return `<section class="card"><h2>어디에 쓰였을까요?</h2><div class="distribution"><div class="donut" style="background:${total ? `conic-gradient(${stops})` : "#edf1ed"}"><div class="donut-center">${state.expenses.length}건<small>확인된 사용 내역</small></div></div><div class="legend">${categories.map(c => `<div class="legend-row"><span><i class="legend-dot" style="background:${c.color}"></i>${c.name}</span><strong>${total ? Math.round(c.amount / total * 100) : 0}%</strong></div>`).join("")}</div></div><p class="card-note">내 기부금 중 사용이 등록된 금액의 항목별 비율이에요.</p></section>`;
}
const artwork = `<div class="hero-art" aria-hidden="true"><svg viewBox="0 0 220 190"><ellipse cx="117" cy="179" rx="83" ry="9" fill="#d4e3d6"/><path d="M112 133C49 125 48 81 67 71c20-10 37 10 45 25 7-26 27-44 46-34 28 15 5 57-46 71" fill="#78a087"/><path d="M112 159V103" stroke="#497b5d" stroke-width="4"/><path d="m108 150-28-24M114 127l27-24" stroke="#497b5d" stroke-width="3"/><path d="m31 146 19-21c9-10 22-8 32-1l30 20 31-10c17-6 24 9 10 16l-40 22c-10 6-18 4-27 0l-34-13-11 9" fill="#f9faf4"/><path d="m80 134 23 13c7 4 13-3 7-8" stroke="#d1dccb" stroke-width="2"/><path d="m30 144 17 20-14 18-23-22Z" fill="#31826a"/><circle cx="174" cy="32" r="4" fill="#d9b878"/><path d="m45 49 4-8 4 8 8 4-8 4-4 8-4-8-8-4Z" fill="#abc4ab"/><path d="m182 101 2-5 3 5 5 2-5 2-3 5-2-5-5-2Z" fill="#abc4ab"/></svg></div>`;
function home() {
  return pageHeading("내 마음이 닿은 곳", "보내주신 온기가 만들어 낸 변화를 확인해 보세요.", `<button class="button secondary" data-action="donate">${icon("plus")} 기부 기록 추가</button>`) +
    `<section class="hero"><div><div class="eyebrow">A LITTLE WARMTH, A REAL CHANGE</div><h2>당신의 작은 나눔이<br><strong>누군가의 오늘을 바꾸고 있어요.</strong></h2><p>기부금이 쓰인 순간부터, 그 뒤의 이야기까지.</p></div>${artwork}</section>` + stats() +
    `<div class="columns"><div><div class="section-heading"><div><h2>최근 기부금 사용 내역</h2><p>내 기부금이 꼭 필요한 곳에 전해졌어요.</p></div><a class="text-link" href="#history">전체 보기</a></div><section class="card">${sortedExpenses().slice(0, 4).map(expenseRow).join("") || '<p class="empty">아직 등록된 사용 내역이 없어요.</p>'}</section><div class="card progress-card"><span>${icon("heart")}</span><div><h3>아직 전해질 온기가 남아 있어요</h3><p>남은 ${money(sum(state.donations) - sum(state.expenses))}원의 사용 소식도 이곳에서 알려드릴게요.</p></div></div></div><div class="right-column">${distribution()}<section class="card"><div class="section-heading"><h2>새로운 소식</h2><a class="text-link" href="#notifications">모두 보기</a></div>${state.notifications.slice(0, 2).map(n => `<div class="update"><span>${icon("heart")}</span><div><p>${escapeHTML(n.title)}</p><small>${n.date}</small></div></div>`).join("") || '<p class="empty">새로운 소식을 기다리고 있어요.</p>'}</section></div></div>`;
}
function history() {
  return pageHeading("나의 기부 기록", "나눔의 시작부터 사용된 순간까지, 한곳에서 확인하세요.", '<button class="button" data-action="donate">기부 기록 추가</button>') + stats() +
    `<section class="card"><div class="section-heading"><div><h2>기부금 사용 내역</h2><p>금액은 내 기부금에 배분된 사용액입니다.</p></div><button class="button secondary small" data-action="expense">증빙 등록 · 데모</button></div><div class="toolbar"><input id="search" type="search" placeholder="사용 내역 검색" aria-label="사용 내역 검색"><select id="org-filter" aria-label="기부처 필터"><option value="">모든 기부처</option>${orgOptions()}</select><select id="category-filter" aria-label="지원 항목 필터"><option value="">모든 항목</option>${["식사 지원", "교육 지원", "운영 지원"].map(c => `<option>${c}</option>`).join("")}</select></div><div id="expense-list">${sortedExpenses().map(expenseRow).join("")}</div></section>
    <section class="card"><div class="section-heading"><h2>보낸 마음의 기록</h2></div><div class="table-wrap"><table><thead><tr><th>기부일</th><th>기부처</th><th>기부 금액</th><th>기록</th></tr></thead><tbody>${[...state.donations].sort((a, b) => b.date.localeCompare(a.date)).map(d => `<tr><td>${d.date}</td><td>${org(d.orgId).name}</td><td><strong>${money(d.amount)}원</strong></td><td>기부 기록</td></tr>`).join("")}</tbody></table></div><p class="card-note">직접 입력한 기록이며, 실제 결제나 기부금 영수증 발급은 이루어지지 않아요.</p></section>`;
}
function organizationsView() {
  return pageHeading("기부처 알아보기", "기부처의 활동과 사용 비율을 나란히 살펴보세요.") +
    `<div class="organizations">${organizations.map(o => `<section class="card"><div class="org-top"><span class="org-logo">${icon(o.icon)}</span><div><h2>${o.name}</h2><div class="metadata">${icon("pin")} ${o.region} · 가상 기부처</div></div></div><p class="org-description">${o.description}</p><div class="org-numbers"><div>직접 사업비 비율<strong>${o.directRate}%</strong></div><div>운영비 비율<strong>${100 - o.directRate}%</strong></div><div>활동 시작<strong>${o.since}년</strong></div></div><div class="progress"><span style="width:${o.directRate}%"></span></div><p class="card-note">기부처 전체 예산 기준 예시 비율 · 내 기부금 사용률과 별개입니다.</p><div class="org-numbers" style="margin:22px 0"><div>내 누적 기부금<strong>${money(sum(state.donations.filter(d => d.orgId === o.id)))}원</strong></div><div>공개된 내 사용 내역<strong>${state.expenses.filter(e => e.orgId === o.id).length}건</strong></div></div><button class="button secondary" data-donate-org="${o.id}">이 기부처에 기록 추가</button></section>`).join("")}</div><p class="card-note">이름, 활동 이력 및 비율은 기능을 보여주기 위한 예시이며 실제 단체를 평가한 정보가 아닙니다.</p>`;
}
function notificationsView() {
  return pageHeading("알림", "내 기부금이 사용되면 새로운 소식을 전해드려요.", '<button class="button secondary" data-action="read-all">모두 읽음</button>') +
    `<section class="card">${state.notifications.map(n => `<article class="notification ${n.read ? "" : "unread"}"><span class="icon-wrap">${icon("bell")}</span><div><h3>${escapeHTML(n.title)}</h3><p>${escapeHTML(n.text)}</p><div class="metadata">${n.date} · ${n.read ? "읽음" : "새 알림"}</div><button class="text-link" data-notification="${n.id}">사용 내역 확인</button></div></article>`).join("") || '<p class="empty">아직 알림이 없어요.</p>'}</section><p class="card-note">데모에서는 이 브라우저에서 증빙을 등록하면 앱 안 알림이 생성됩니다. 앱이 닫혀 있을 때 보내는 푸시 알림은 지원하지 않습니다.</p>`;
}
function render() {
  const view = location.hash.slice(1) || "home";
  currentView = ["home", "history", "organizations", "notifications"].includes(view) ? view : "home";
  main.innerHTML = ({ home, history, organizations: organizationsView, notifications: notificationsView })[currentView]();
  document.querySelectorAll("[data-nav]").forEach(a => { a.classList.toggle("active", a.dataset.nav === currentView); if (a.dataset.nav === currentView) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  const unread = state.notifications.filter(n => !n.read).length;
  document.querySelector("#nav-badge").textContent = unread || "";
  document.querySelector("#unread-dot").hidden = !unread;
}
function orgOptions(selected = "") { return organizations.map(o => `<option value="${o.id}" ${o.id === selected ? "selected" : ""}>${o.name}</option>`).join(""); }
function openDialog(title, content) {
  document.querySelector("#dialog-title").textContent = title;
  document.querySelector("#dialog-content").innerHTML = content;
  dialog.showModal();
}
function openForm(type, selected = "meal") {
  const expense = type === "expense";
  openDialog(expense ? "사용 내역과 증빙 등록" : "기부 기록 추가", `<form id="record-form" data-type="${type}"><p class="form-note">${expense ? "기부처 담당자의 등록 과정을 체험하는 데모입니다. 내 기부금에서 사용된 금액만 입력해 주세요." : "이미 기부한 내역을 직접 기록해 보세요. 실제 결제는 진행되지 않습니다."}</p>
    <label class="form-field">기부처<select name="orgId">${orgOptions(selected)}</select></label>
    ${expense ? `<label class="form-field">사용 내용<input name="title" required maxlength="80" placeholder="예: 아이들을 위한 식재료 구입"></label><label class="form-field">사용 항목<select name="category"><option>식사 지원</option><option>교육 지원</option><option>운영 지원</option></select></label>` : ""}
    <label class="form-field">${expense ? "사용" : "기부"} 금액 (원)<input name="amount" type="number" min="1" max="1000000000" step="1" required placeholder="예: 10000"></label>
    <label class="form-field">${expense ? "사용일" : "기부일"}<input name="date" type="date" required value="${today()}" max="${today()}"></label>
    ${expense ? '<label class="form-field">사진 또는 영수증<input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required><small>JPG, PNG, WebP 또는 PDF · 최대 2MB · 이 브라우저에만 저장됩니다. 개인정보가 없는 샘플 파일을 사용해 주세요.</small></label>' : ""}
    <p id="form-error" class="form-error" role="alert"></p><button class="button form-submit" type="submit">${expense ? "사용 내역 등록" : "기부 기록 저장"}</button></form>`);
}
function showProof(id) {
  const e = state.expenses.find(item => item.id === id);
  if (!e) return;
  const a = e.attachment;
  const safeAttachment = a && /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(a.data);
  openDialog("기부금 사용 증빙", `<div class="receipt"><p class="receipt-title">${a ? "사용 내역 확인서" : "예시 사용 내역서"}</p><p class="card-note" style="text-align:center">${org(e.orgId).name}</p><dl><div><dt>사용일</dt><dd>${e.date}</dd></div><div><dt>활동 지역</dt><dd>${org(e.orgId).region}</dd></div><div><dt>사용 내용</dt><dd>${escapeHTML(e.title)}</dd></div><div><dt>지원 항목</dt><dd>${escapeHTML(e.category)}</dd></div><div><dt>내 기부금 사용액</dt><dd><strong>${money(e.amount)}원</strong></dd></div></dl></div>${safeAttachment ? (a.type.startsWith("image/") ? `<img class="proof-image" src="${a.data}" alt="${escapeHTML(a.name)}">` : "") + `<a class="attachment-link" href="${a.data}" download="${escapeHTML(a.name)}">첨부 증빙 다운로드 · ${escapeHTML(a.name)}</a>` : ""}<p class="proof-disclaimer">${a ? "등록자가 첨부한 자료입니다. 앱에서 진위 여부를 검증하지 않습니다." : "기능 시연을 위해 만든 예시 내역입니다. 실제 영수증이나 현장 사진이 아닙니다. 나의 기부 기록에서 사진·영수증 등록을 체험할 수 있어요."}</p>`);
}
async function submitRecord(event) {
  if (event.target.id !== "record-form") return;
  event.preventDefault();
  const form = event.target, data = new FormData(form), expense = form.dataset.type === "expense";
  const error = message => { form.querySelector("#form-error").textContent = message; };
  const amount = Number(data.get("amount")), orgId = data.get("orgId"), date = data.get("date");
  if (!org(orgId) || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000) return error("금액은 1원부터 10억 원까지 정수로 입력해 주세요.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) return error("오늘까지의 올바른 날짜를 선택해 주세요.");
  if (expense && amount > availableExpenseAmount(state, orgId, date)) return error(`${date}에 추가 등록 가능한 사용액은 ${money(availableExpenseAmount(state, orgId, date))}원입니다. 사용일 당시 잔액과 이후 사용 내역을 확인해 주세요.`);
  if (expense && !String(data.get("title")).trim()) return error("사용 내용을 입력해 주세요.");
  if (expense && !state.donations.some(d => d.orgId === orgId && d.date <= date)) return error("해당 기부처에 처음 기부한 날 이후의 사용일을 선택해 주세요.");
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  try {
    let attachment = null;
    if (expense) {
      const file = data.get("attachment");
      if (!file?.size || file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) { error("2MB 이하의 JPG, PNG, WebP 또는 PDF 파일을 선택해 주세요."); return; }
      const content = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      attachment = { name: file.name, type: file.type, data: content };
    }
    const next = structuredClone(state), id = uid();
    if (expense) {
      next.expenses.unshift({ id, orgId, amount, date, title: String(data.get("title")).trim(), category: data.get("category"), attachment });
      next.notifications.unshift({ id: uid(), title: "새로운 기부금 사용 내역이 도착했어요", text: `${org(orgId).name}에서 ${money(amount)}원의 사용 내역과 증빙을 등록했어요.`, date: today(), read: false, expenseId: id });
    } else next.donations.unshift({ id, orgId, amount, date });
    if (!commit(next, error)) return;
    dialog.close();
    render();
    toast(expense ? "사용 내역과 증빙을 저장했어요. 새 알림도 확인해 보세요." : "기부 기록을 저장했어요.");
  } catch { error("파일을 읽거나 저장하지 못했어요. 다시 시도해 주세요."); }
  finally { submit.disabled = false; }
}
function filterExpenses() {
  if (currentView !== "history") return;
  const search = document.querySelector("#search").value.trim().toLowerCase(), orgId = document.querySelector("#org-filter").value, category = document.querySelector("#category-filter").value;
  const items = sortedExpenses().filter(e => (!orgId || e.orgId === orgId) && (!category || e.category === category) && `${e.title} ${org(e.orgId).name}`.toLowerCase().includes(search));
  document.querySelector("#expense-list").innerHTML = items.map(expenseRow).join("") || '<p class="empty">조건에 맞는 사용 내역이 없어요.</p>';
}
document.addEventListener("click", event => {
  const target = event.target.closest("button,[data-donate-org]");
  if (!target) return;
  if (target.dataset.proof) showProof(target.dataset.proof);
  if (target.dataset.donateOrg) openForm("donation", target.dataset.donateOrg);
  if (target.dataset.action === "donate") openForm("donation");
  if (target.dataset.action === "expense") openForm("expense");
  if (target.dataset.action === "read-all") {
    const next = structuredClone(state); next.notifications.forEach(n => { n.read = true; });
    if (commit(next)) { render(); toast("모든 알림을 읽음으로 표시했어요."); }
  }
  if (target.dataset.notification) {
    const next = structuredClone(state), notification = next.notifications.find(n => n.id === target.dataset.notification);
    if (notification) { notification.read = true; if (commit(next)) render(); showProof(notification.expenseId); }
  }
});
document.addEventListener("input", event => { if (["search", "org-filter", "category-filter"].includes(event.target.id)) filterExpenses(); });
document.addEventListener("change", event => { if (["org-filter", "category-filter"].includes(event.target.id)) filterExpenses(); });
document.addEventListener("submit", submitRecord);
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
document.querySelector("#notification-button").addEventListener("click", () => { location.hash = "notifications"; });
window.addEventListener("hashchange", render);
window.addEventListener("storage", event => {
  if (event.key !== null && event.key !== STORAGE_KEY && !event.key.startsWith(CHANGE_PREFIX)) return;
  try {
    state = loadState().state;
    const search = document.querySelector("#search")?.value;
    const orgFilter = document.querySelector("#org-filter")?.value;
    const categoryFilter = document.querySelector("#category-filter")?.value;
    render();
    if (currentView === "history") {
      document.querySelector("#search").value = search || "";
      document.querySelector("#org-filter").value = orgFilter || "";
      document.querySelector("#category-filter").value = categoryFilter || "";
      filterExpenses();
    }
  } catch { toast("다른 탭의 변경 내용을 불러오지 못했어요. 다시 열어 주세요."); }
});
document.querySelectorAll("[data-icon]").forEach(el => { el.innerHTML = icon(el.dataset.icon); });
render();
if (!storageAvailable) toast("저장된 데이터를 불러오지 못해 예시 데이터로 표시합니다. 브라우저 저장 설정을 확인해 주세요.");
else if (recoveryNeeded) toast("저장 데이터에 문제가 있어 복구 가능한 기록을 불러왔어요. 읽을 수 없는 경우 예시 데이터를 표시하며, 원본은 보존했습니다.");
