const FLOOR_LABEL = { ALL: "전체", B1: "지하1층", "1": "1층", "2": "2층", "3": "3층", "4": "4층", "5": "5층", UNK: "층 미확인" };
const FLOOR_ORDER = ["B1", "1", "2", "3", "4", "5", "UNK"];
const FLOOR_KEYS = ["ALL"].concat(FLOOR_ORDER);
const WING_KEYS = ["ALL", "동관", "서관", "미확인"];
const WING_LABEL = { ALL: "전체", 동관: "동관", 서관: "서관", 미확인: "관 미확인" };
const WING_TITLE = { 동관: "동관 (1동)", 서관: "서관 (2동)", 미확인: "동·서 미확인" };
const WING_CLASS = { 동관: "east", 서관: "west", 미확인: "unknown" };
const TRADE_SECTIONS = [
  { parent: "뷰티", parentClass: "beauty", keys: ["미용실", "피부", "마사지", "살롱", "운동"] },
  { parent: "의료", parentClass: "", keys: ["의료"] },
  { parent: "음식", parentClass: "", keys: ["음식"] },
  { parent: "교육", parentClass: "", keys: ["교육"] },
  { parent: "부동산", parentClass: "", keys: ["부동산"] },
  { parent: "생활", parentClass: "", keys: ["생활"] },
  { parent: "금융", parentClass: "", keys: ["금융"] }
];
const TRADE_LABEL = {
  미용실: "미용실", 피부: "피부", 마사지: "마사지", 살롱: "살롱", 운동: "필라테스·운동",
  의료: "병원·약국", 음식: "음식", 교육: "교육", 부동산: "부동산", 생활: "생활", 금융: "금융"
};
const PENDING_TRADE_ORDER = ["미용실", "피부", "마사지", "살롱", "운동", "의료", "음식", "교육", "부동산", "생활", "금융"];
const TRADE_FILTER_KEYS = ["ALL"].concat(TRADE_SECTIONS.map((s) => s.parent));
const TRADE_FILTER_LABEL = { ALL: "전체" };
TRADE_SECTIONS.forEach((s) => { TRADE_FILTER_LABEL[s.parent] = s.parent; });
const UNKNOWN = "미확인";
/* 이보다 많이 걸리면 그룹을 접어서 목차처럼 보여준다. 모바일은 펼쳐서 바로 고르게 한다 */
const COMPACT_LIMIT = 20;
const MOBILE_MQ = "(max-width: 700px)";

function isMobileLayout() {
  return window.matchMedia(MOBILE_MQ).matches;
}

const startParams = new URLSearchParams(location.search);
let wing = "ALL";
let floor = "ALL";
let q = (startParams.get("q") || "").trim();
let focus = startParams.get("focus") === "ho" ? "ho" : "";
let survey = startParams.get("survey") === "1";
const tradeParam = startParams.get("trade") || "ALL";
let tradeFilter = TRADE_FILTER_KEYS.includes(tradeParam) ? tradeParam : "ALL";
/* null이면 결과 수에 따라 자동, true/false면 사용자가 직접 정한 값 */
let expandAll = null;

/* 같은 호수가 두 곳 이상이면 실사 때 헷갈리므로 행에 표시한다 */
const DUP_HOS = (() => {
  const n = new Map();
  SHOPS.forEach((s) => {
    if (s.ho === UNKNOWN) return;
    n.set(s.ho, (n.get(s.ho) || 0) + 1);
  });
  return new Set([...n.entries()].filter(([, c]) => c > 1).map(([h]) => h));
})();

const view = document.body.dataset.view === "trade" ? "trade" : "floor";
const PAGES = [
  { key: "floor", href: "index.html", label: "층별" },
  { key: "trade", href: "upjong.html", label: "업종별" }
];

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function mark(value, needle) {
  const safe = esc(value);
  if (!needle) return safe;
  const pattern = esc(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(pattern, "gi"), (hit) => `<mark>${hit}</mark>`);
}

function tradeOf(shop) {
  return shop.trade || shop.category;
}

