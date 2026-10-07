/* 캐릭터 외형 커스터마이징: 옵션 정의, 캐릭터 그리기, 선택 UI (로그인 화면과 캐릭터 시트가 함께 씁니다) */
(function () {
  /* 저장 형식: "피부,눈모양,눈동자,머리,상의,하의,신발" 각 0~4 (서버 LOOK 컬럼, 빈 값이면 기본 외형) */
  var SKIN_COLORS = ["#f7d9bf", "#f0c8a4", "#e3b08a", "#c68a5e", "#8d5a3b"];
  var EYE_COLORS = ["#1a1a2a", "#6b3f1f", "#2f6fd6", "#2f9a5a", "#8a4fd0"];
  /* 상의: color 는 옷 색("currentColor" 는 소속 팀 색), 나머지는 디테일 종류 */
  var TOPS = [
    { color: "currentColor", jacket: true },
    { color: "#eef1f8", tie: true },
    { color: "#7a8294", hood: true },
    { color: "#d98a4a", stripe: "#f3c58a" },
    { color: "#4f8a6a", inner: "#f1f3f8" }
  ];
  var BOTTOMS = [{ color: "#2a3050" }, { color: "#3e6fb0" }, { color: "#a89868" }, { color: "#4a5568", shorts: true }, { color: "#b2506a", skirt: true }];
  var SHOES = [{ color: "#f2f2f2", sole: "#9aa3b5" }, { color: "#1b1b22", sole: "#000" }, { color: "#6b4226", boot: true }, { color: "#8a5a35" }, { color: "#e0a35a" }];

  /* 선택 화면의 7개 줄. 순서가 저장 형식(위 주석)의 순서와 같습니다. */
  var GROUPS = [
    { name: "피부색", labels: ["밝은", "보통", "햇볕", "갈색", "짙은"], swatch: SKIN_COLORS },
    { name: "눈모양", labels: ["동그란", "졸린", "날카로운", "웃는", "큰 눈"] },
    { name: "눈동자색", labels: ["검정", "갈색", "파랑", "초록", "보라"], swatch: EYE_COLORS },
    { name: "머리", labels: { m: ["단정", "각진", "가르마", "짧은", "볼륨"], f: ["긴 머리", "단발", "포니테일", "웨이브", "숏컷"] } },
    { name: "상의", labels: ["재킷", "셔츠", "후드티", "니트", "가디건"] },
    { name: "하의", labels: ["슬랙스", "청바지", "카키", "반바지", "치마"] },
    { name: "신발", labels: ["운동화", "구두", "부츠", "로퍼", "샌들"] }
  ];
  var DEFAULT_LOOK = [1, 0, 0, 0, 0, 0, 0];

  /* "1,0,2,3,4,0,1" 문자열을 숫자 7개 배열로 바꿉니다. 형식이 틀리면 null(기본 외형) */
  function parseLook(text) {
    if (typeof text !== "string" || !/^[0-4](,[0-4]){6}$/.test(text)) return null;
    return text.split(",").map(Number);
  }

  /* #rrggbb 색을 factor 배(0~1이면 어둡게)로 바꿉니다. 그 외 색 값은 그대로 돌려줍니다. */
  function darken(hex, factor) {
    var match = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!match) return hex;
    var rgb = parseInt(match[1], 16);
    function toHex(channel) { return ("0" + Math.max(0, Math.min(255, Math.round(channel * factor))).toString(16)).slice(-2); }
    return "#" + toHex(rgb >> 16 & 255) + toHex(rgb >> 8 & 255) + toHex(rgb & 255);
  }

  /* 메이플스토리풍 2등신 캐릭터를 28x40 좌표계의 도형 목록으로 만듭니다. 앞에 있는 도형이 뒤에 깔립니다.
     도형: { path(SVG path 문자열), fill(채움 색), stroke(선 색), strokeWidth(선 굵기), opacity(투명도) }
     canvas 는 Path2D(path), SVG 는 <path d> 로 같은 문자열을 그대로 씁니다.
     look: parseLook 결과(숫자 7개), female: 여자 여부, step: 걸음 모양(0 정지, 1·2 걸음)
     options: { hair: 머리색, crown: 왕관 여부, senior: 넥타이 여부 } */
  function rects(look, female, step, options) {
    options = options || {};
    var shapes = [];
    var skinColor = SKIN_COLORS[look[0]], eyeShape = look[1], eyeColor = EYE_COLORS[look[2]], hairStyle = look[3];
    var topStyle = TOPS[look[4]], bottomStyle = BOTTOMS[look[5]], shoeStyle = SHOES[look[6]];
    var hairColor = options.hair || "#2d2320", hairShadow = darken(hairColor, 0.72);
    var TEAM_COLOR = "currentColor", CROWN_COLOR = "#f4c95d", OUTLINE_COLOR = "#3a2a30";

    /* 도형 추가: 채우기 / 외곽선 있는 채우기 / 선 */
    function addFill(path, color, opacity) { shapes.push({ path: path, fill: color, opacity: opacity || 1 }); }
    function addOutlinedFill(path, color, lineWidth) { shapes.push({ path: path, fill: color, stroke: OUTLINE_COLOR, strokeWidth: lineWidth || 0.6, opacity: 1 }); }
    function addLine(path, color, lineWidth, opacity) { shapes.push({ path: path, stroke: color, strokeWidth: lineWidth, opacity: opacity || 1 }); }
    /* path 문자열 만들기: 둥근 사각형 / 타원 / 소수 첫째 자리 반올림 */
    function roundedRectPath(x, y, width, height, radius) {
      return "M" + (x + radius) + " " + y + "H" + (x + width - radius) + "Q" + (x + width) + " " + y + " " + (x + width) + " " + (y + radius) +
        "V" + (y + height - radius) + "Q" + (x + width) + " " + (y + height) + " " + (x + width - radius) + " " + (y + height) +
        "H" + (x + radius) + "Q" + x + " " + (y + height) + " " + x + " " + (y + height - radius) +
        "V" + (y + radius) + "Q" + x + " " + y + " " + (x + radius) + " " + y + "Z";
    }
    function ellipsePath(centerX, centerY, radiusX, radiusY) {
      return "M" + (centerX - radiusX) + " " + centerY + "A" + radiusX + " " + radiusY + " 0 1 0 " + (centerX + radiusX) + " " + centerY +
        "A" + radiusX + " " + radiusY + " 0 1 0 " + (centerX - radiusX) + " " + centerY + "Z";
    }
    function round1(number) { return Math.round(number * 10) / 10; }

    /* 바닥 그림자 */
    addFill(ellipsePath(14, 38.7, 8.5, 1.2), "#000", 0.3);

    /* 뒷머리 (머리 뒤로 보이는 부분) */
    if (female) {
      if (hairStyle === 0) addOutlinedFill("M2.8 14C1.6 4.4 7.4 1 14 1S26.4 4.4 25.2 14L26.4 28Q14 31.4 1.6 28Z", hairColor);
      else if (hairStyle === 1) addOutlinedFill("M2.6 14C1.6 4.4 7.4 1 14 1S26.4 4.4 25.4 14L25.8 22.6Q22 25 18 23.2L10 23.2Q6 25 2.2 22.6Z", hairColor);
      else if (hairStyle === 2) {
        addOutlinedFill("M23 5.5C28.4 5.5 29.8 12 27.8 18.6C26.8 21.4 25 20.8 25.6 17.8C26.4 14 25.4 11.4 22.6 10Z", hairColor);
        addOutlinedFill(ellipsePath(23.2, 7.2, 1.4, 1.4), "#e0607a", 0.5);
      } else if (hairStyle === 3) {
        addOutlinedFill("M2.4 14C0.6 4 7 0.8 14 0.8S27.4 4 25.6 14C27.6 16.6 24.4 18.6 26.6 21.4C28.4 23.8 25.2 25 26.2 27.4C27 29.4 24.2 30.4 22.2 29C20.6 27.8 19 30.6 16.8 29.6C15.4 29 14.8 28.6 14 28.8C13.2 28.6 12.6 29 11.2 29.6C9 30.6 7.4 27.8 5.8 29C3.8 30.4 1 29.4 1.8 27.4C2.8 25 -0.4 23.8 1.4 21.4C3.6 18.6 0.4 16.6 2.4 14Z", hairColor);
      } else addOutlinedFill("M3 14C2.2 4.6 7 1.2 14 1.2S25.8 4.6 25 14L24.8 19.6Q14 22.6 3.2 19.6Z", hairColor);
    } else if (hairStyle === 4) {
      addOutlinedFill("M1.6 14C0.2 4 6.6 -0.2 14 -0.2S27.8 4 26.4 14Q14 12.6 1.6 14Z", hairColor);
    }

    /* 다리·하의·신발 (짧고 통통하게). 걸을 때는 한쪽 발이 lift 만큼 올라갑니다. */
    [{ centerX: 10.6, lift: step === 1 ? 2 : 0 }, { centerX: 17.4, lift: step === 2 ? 2 : 0 }].forEach(function (leg) {
      var centerX = leg.centerX, lift = leg.lift;
      if (bottomStyle.shorts) {
        addOutlinedFill(roundedRectPath(centerX - 1.8, 32.4, 3.6, 4, 1.4), skinColor, 0.5);
        addOutlinedFill(roundedRectPath(centerX - 2.1, 31.6, 4.2, 3.2, 1.4), bottomStyle.color, 0.5);
      } else if (bottomStyle.skirt) addOutlinedFill(roundedRectPath(centerX - 1.7, 32.4, 3.4, 4, 1.4), skinColor, 0.5);
      else addOutlinedFill(roundedRectPath(centerX - 2, 31.6, 4, 5, 1.6), bottomStyle.color, 0.5);
      if (shoeStyle.boot) addOutlinedFill(roundedRectPath(centerX - 2.2, 33.6 - lift, 4.4, 3.4, 1.4), shoeStyle.color, 0.5);
      addOutlinedFill("M" + round1(centerX - 2.5) + " " + round1(36.8 - lift) + "Q" + round1(centerX - 2.5) + " " + round1(35 - lift) + " " + round1(centerX - 0.6) + " " + round1(35 - lift) +
        "L" + round1(centerX + 0.8) + " " + round1(35 - lift) + "Q" + round1(centerX + 3.3) + " " + round1(35.4 - lift) + " " + round1(centerX + 3.2) + " " + round1(37.2 - lift) +
        "Q" + round1(centerX + 3.2) + " " + round1(38.4 - lift) + " " + round1(centerX + 2) + " " + round1(38.4 - lift) +
        "L" + round1(centerX - 1.4) + " " + round1(38.4 - lift) + "Q" + round1(centerX - 2.5) + " " + round1(38.4 - lift) + " " + round1(centerX - 2.5) + " " + round1(36.8 - lift) + "Z", shoeStyle.color, 0.6);
      if (shoeStyle.sole) addLine("M" + round1(centerX - 2.3) + " " + round1(37.8 - lift) + "H" + round1(centerX + 3), shoeStyle.sole, 0.7);
    });

    /* 팔과 손 */
    addLine("M7.4 26.6L6.8 30.4", OUTLINE_COLOR, 3.6); addLine("M7.4 26.6L6.8 30.4", topStyle.color, 2.5);
    addLine("M20.6 26.6L21.2 30.4", OUTLINE_COLOR, 3.6); addLine("M20.6 26.6L21.2 30.4", topStyle.color, 2.5);
    addOutlinedFill(ellipsePath(6.8, 31.4, 1.5, 1.5), skinColor, 0.5); addOutlinedFill(ellipsePath(21.2, 31.4, 1.5, 1.5), skinColor, 0.5);

    /* 몸통(상의)과 치마 */
    addOutlinedFill("M8.2 25.8Q8.2 24.4 10.2 24.4L17.8 24.4Q19.8 24.4 19.8 25.8L20.4 32.4Q14 33.8 7.6 32.4Z", topStyle.color);
    if (bottomStyle.skirt) addOutlinedFill("M7.6 30Q14 31.6 20.4 30L22.6 35.2Q14 36.8 5.4 35.2Z", bottomStyle.color, 0.5);
    addFill("M17.6 24.4L17.8 24.4Q19.8 24.4 19.8 25.8L20.4 32.4Q19 32.7 17.8 32.8Z", "#000", 0.16);
    /* 상의 디테일 */
    if (topStyle.jacket) {
      addFill("M11.4 24.4L14 28.4L16.6 24.4Z", "#fff", 0.95);
      if (!female && options.senior) addFill("M13.2 26.4H14.8L15.4 30L14 31L12.6 30Z", "#1e2a4a");
    } else {
      addFill("M11.8 24.4L14 27L16.2 24.4Z", "#fff", 0.95);
      addFill(ellipsePath(18.2, 27.6, 0.8, 0.8), TEAM_COLOR);
      if (topStyle.tie) addFill("M13.2 26.4H14.8L15.6 31.4L14 32.2L12.4 31.4Z", TEAM_COLOR);
      if (topStyle.hood) {
        addLine("M9.6 24.8Q14 28.4 18.4 24.8", "#5f6677", 1.8);
        addFill(roundedRectPath(10, 29.2, 8, 2.2, 1), "#000", 0.15);
        addLine("M12.6 27.2V30M15.4 27.2V30", "#fff", 0.6, 0.85);
      }
      if (topStyle.stripe) addFill("M8 28.4H20.2L20.3 30H7.9Z", topStyle.stripe);
      if (topStyle.inner) { addFill("M11 24.4L14 31.8L17 24.4Q14 26.2 11 24.4Z", topStyle.inner); addLine("M14 27.4V32", "#000", 0.5, 0.2); }
    }

    /* 얼굴과 귀 */
    addOutlinedFill(ellipsePath(3.8, 15, 1.4, 2), skinColor, 0.5); addOutlinedFill(ellipsePath(24.2, 15, 1.4, 2), skinColor, 0.5);
    addOutlinedFill("M3.4 13.6C3.4 6.4 8 3 14 3S24.6 6.4 24.6 13.6C24.6 19.2 19.8 23.8 14 23.8S3.4 19.2 3.4 13.6Z", skinColor, 0.7);
    //addFill("M5 10.8Q14 14.4 23 10.8L23 8.6L5 8.6Z", "#000", 0.08);   /* 앞머리 그늘 */
    //addFill("M7 20.4Q14 25.4 21 20.4Q19.6 23 14 23.4Q8.4 23 7 20.4Z", "#000", 0.06);   /* 턱 그늘 */

    /* 앞머리: 일자로 똑 자른 네모난 앞머리. 옆머리(구레나룻)는 그리지 않고 귀 위에서 끝납니다.
       bottomY: 앞머리 끝 높이(클수록 길다), topY: 정수리 높이, extraWidth: 좌우로 더 넓힐 폭 */
    function bluntFringePath(bottomY, topY, extraWidth) {
      var left = 3.4 - (extraWidth || 0), right = 24.6 + (extraWidth || 0), cornerY = Math.min(8, bottomY - 1);
      return "M" + left + " " + bottomY + "L" + left + " " + cornerY + "C" + (left - 0.8) + " " + (topY + 3) + " 7.4 " + topY + " 14 " + topY +
        "S" + (right + 0.8) + " " + (topY + 3) + " " + right + " " + cornerY + "L" + right + " " + bottomY + "Z";
    }
    if (!female) {
      if (hairStyle === 1) addOutlinedFill("M3.4 9.4L3.4 4.6Q3.4 0.8 8 0.8L20 0.8Q24.6 0.8 24.6 4.6L24.6 9.4Z", hairColor);   /* 각진 */
      else if (hairStyle === 2) addOutlinedFill("M3.4 9.8L3.4 8C2.6 4 7.4 1.4 14 1.4S25.4 4 24.6 8L24.6 9.8L15.8 9.8Q14 6.4 12.2 9.8Z", hairColor);   /* 가르마 */
      else if (hairStyle === 3) addOutlinedFill(bluntFringePath(10.8, 10.2, 0), hairColor);   /* 짧은 */
      else if (hairStyle === 4) addOutlinedFill(bluntFringePath(9.8, 0.2, 1.4), hairColor);   /* 볼륨 */
      else addOutlinedFill(bluntFringePath(9.8, 1.4, 0), hairColor);   /* 단정 */
    } else if (hairStyle === 4) addOutlinedFill(bluntFringePath(9, 1.4, 0), hairColor);   /* 숏컷 */
    else addOutlinedFill(bluntFringePath(9.8, hairStyle === 3 ? 0.8 : 1.4, 0), hairColor);
    addLine("M8 5.4Q10.6 2.6 15.2 2.4", "#fff", 1.1, 0.2);   /* 머리 윤기 */

    /* 눈썹 */
    addLine("M7.8 10.3Q10 9.2 12.2 10.1", hairShadow, 0.9); addLine("M15.8 10.1Q18 9.2 20.2 10.3", hairShadow, 0.9);
    /* 눈: 왼쪽 눈(centerX 10)과 오른쪽 눈(centerX 18). outward 는 바깥쪽 방향(왼쪽 -1, 오른쪽 +1) */
    [10, 18].forEach(function (centerX, eyeIndex) {
      var outward = eyeIndex ? 1 : -1;
      if (eyeShape === 0) {   /* 동그란 */
        addFill(ellipsePath(centerX, 15.7, 2.2, 3), OUTLINE_COLOR); addFill(ellipsePath(centerX, 16.2, 1.8, 2.5), eyeColor); addFill(ellipsePath(centerX, 17.6, 1.4, 1.1), "#fff", 0.28);
        addFill(ellipsePath(centerX - 0.7, 14.6, 0.9, 0.9), "#fff"); addFill(ellipsePath(centerX + 0.9, 17.3, 0.4, 0.4), "#fff", 0.9);
      } else if (eyeShape === 1) {   /* 졸린 */
        addFill(ellipsePath(centerX, 16.7, 2.2, 2.3), OUTLINE_COLOR); addFill(ellipsePath(centerX, 17.1, 1.8, 1.8), eyeColor); addFill(ellipsePath(centerX - 0.6, 16.7, 0.6, 0.6), "#fff");
        addFill("M" + (centerX - 2.7) + " 13V15.4Q" + centerX + " 16.1 " + (centerX + 2.7) + " 15.4V13Z", skinColor);
        addLine("M" + (centerX - 2.6) + " 15.4Q" + centerX + " 16.1 " + (centerX + 2.6) + " 15.4", OUTLINE_COLOR, 0.9);
      } else if (eyeShape === 2) {   /* 날카로운 */
        addFill(ellipsePath(centerX, 15.9, 2.1, 2.5), OUTLINE_COLOR); addFill(ellipsePath(centerX, 16.3, 1.7, 2), eyeColor);
        addFill(ellipsePath(centerX - 0.6, 15.5, 0.7, 0.7), "#fff"); addFill(ellipsePath(centerX + 0.7, 17.2, 0.35, 0.35), "#fff", 0.9);
        addLine("M" + round1(centerX - outward * 2.4) + " 16.4Q" + centerX + " 13.2 " + round1(centerX + outward * 3) + " 13.6", OUTLINE_COLOR, 1);
      } else if (eyeShape === 3) {   /* 웃는 */
        addLine("M" + (centerX - 2.4) + " 16.8Q" + centerX + " 12.8 " + (centerX + 2.4) + " 16.8", OUTLINE_COLOR, 1.5);
        addLine("M" + (centerX - 2.4) + " 16.8Q" + centerX + " 12.8 " + (centerX + 2.4) + " 16.8", eyeColor, 0.8);
      } else {   /* 큰 눈 */
        addFill(ellipsePath(centerX, 15.5, 2.8, 3.6), OUTLINE_COLOR); addFill(ellipsePath(centerX, 16, 2.4, 3.1), eyeColor); addFill(ellipsePath(centerX, 17.8, 1.9, 1.3), "#fff", 0.3);
        addFill(ellipsePath(centerX - 0.9, 14.3, 1.05, 1.05), "#fff"); addFill(ellipsePath(centerX + 1.1, 17.2, 0.5, 0.5), "#fff", 0.9);
      }
    });
    /* 입과 볼터치 */
    addLine("M12.8 20.6Q14 21.6 15.2 20.6", female ? "#d0606c" : "#a8605a", 0.9);
    addFill(ellipsePath(7, 18.9, 1.7, 1), "#ff8f8f", 0.5); addFill(ellipsePath(21, 18.9, 1.7, 1), "#ff8f8f", 0.5);
    /* 왕관 (팀장 이상) */
    if (options.crown) {
      addOutlinedFill("M7 4.6L7.8 0.8L10.8 3.2L14 0L17.2 3.2L20.2 0.8L21 4.6Z", CROWN_COLOR, 0.5);
      addFill(ellipsePath(14, 2.8, 0.7, 0.7), "#e0607a");
    }
    return shapes;
  }

  /* 도형 목록을 SVG 문자열로 바꿉니다 */
  function svgOf(shapes) {
    var markup = "";
    shapes.forEach(function (shape) {
      markup += '<path d="' + shape.path + '"' + (shape.fill ? ' fill="' + shape.fill + '"' : ' fill="none"') +
        (shape.stroke ? ' stroke="' + shape.stroke + '" stroke-width="' + shape.strokeWidth + '" stroke-linecap="round" stroke-linejoin="round"' : "") +
        (shape.opacity < 1 ? ' opacity="' + shape.opacity + '"' : "") + "/>";
    });
    return '<svg viewBox="0 0 28 40" aria-hidden="true">' + markup + "</svg>";
  }
  function svg(look, female, teamColor) {
    return svgOf(rects(look, female, 0)).replace("<svg ", '<svg style="color:' + (teamColor || "#7b8cff") + '" ');
  }

  /* 선택 UI: box 안에 미리보기와 7개 선택 줄을 그리고 { get, setGender } 를 돌려줍니다. */
  function mount(box, initialLook, initialGender, onChange) {
    var look = (initialLook || DEFAULT_LOOK).slice(), currentGender = initialGender === "f" ? "f" : "m";
    function labelsOf(group) { return Array.isArray(group.labels) ? group.labels : group.labels[currentGender]; }
    function render() {
      var html = '<div class="look-preview">' + svg(look, currentGender === "f") + "</div><div class=\"look-rows\">";
      GROUPS.forEach(function (group, groupIndex) {
        html += '<div class="look-row" role="group" aria-label="' + group.name + '"><span class="look-name">' + group.name + '</span><div class="look-opts">';
        labelsOf(group).forEach(function (label, optionIndex) {
          var isSelected = look[groupIndex] === optionIndex;
          html += '<button type="button" class="look-opt' + (isSelected ? " on" : "") + '" data-k="' + groupIndex + '" data-v="' + optionIndex + '" aria-pressed="' + isSelected + '" title="' + label + '">' +
            (group.swatch ? '<i class="look-sw" style="background:' + group.swatch[optionIndex] + '"></i>' : "") + label + "</button>";
        });
        html += "</div></div>";
      });
      box.innerHTML = html + "</div>";
    }
    box.addEventListener("click", function (event) {
      var button = event.target.closest(".look-opt");
      if (!button || !box.contains(button)) return;
      look[+button.dataset.k] = +button.dataset.v;
      render();
      if (onChange) onChange(look.join(","));
    });
    render();
    return {
      get: function () { return look.join(","); },
      setGender: function (next) { currentGender = next === "f" ? "f" : "m"; render(); }
    };
  }

  window.parseLook = parseLook;
  window.Look = { rects: rects, svg: svg, svgOf: svgOf, mount: mount, parse: parseLook, DEFAULT: DEFAULT_LOOK };
})();
