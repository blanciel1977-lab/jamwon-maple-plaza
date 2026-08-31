/* 방문 수치 수집.
   goatcounter.com에서 사이트를 만든 뒤 code에 사이트 코드만 넣으면 켜진다.
   비워 두면 바깥으로 아무 요청도 보내지 않는다.

   누적 수치를 푸터에 표시하려면 GoatCounter 설정에서
   "Allow adding visitor counts on your website"를 켜야 한다. */
const COUNTER = {
  code: "",       // 예: "jamwon-maple" → https://jamwon-maple.goatcounter.com
  base: "",       // GoatCounter를 직접 띄워 쓸 때만 전체 주소. 보통 비워 둔다
  showTotal: true // 푸터에 누적 조회수 표시
};

(function () {
  const base = (COUNTER.base || "").trim().replace(/\/$/, "")
    || (COUNTER.code || "").trim() && `https://${COUNTER.code.trim()}.goatcounter.com`;
  if (!base) return;

  /* count.js는 localhost를 세지 않으므로 로컬에서 시험해도 수치가 오르지 않는다 */
  const tag = document.createElement("script");
  tag.async = true;
  tag.src = "https://gc.zgo.at/count.js";
  tag.setAttribute("data-goatcounter", `${base}/count`);
  document.head.appendChild(tag);

  const box = document.getElementById("hits");
  if (!COUNTER.showTotal || !box) return;

  fetch(`${base}/counter/TOTAL.json`)
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((data) => {
      const n = Number(String(data.count).replace(/[^0-9]/g, ""));
      if (!n) return;
      box.textContent = `누적 조회 ${n.toLocaleString("ko-KR")}회`;
      box.hidden = false;
    })
    .catch(() => {
      /* 수치를 못 받아도 안내 목록은 그대로 쓸 수 있어야 한다 */
    });
})();