function sectionOf(trade) {
  return TRADE_SECTIONS.find((s) => s.keys.includes(trade)) || TRADE_SECTIONS[TRADE_SECTIONS.length - 2];
}

function shopHaystack(shop) {
  return [shop.name, shop.sign, shop.phone, shop.address, shop.ho, shop.category, tradeOf(shop), shop.wing]
    .join(" ")
    .toLowerCase();
}

function pendingHaystack(item) {
  return `${item.name} ${item.hint}`.toLowerCase();
}

function matchShop(shop, cond) {
  if (cond.floor !== "ALL" && shop.floor !== cond.floor) return false;
  if (cond.wing !== "ALL" && shop.wing !== cond.wing) return false;
  if (cond.trade && cond.trade !== "ALL" && sectionOf(tradeOf(shop)).parent !== cond.trade) return false;
  if (cond.q && !shopHaystack(shop).includes(cond.q.toLowerCase())) return false;
  return true;
}

/* 지하1층 서관에서 B 접두 없이 114·123처럼 쓰인 호수 */
function isHoException(shop) {
  if (shop.floor !== "B1" || shop.ho === UNKNOWN) return false;
  if (shop.ho === "114" || shop.ho === "123") return true;
  if (shop.wing === "서관" && /^\d{3}$/.test(shop.ho)) return true;
  return false;
}

function telHref(phone) {
  return "tel:" + phone.replace(/[^0-9+]/g, "");
}

function unknownTag(text) {
  return `<span class="tag tag--unknown">${esc(text)}</span>`;
}

/* 호수 표기가 1-304, 301~303, 1-B101~B103처럼 섞여 있어 세 자리 방 번호만 뽑아 정렬한다.
   "동관 3층", "이마트 내"처럼 방 번호가 없으면 확인된 호수 뒤로 보낸다 */
function roomNumber(ho) {
  const room = (ho.match(/\d+/g) || []).find((n) => n.length >= 3);
  return room ? Number(room) : Infinity;
}

function sortShops(list) {
  return list.slice().sort((a, b) => {
    const byFloor = FLOOR_ORDER.indexOf(a.floor) - FLOOR_ORDER.indexOf(b.floor);
    if (byFloor !== 0) return byFloor;
    const aUnknown = a.ho === UNKNOWN ? 1 : 0;
    const bUnknown = b.ho === UNKNOWN ? 1 : 0;
    if (aUnknown !== bUnknown) return aUnknown - bUnknown;
    if (!aUnknown) {
      const byRoom = roomNumber(a.ho) - roomNumber(b.ho);
      if (byRoom !== 0) return byRoom;
    }
    return a.name.localeCompare(b.name, "ko");
  });
}

function pendingTrade(item) {
  const t = item.name + item.hint;
  if (/헤어|가이|미용/.test(t)) return "미용실";
  if (/살롱/.test(t)) return "살롱";
  if (/필라|피티|점핑/.test(t)) return "운동";
  if (/피부/.test(t)) return "피부";
  if (/학원|교습|국어|영어|피아노/.test(t)) return "교육";
  if (/공인중개|부동산/.test(t)) return "부동산";
  if (/정육|카페|오마뎅|블랑제리/.test(t)) return "음식";
  return "생활";
}

