const FLOOR_LABEL = { B1: "지하1층", "1": "1층", "2": "2층", "3": "3층", "4": "4층", "5": "5층", UNK: "층 미확인" };
const FLOOR_ORDER = ["B1", "1", "2", "3", "4", "5", "UNK"];
const WING_ORDER = ["동관", "서관", "미확인"];
const WING_TITLE = { 동관: "동관 (1동)", 서관: "서관 (2동)", 미확인: "동·서 미확인" };
const TRADE_LABEL = {
  미용실: "미용실", 피부: "피부", 마사지: "마사지", 살롱: "살롱", 운동: "운동",
  의료: "병원·약국", 음식: "음식", 교육: "교육", 부동산: "부동산", 생활: "생활", 금융: "금융", 경영컨설팅: "경영컨설팅"
};
const UNKNOWN = "미확인";
/* 목록에 없는 가게를 적을 여유 칸 */
const BLANK_ROWS = 3;

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function tradeOf(shop) {
  return TRADE_LABEL[shop.trade || shop.category] || shop.category;
}

function roomNumber(ho) {
  const room = (ho.match(/\d+/g) || []).find((n) => n.length >= 3);
  return room ? Number(room) : Infinity;
}

function sortShops(list) {
  return list.slice().sort((a, b) => {
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

function shopRow(shop) {
  const unknown = shop.ho === UNKNOWN;
  const sign = shop.sign ? `<span class="sub">${esc(shop.sign)}</span>` : "";
  const tel = shop.phone ? esc(shop.phone) : `<span class="dash">—</span>`;
  return `<tr${unknown ? ' class="no-ho"' : ""}>
    <td class="c-check"><span class="box"></span></td>
    <td class="c-ho">${unknown ? "" : esc(shop.ho)}</td>
    <td class="c-name">${esc(shop.name)}${sign}</td>
    <td class="c-trade">${esc(tradeOf(shop))}</td>
    <td class="c-tel">${tel}</td>
    <td class="c-memo"></td>
  </tr>`;
}

function blankRows(n) {
  const cells = `<td class="c-check"><span class="box"></span></td>
    <td class="c-ho"></td><td class="c-name"></td>
    <td class="c-trade"></td><td class="c-tel"></td><td class="c-memo"></td>`;
  return Array.from({ length: n }, () => `<tr class="blank">${cells}</tr>`).join("");
}

/* 제목을 thead에 넣어야 구역이 페이지를 넘어갈 때 어느 층·관인지 다시 찍힌다 */
function block(title, rows, count, extra) {
  const keep = count + extra <= 8 ? " keep" : "";
  return `<table class="block${keep}">
    <thead>
      <tr class="title-row"><th colspan="6">${esc(title)}</th></tr>
      <tr>
        <th class="c-check">확인</th>
        <th class="c-ho">호수</th>
        <th class="c-name">상호</th>
        <th class="c-trade">업종</th>
        <th class="c-tel">전화</th>
        <th class="c-memo">메모 · 바뀐 점</th>
      </tr>
    </thead>
    <tbody>${rows}${blankRows(extra)}</tbody>
  </table>`;
}

const hoOk = SHOPS.filter((s) => s.ho !== UNKNOWN).length;
document.getElementById("stat").textContent =
  `실사 대상 ${SHOPS.length}곳 (호수 확인 ${hoOk} · 호수 미확인 ${SHOPS.length - hoOk}) · 위치 미확인 ${PENDING.length}곳`;

const parts = [];

FLOOR_ORDER.forEach((floor) => {
  const onFloor = SHOPS.filter((s) => s.floor === floor);
  if (!onFloor.length) return;
  WING_ORDER.forEach((wing) => {
    const list = onFloor.filter((s) => s.wing === wing);
    if (!list.length) return;
    const title = `${FLOOR_LABEL[floor]} · ${WING_TITLE[wing]} · ${list.length}곳`;
    parts.push(block(title, sortShops(list).map(shopRow).join(""), list.length, BLANK_ROWS));
  });
});

if (PENDING.length) {
  const rows = PENDING.map((p) => `<tr class="no-ho">
    <td class="c-check"><span class="box"></span></td>
    <td class="c-ho"></td>
    <td class="c-name">${esc(p.name)}<span class="sub">${esc(p.hint)}</span></td>
    <td class="c-trade"></td>
    <td class="c-tel"><span class="dash">—</span></td>
    <td class="c-memo"></td>
  </tr>`).join("");
  parts.push(`<p class="note">아래는 이 건물에 있다고만 알려진 곳입니다. 층·관·호수를 모두 현장에서 채워 주세요.</p>`);
  parts.push(block(`위치 미확인 · ${PENDING.length}곳`, rows, PENDING.length, BLANK_ROWS));
}

document.getElementById("sheet").innerHTML = parts.join("");