function queryString() {
  const p = new URLSearchParams();
  if (wing !== "ALL") p.set("wing", wing);
  if (floor !== "ALL") p.set("floor", floor);
  if (q) p.set("q", q);
  if (focus === "ho") p.set("focus", "ho");
  if (survey) p.set("survey", "1");
  if (tradeFilter !== "ALL") p.set("trade", tradeFilter);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function syncUrl() {
  try {
    history.replaceState(null, "", location.pathname + queryString());
  } catch (err) {
    /* file:// 등에서 replaceState가 막히면 무시한다 */
  }
}

document.getElementById("topbar").innerHTML = `
  <div class="topbar__inner">
    <nav class="page-nav" id="page-nav" aria-label="보기">
      ${PAGES.map((p) => `<a href="${p.href}" data-page="${p.key}"${p.key === view ? ' aria-current="page"' : ""}>${p.label}</a>`).join("")}
    </nav>
    <div class="search">
      <label class="sr-only" for="q">상호, 호수, 전화 검색</label>
      <input type="search" id="q" placeholder="상호·호수·전화 (예: B110, 약국)" autocomplete="off" enterkeyhint="search" />
      <button type="button" class="search__clear" id="q-clear" aria-label="검색어 지우기" hidden>&times;</button>
    </div>
    <div class="more" id="more-wrap">
      <button type="button" class="more__btn" id="more-btn" aria-expanded="false" aria-controls="more-panel" aria-haspopup="true">더보기</button>
      <div class="more__panel" id="more-panel" hidden>
        <button type="button" class="quick-btn" id="focus-ho" aria-pressed="false">호수 미확인 <span class="chip-count" id="ho-missing-n"></span></button>
        <button type="button" class="quick-btn" id="goto-pending">위치 미확인 <span class="chip-count" id="pending-n"></span></button>
        <button type="button" class="quick-btn" id="survey-toggle" aria-pressed="false">실사 모드</button>
        <a class="quick-link" href="survey.html" id="survey-link">실사표</a>
        <a class="quick-link" href="report.html" id="report-link">제보</a>
        <a class="quick-link" href="about.html">안내</a>
      </div>
    </div>
  </div>`;

document.getElementById("toolbar").innerHTML = `
  <div class="visitor-row">
    <button type="button" class="filter-open" id="filter-open" aria-expanded="false" aria-controls="filter-panel">
      필터 <span class="chip-count" id="filter-n" hidden></span>
    </button>
  </div>
  <div class="quick" id="quick-desk">
    <button type="button" class="quick-btn" id="focus-ho-desk" aria-pressed="false">호수 미확인 <span class="chip-count" id="ho-missing-n-desk"></span></button>
    <button type="button" class="quick-btn" id="goto-pending-desk">위치 미확인 <span class="chip-count" id="pending-n-desk"></span></button>
    <button type="button" class="quick-btn" id="survey-toggle-desk" aria-pressed="false">실사 모드</button>
    <a class="quick-link" href="survey.html" id="survey-link-desk">실사표</a>
    <a class="quick-link" href="report.html">제보</a>
  </div>
  <div class="filter-backdrop" id="filter-backdrop" hidden></div>
  <div class="filter-panel" id="filter-panel" hidden>
    <div class="filter-panel__head">
      <strong>필터</strong>
      <button type="button" class="filter-done" id="filter-done">완료</button>
    </div>
    <div class="menu">
      <div class="menu-label" id="trade-label">업종</div>
      <div class="chips chips--trade" id="trades" role="group" aria-labelledby="trade-label"></div>
    </div>
  </div>
  <p class="filter-compact" id="filter-compact" hidden></p>
  <p class="result-line" id="result-line" role="status" aria-live="polite"></p>`;

const searchInput = document.getElementById("q");
const clearBtn = document.getElementById("q-clear");
const tradeChips = document.getElementById("trades");
const toolbarEl = document.getElementById("toolbar");
const filterCompact = document.getElementById("filter-compact");
const filterPanel = document.getElementById("filter-panel");
const filterBackdrop = document.getElementById("filter-backdrop");
const filterOpenBtn = document.getElementById("filter-open");
const moreBtn = document.getElementById("more-btn");
const morePanel = document.getElementById("more-panel");
const navLinks = [...document.querySelectorAll("#page-nav a")];
const jumpBar = document.getElementById("jump");
const shopsHost = document.getElementById("shops");
const pendingHost = document.getElementById("pending");
const toTop = document.getElementById("to-top");

searchInput.value = q;

function setFilterOpen(on) {
  filterPanel.hidden = !on;
  filterBackdrop.hidden = !on;
  document.body.classList.toggle("filter-open", on);
  filterOpenBtn.setAttribute("aria-expanded", on ? "true" : "false");
}

function setMoreOpen(on) {
  morePanel.hidden = !on;
  moreBtn.setAttribute("aria-expanded", on ? "true" : "false");
  document.body.classList.toggle("more-open", on);
}

function goPending() {
  wing = "ALL";
  floor = "ALL";
  tradeFilter = "ALL";
  focus = "";
  q = "";
  searchInput.value = "";
  expandAll = true;
  setFilterOpen(false);
  update();
  requestAnimationFrame(() => {
    document.getElementById("pending-block")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function buildChips(host, keys, labelOf) {
  keys.forEach((key) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.key = key;
    btn.innerHTML = `<span class="chip-label"></span><span class="chip-count" aria-hidden="true"></span>`;
    btn.querySelector(".chip-label").textContent = labelOf(key);
    host.appendChild(btn);
  });
  host.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    tradeFilter = btn.dataset.key;
    focus = "";
    expandAll = null;
    update();
  });
}

buildChips(tradeChips, TRADE_FILTER_KEYS, (k) => TRADE_FILTER_LABEL[k]);

let debounce;
searchInput.addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    q = searchInput.value.trim();
    expandAll = null;
    update();
  }, 150);
});

clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  q = "";
  expandAll = null;
  searchInput.focus();
  update();
});

document.addEventListener("click", (e) => {
  if (e.target.closest('[data-action="reset"]')) {
    wing = "ALL";
    floor = "ALL";
    q = "";
    focus = "";
    survey = false;
    tradeFilter = "ALL";
    expandAll = null;
    searchInput.value = "";
    update();
    return;
  }
  if (e.target.closest('[data-action="focus-ho"]')) {
    focus = focus === "ho" ? "" : "ho";
    expandAll = null;
    update();
    return;
  }
  if (e.target.closest('[data-action="goto-pending"]')) {
    goPending();
  }
});

function toggleFocusHo() {
  focus = focus === "ho" ? "" : "ho";
  expandAll = null;
  setMoreOpen(false);
  update();
}
function toggleSurvey() {
  survey = !survey;
  expandAll = null;
  setMoreOpen(false);
  update();
}
document.getElementById("focus-ho").addEventListener("click", toggleFocusHo);
document.getElementById("focus-ho-desk").addEventListener("click", toggleFocusHo);
document.getElementById("goto-pending").addEventListener("click", () => { setMoreOpen(false); goPending(); });
document.getElementById("goto-pending-desk").addEventListener("click", goPending);
document.getElementById("survey-toggle").addEventListener("click", toggleSurvey);
document.getElementById("survey-toggle-desk").addEventListener("click", toggleSurvey);

filterOpenBtn.addEventListener("click", () => setFilterOpen(true));
filterCompact.addEventListener("click", (e) => {
  if (e.target.closest("[data-action='reset']")) return;
  if (isMobileLayout()) setFilterOpen(true);
});
document.getElementById("filter-done").addEventListener("click", () => setFilterOpen(false));
filterBackdrop.addEventListener("click", () => setFilterOpen(false));
moreBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setMoreOpen(morePanel.hidden);
});
document.addEventListener("click", (e) => {
  if (!morePanel.hidden && !e.target.closest("#more-wrap")) setMoreOpen(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!filterPanel.hidden) setFilterOpen(false);
  if (!morePanel.hidden) setMoreOpen(false);
});

function shopTable(list, mode) {
  if (!list.length) return `<p class="empty">없음</p>`;
  const isTrade = mode === "trade";
  const rows = sortShops(list).map((s) => {
    const phone = s.phone
      ? `<a class="tel tel-btn" href="${telHref(s.phone)}"><span class="tel-cta">전화하기</span><span class="tel-num">${mark(s.phone, q)}</span></a>`
      : `<span class="no-tel">전화 없음</span>`;
    const place = `<span class="card-place">${esc(FLOOR_LABEL[s.floor] || s.floor)} · ${s.wing === UNKNOWN ? "관 미확인" : esc(s.wing)}</span>`;
    const sign = s.sign ? `<span class="sign">${mark(s.sign, q)}</span>` : "";
    const trade = tradeOf(s);
    const leaf = !isTrade && sectionOf(trade).parent !== trade
      ? `<span class="meta">${mark(TRADE_LABEL[trade] || trade, q)}</span>`
      : "";
    const ho = s.ho === UNKNOWN ? unknownTag(UNKNOWN) : mark(s.ho, q);
    const dup = s.ho !== UNKNOWN && DUP_HOS.has(s.ho)
      ? `<span class="warn" title="같은 호수가 여러 곳에 있습니다">호수 중복</span>`
      : "";
    const hoEx = isHoException(s)
      ? `<span class="warn warn--info" title="지하1층 서관 호수는 보통 2-B로 시작합니다">호수 규칙 예외</span>`
      : "";
    const report = s.ho === UNKNOWN || (s.ho !== UNKNOWN && DUP_HOS.has(s.ho))
      ? ` <a class="report-link" href="report.html?shop=${encodeURIComponent(s.name)}${s.ho !== UNKNOWN ? `&ho=${encodeURIComponent(s.ho)}` : ""}">제보</a>`
      : "";
    const wingCell = s.wing === UNKNOWN ? unknownTag("관 미확인") : mark(s.wing, q);
    const lastCell = isTrade
      ? `<td data-label="층·관">${esc(FLOOR_LABEL[s.floor] || s.floor)} · ${wingCell}</td>`
      : "";
    const rowCls = [
      s.ho === UNKNOWN ? "row--no-ho" : "",
      s.ho !== UNKNOWN && DUP_HOS.has(s.ho) ? "row--dup" : ""
    ].filter(Boolean).join(" ");
    return `<tr${rowCls ? ` class="${rowCls}"` : ""}>
      <td data-label="상호" class="cell-name">${mark(s.name, q)}${sign}${leaf}</td>
      <td data-label="호수" class="cell-ho">${ho}${place}${dup}${hoEx}${report}</td>
      <td data-label="전화" class="phone">${phone}</td>
      ${lastCell}
    </tr>`;
  }).join("");
  const lastHead = isTrade ? "<th>층·관</th>" : "";
  return `<div class="table-wrap"><table class="t-shop${isTrade ? " t-trade" : ""}">
    <thead><tr><th>상호</th><th>호수</th><th>전화</th>${lastHead}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function pendingTable(list) {
  return `<div class="table-wrap"><table class="t-pending">
    <thead><tr><th>상호</th><th>메모</th></tr></thead>
    <tbody>${list.map((s) => `<tr>
      <td data-label="상호" class="cell-name">${mark(s.name, q)}</td>
      <td data-label="메모" class="cell-hint">${mark(s.hint, q)}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function emptyState(message) {
  return `<div class="empty-state">
    <p>${esc(message)}</p>
    <button type="button" class="reset" data-action="reset">조건 해제</button>
  </div>`;
}

/* 한 관(또는 한 업종)에 속한 목록을 대분류별 접이식 그룹으로 만든다 */
function tradeGroups(list, open) {
  return TRADE_SECTIONS.map((sec) => {
    const items = list.filter((s) => sec.keys.includes(tradeOf(s)));
    if (!items.length) return "";
    return `<details class="grp"${open ? " open" : ""}>
      <summary><span class="grp-name">${esc(sec.parent)}</span> <span class="count">${items.length}</span></summary>
      ${shopTable(items)}
    </details>`;
  }).join("");
}

function renderSummary() {
  const hoOk = SHOPS.filter((s) => s.ho !== UNKNOWN).length;
  const floorNo = SHOPS.filter((s) => s.floor === "UNK").length;
  const verified = typeof SITE !== "undefined" ? SITE.verifiedAt : "";
  document.getElementById("summary").innerHTML = [
    `전체 <b>${SHOPS.length}</b>곳`,
    `<button type="button" class="stat" data-action="focus-ho">호수 확인 <b>${hoOk}</b>/${SHOPS.length}</button>`,
    `<button type="button" class="stat" data-action="goto-pending">위치 미확인 <b>${PENDING.length}</b></button>`,
    verified ? `확인 <b>${verified}</b>` : "",
    floorNo ? `층 미확인 <b>${floorNo}</b>` : ""
  ].filter(Boolean).join(" · ");
}

function renderFooter() {
  const foot = document.querySelector("footer");
  if (!foot || typeof SITE === "undefined") return;
  const verified = SITE.verifiedAt;
  const left = foot.querySelector("span:first-child");
  if (left) {
    left.textContent = `${SITE.address} · 데이터 ${verified} · 비공식 안내`;
  }
}

function updateChips(host, keys, keyName) {
  const current = keyName === "wing" ? wing : keyName === "floor" ? floor : tradeFilter;
  [...host.children].forEach((btn) => {
    const key = btn.dataset.key;
    const cond = { wing, floor, trade: tradeFilter, q };
    cond[keyName] = key;
    const n = SHOPS.filter((s) => matchShop(s, cond)).length;
    btn.querySelector(".chip-count").textContent = String(n);
    btn.classList.toggle("active", key === current);
    btn.setAttribute("aria-pressed", key === current ? "true" : "false");
    btn.disabled = n === 0 && key !== current;
  });
}

function renderJump(sections, open) {
  if (sections.length < 2) {
    jumpBar.hidden = true;
    jumpBar.innerHTML = "";
    document.body.style.setProperty("--jump-h", "0px");
    return;
  }
  jumpBar.hidden = false;
  document.body.style.removeProperty("--jump-h");
  jumpBar.innerHTML = `
    <div class="jump__inner">
      <div class="jump__links">
        ${sections.map((s) => `<a href="#${s.id}" data-jump="${s.id}">${esc(s.label)} <span class="count">${s.count}</span></a>`).join("")}
      </div>
      <button type="button" class="toggle-all" id="toggle-all">${open ? "전체 접기" : "전체 펼치기"}</button>
    </div>`;
  document.getElementById("toggle-all").addEventListener("click", () => {
    expandAll = !open;
    update();
  });
}

let spy;

function watchSections(sections) {
  if (spy) spy.disconnect();
  if (!sections.length || jumpBar.hidden) return;
  const links = new Map([...jumpBar.querySelectorAll("[data-jump]")].map((a) => [a.dataset.jump, a]));
  const seen = new Set();
  spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => (en.isIntersecting ? seen.add(en.target.id) : seen.delete(en.target.id)));
    const first = sections.find((s) => seen.has(s.id));
    links.forEach((a, id) => a.classList.toggle("active", Boolean(first) && id === first.id));
  }, { rootMargin: "-140px 0px -60% 0px", threshold: 0 });
  sections.forEach((s) => {
    const el = document.getElementById(s.id);
    if (el) spy.observe(el);
  });
}

jumpBar.addEventListener("click", (e) => {
  const link = e.target.closest("[data-jump]");
  if (!link) return;
  e.preventDefault();
  const el = document.getElementById(link.dataset.jump);
  if (!el) return;
  if (el.tagName === "DETAILS") el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
});

function update() {
  if (!isMobileLayout()) {
    filterPanel.hidden = false;
    filterBackdrop.hidden = true;
    document.body.classList.remove("filter-open");
  } else if (!document.body.classList.contains("filter-open")) {
    filterPanel.hidden = true;
  }
  syncUrl();
  clearBtn.hidden = !q;
  document.body.classList.toggle("survey-mode", survey);
  const suffix = queryString();
  navLinks.forEach((a) => {
    const page = PAGES.find((p) => p.key === a.dataset.page);
    a.href = page.href + suffix;
  });
  document.getElementById("survey-link").href = "survey.html";
  document.getElementById("survey-link-desk").href = "survey.html";

  const hoMissing = SHOPS.filter((s) => s.ho === UNKNOWN).length;
  ["ho-missing-n", "ho-missing-n-desk"].forEach((id) => {
    document.getElementById(id).textContent = String(hoMissing);
  });
  ["pending-n", "pending-n-desk"].forEach((id) => {
    document.getElementById(id).textContent = String(PENDING.length);
  });
  ["focus-ho", "focus-ho-desk"].forEach((id) => {
    const el = document.getElementById(id);
    el.classList.toggle("active", focus === "ho");
    el.setAttribute("aria-pressed", focus === "ho" ? "true" : "false");
  });
  ["survey-toggle", "survey-toggle-desk"].forEach((id) => {
    const el = document.getElementById(id);
    el.classList.toggle("active", survey);
    el.setAttribute("aria-pressed", survey ? "true" : "false");
  });

  updateChips(tradeChips, TRADE_FILTER_KEYS, "trade");

  let shops = SHOPS.filter((s) => matchShop(s, { wing, floor, trade: tradeFilter, q }));
  if (focus === "ho") shops = shops.filter((s) => s.ho === UNKNOWN);
  const pendingAll = PENDING.filter((p) => !q || pendingHaystack(p).includes(q.toLowerCase()));
  const pendingOpen = wing === "ALL" && floor === "ALL";
  const mobile = isMobileLayout();
  const groupsOpen = mobile || Boolean(q) || focus === "ho" || survey || shops.length <= COMPACT_LIMIT;
  const open = expandAll === null ? groupsOpen : expandAll;

  document.getElementById("shop-count").textContent = `(${shops.length})`;
  document.getElementById("pending-count").textContent = `(${pendingAll.length})`;
  const bits = [];
  if (focus === "ho") bits.push("호수 미확인만");
  if (survey) bits.push("실사 모드");
  if (tradeFilter !== "ALL") bits.push(tradeFilter);
  if (wing !== "ALL" || floor !== "ALL" || q || tradeFilter !== "ALL") bits.push(`${shops.length}곳`);
  document.getElementById("result-line").textContent = bits.length
    ? bits.join(" · ") + (pendingOpen ? ` · 위치 미확인 ${pendingAll.length}곳` : "")
    : `전체 ${SHOPS.length}곳 · 위치 미확인 ${pendingAll.length}곳`;

  const hasFilter = wing !== "ALL" || floor !== "ALL" || tradeFilter !== "ALL" || q || focus === "ho";
  toolbarEl.classList.toggle("has-filter", hasFilter);

  const compact = [];
  if (tradeFilter !== "ALL") compact.push(tradeFilter);
  if (wing !== "ALL") compact.push(WING_LABEL[wing]);
  if (floor !== "ALL") compact.push(FLOOR_LABEL[floor]);
  if (focus === "ho") compact.push("호수 미확인");
  if (q) compact.push(`“${q}”`);
  const filterCount = (tradeFilter !== "ALL") + (wing !== "ALL") + (floor !== "ALL") + (focus === "ho");
  const filterN = document.getElementById("filter-n");
  filterN.textContent = String(filterCount);
  filterN.hidden = !filterCount;
  filterOpenBtn.classList.toggle("has-count", filterCount > 0);
  if (compact.length) {
    filterCompact.hidden = false;
    filterCompact.innerHTML = `<span>${esc(compact.join(" · "))} · ${shops.length}곳</span><button type="button" class="filter-clear" data-action="reset" aria-label="필터 해제">×</button>`;
  } else {
    filterCompact.hidden = true;
    filterCompact.textContent = "";
  }

  const pendingFab = document.getElementById("pending-fab");
  if (pendingFab) {
    pendingFab.hidden = !survey || pendingOpen || !pendingAll.length;
    document.getElementById("pending-fab-n").textContent = String(pendingAll.length);
  }

  const sections = [];

  if (!shops.length) {
    shopsHost.innerHTML = emptyState(focus === "ho" ? "호수 미확인 가게가 이 조건에 없습니다." : "이 조건에 해당하는 가게가 없습니다.");
  } else if (view === "trade") {
    shopsHost.innerHTML = TRADE_SECTIONS.map((sec, i) => {
      const inSection = shops.filter((s) => sec.keys.includes(tradeOf(s)));
      if (!inSection.length) return "";
      const id = `sec-${i}`;
      sections.push({ id, label: sec.parent, count: inSection.length });
      const parts = sec.keys.map((key) => {
        const items = inSection.filter((s) => tradeOf(s) === key);
        if (!items.length) return "";
        const sub = sec.keys.length > 1
          ? `<h4 class="sub-heading">${esc(TRADE_LABEL[key])} <span class="count">(${items.length})</span></h4>`
          : "";
        return `${sub}${shopTable(items, "trade")}`;
      }).join("");
      return `<details class="group-block" id="${id}"${open ? " open" : ""}>
        <summary class="group-heading ${sec.parentClass}">${esc(sec.parent)} <span class="count">${inSection.length}</span></summary>
        <div class="group-body">${parts}</div>
      </details>`;
    }).join("");
  } else {
    shopsHost.innerHTML = FLOOR_ORDER.filter((f) => shops.some((s) => s.floor === f)).map((f) => {
      const onFloor = shops.filter((s) => s.floor === f);
      const id = `sec-${f}`;
      sections.push({ id, label: FLOOR_LABEL[f], count: onFloor.length });
      const blocks = ["동관", "서관", UNKNOWN].map((w) => {
        const items = onFloor.filter((s) => s.wing === w);
        if (!items.length) return "";
        return `<div class="wing-block">
          <div class="table-title ${WING_CLASS[w]}">${WING_TITLE[w]} <span class="count">${items.length}</span></div>
          ${tradeGroups(items, open || mobile)}
        </div>`;
      }).filter(Boolean);
      const layout = blocks.length > 1 ? "tables" : "";
      return `<section class="floor-block" id="${id}">
        <h3 class="floor-heading">${esc(FLOOR_LABEL[f])} <span class="count">${onFloor.length}</span></h3>
        <div class="${layout}">${blocks.join("")}</div>
      </section>`;
    }).join("");
  }

  if (!pendingAll.length) {
    pendingHost.innerHTML = q
      ? `<p class="empty">검색어에 맞는 위치 미확인 항목이 없습니다.</p>`
      : `<p class="empty">위치 미확인 항목이 없습니다.</p>`;
  } else if (!pendingOpen) {
    pendingHost.innerHTML = `<p class="pending-banner">위치 미확인 <b>${pendingAll.length}</b>곳 · <button type="button" class="reset" data-action="goto-pending">전체 보기</button></p>`;
  } else if (view === "trade") {
    pendingHost.innerHTML = PENDING_TRADE_ORDER.map((key) => {
      const list = pendingAll.filter((s) => pendingTrade(s) === key);
      if (!list.length) return "";
      return `<details class="grp"${open ? " open" : ""}>
        <summary><span class="grp-name">${esc(TRADE_LABEL[key] || key)}</span> <span class="count">${list.length}</span></summary>
        ${pendingTable(list)}
      </details>`;
    }).join("");
  } else {
    pendingHost.innerHTML = open
      ? pendingTable(pendingAll)
      : `<details class="grp"><summary><span class="grp-name">위치 미확인</span> <span class="count">${pendingAll.length}</span></summary>${pendingTable(pendingAll)}</details>`;
  }

  if (survey) {
    jumpBar.hidden = true;
    jumpBar.innerHTML = "";
    document.body.style.setProperty("--jump-h", "0px");
  } else {
    renderJump(sections, open);
    watchSections(sections);
  }
}

toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
window.addEventListener("scroll", () => {
  const y = window.scrollY;
  document.body.classList.toggle("is-scrolled", y > 72);
  toTop.hidden = y < 600;
}, { passive: true });

const pendingFab = document.createElement("button");
pendingFab.type = "button";
pendingFab.className = "pending-fab";
pendingFab.id = "pending-fab";
pendingFab.hidden = true;
pendingFab.innerHTML = `위치 미확인 <span class="chip-count" id="pending-fab-n"></span>`;
pendingFab.addEventListener("click", goPending);
document.body.appendChild(pendingFab);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* 접힌 그룹은 인쇄되지 않으므로 인쇄 직전에 모두 펼친다 */
window.addEventListener("beforeprint", () => {
  document.querySelectorAll("details").forEach((d) => {
    d.dataset.wasOpen = d.open ? "1" : "";
    d.open = true;
  });
});
window.addEventListener("afterprint", () => {
  document.querySelectorAll("details").forEach((d) => {
    d.open = d.dataset.wasOpen === "1";
  });
});

renderSummary();
renderFooter();
update();
