// ----------------------------------------------------
// 전역 변수 정의
// ----------------------------------------------------

// 웹캠 영상을 위한 p5.VideoCapture 객체
let video; // p5.js에서 createCapture()로 얻은 웹캠 캡처를 저장

// HandPose로 감지된 손 정보를 담을 배열
let hands = []; // gotHands() 콜백에서 매 프레임마다 갱신

// 제스처 관련 타이머와 임계값
let gestureTimer = 0;      // 동일 제스처가 유지된 시간(ms)
let gestureThreshold = 1000; // 제스처가 확정되기까지 필요한 시간, 여기서는 1초(1000ms)

// 최근에 감지된 제스처명과 확정된 제스처명
let lastGesture = "";      // 직전 프레임에서 감지된 제스처
let confirmedGesture = ""; // gestureTimer가 임계값에 도달했을 때 확정되는 제스처

// 팔레트 모드 활성 여부 (true면 drawPalette()를 호출)
let paletteActive = false; 

// 화면에 표시할 제스처 메시지
let gestureMessage = "";

// 현재 모드 (기본: "default", 긴급: "emergency", 엄지 위/아래: "thumbsUp"/"thumbsDown")
let currentMode = "default";

// 팔레트 모드에서 사용할 도구 관련 변수
let selectedTool = ""; // "pen" 또는 "eraser"
let toolActivationStart = 0; // 펜/지우개 아이콘 위에 손가락이 머문 시간 측정

// 펜으로 그린 픽셀을 기록할 p5.Graphics 레이어
let drawingLayer;      
// 펜 도구 사용 시, 이전 프레임의 검지 끝 좌표(연속 그리기)
let lastTipPos = null; 

// 전체 지우기 버튼 관련 타이머
let clearActivationStart = 0;

// 펜 색상 및 도구 크기 설정
let penColor = '#000000'; // 기본 검정
let availableColors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
let currentColorIndex = 0; 
let toolSize = 4; // 기본 펜 두께 4
let availableSizes = [2, 4, 6, 8, 10];
let currentSizeIndex = 1;
let colorActivationStart = 0; // 색상 선택 아이콘 위에 손가락이 머문 시간 측정
let sizeActivationStart = 0;  // 사이즈 선택 아이콘 위에 손가락이 머문 시간 측정

// 색상 패드 관련 상태
let colorPadActive = false; // 색상 패드 활성화 여부
let colorPadSelectionStart = 0; // 색상 패드 셀 위에 손가락이 머문 시간
let colorPadOptions = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00',
  '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#800000', '#008000', '#000080', '#808000',
  '#800080', '#008080', '#808080', '#C0C0C0'
];

// 사이즈 패드 관련 상태
let sizePadActive = false; // 사이즈 패드 활성화 여부
let sizePadSelectionStart = 0; // 사이즈 패드 셀 위에 손가락이 머문 시간

// 스켈레톤 연결 정보(HandPose에서 keypoints를 이어 그리는 데 사용)
const fingerConnections = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20]
];

// ----------------------------------------------------
// HandPose 모델 초기화
// ----------------------------------------------------

/**
 * @brief ml5.js HandPose 모델을 미리 로드한다.
 */
function preload() {
  handPose = ml5.handPose(); // handPose 변수를 전역에서 사용하기 위해 저장
}

/**
 * @brief HandPose가 감지한 손 데이터를 전역 hands 배열에 저장한다.
 * @param {Array} results - 감지된 손 정보 (키포인트, 스켈레톤 등)
 */
function gotHands(results) {
  hands = results; // 매 프레임마다 갱신
}

/**
 * @brief x좌표를 좌우 반전하기 위한 함수 (640 - x).
 * @param {number} x - 원본 x좌표
 * @return {number} - 뒤집힌 x좌표
 */
function flipX(x) {
  return 640 - x; 
}

// ----------------------------------------------------
// 스켈레톤 및 제스처 인식 관련
// ----------------------------------------------------

/**
 * @brief 감지된 손 키포인트(빨간 원)와 스켈레톤(초록 선)을 그린다.
 * 
 * hands 배열에는 HandPose가 감지한 여러 손(각각 keypoints 배열 포함)이 들어갈 수 있다.
 * 이 함수에서는 각 손에 대해:
 *  1) 모든 키포인트 위치를 빨간 원으로 표시
 *  2) fingerConnections 배열을 순회하여 해당하는 두 점을 연결(초록 선)해 스켈레톤을 그림
 */
function drawHandKeypointsAndSkeleton() {
  // hands 배열을 순회 (hands.length는 감지된 손의 개수)
  for (let i = 0; i < hands.length; i++) {
    // i번째 손 객체
    let hand = hands[i];
    
    // ─ 키포인트(빨간 원) 표시 ─
    // hand.keypoints는 21개의 점(각 손가락 관절 + 손목)을 갖는다.
    for (let j = 0; j < hand.keypoints.length; j++) {
      // j번째 키포인트 정보 (x, y, score, name 등이 들어있음)
      let kpt = hand.keypoints[j];
      // 빨간색으로 채우기
      fill(255, 0, 0);
      // 테두리는 그리지 않음
      noStroke();
      // flipX(kpt.x)로 x좌표를 좌우 반전, kpt.y는 그대로 사용
      // 원의 크기는 지름 10
      circle(flipX(kpt.x), kpt.y, 10);
    }
    
    // ─ 스켈레톤(초록 선) 표시 ─
    // fingerConnections는 [ [0,1], [1,2], ... ] 처럼 키포인트 인덱스를 연결하는 배열
    stroke(0, 255, 0);   // 선 색상을 초록색으로 설정
    strokeWeight(2);     // 선 두께를 2px로 설정
    for (let c = 0; c < fingerConnections.length; c++) {
      // fingerConnections[c]는 [a, b] 형태의 배열
      let [a, b] = fingerConnections[c];
      // a, b는 hand.keypoints에서 연결해야 할 인덱스
      let ptA = hand.keypoints[a];
      let ptB = hand.keypoints[b];
      // 좌우 반전된 x좌표와 원래 y좌표를 사용하여 선을 그림
      line(flipX(ptA.x), ptA.y, flipX(ptB.x), ptB.y);
    }
  }
}

/**
 * @brief 손 객체를 분석해 특정 제스처(Default, Palette, Emergency 등)를 판별한다.
 * @param {Object} hand - 감지된 손 데이터 (keypoints 배열 포함)
 * @return {string} 판별된 제스처 (Unknown, Default, Palette, Emergency, ThumbsUp, ThumbsDown)
 * 
 * 동작 방식 요약:
 *  1) 손가락 끝(thumbTip, indexTip 등)과 손목 등을 이용해 손 크기와 손가락 펼침 여부를 계산
 *  2) 특정 조건(손가락이 모두 모임, 다 펼침, 엄지만 펼침 등)에 따라 제스처 이름을 결정
 */
function detectGesture(hand) {
  // 기본값으로 "Unknown" 할당
  let resultGesture = "Unknown";
  
  // 손(keypoints)이 21개 미만이면 정상 손 인식이 아니므로 생략
  if (!hand || !hand.keypoints || hand.keypoints.length < 21) {
    // 아무것도 하지 않고 Unknown 유지
  } else {
    // ─ 주로 사용할 키포인트를 변수에 담음 ─
    // 손목(0번), 엄지 끝(4번), 검지 끝(8번), 중지 끝(12번), 약지 끝(16번), 새끼 끝(20번)
    const wrist = hand.keypoints[0];
    const thumbTip = hand.keypoints[4];
    const indexTip = hand.keypoints[8];
    const middleTip = hand.keypoints[12];
    const ringTip = hand.keypoints[16];
    const pinkyTip = hand.keypoints[20];
    
    // ─ 손 크기 및 중심 계산 ─
    // 손목(wrist)과 중지 끝(middleTip) 사이 거리를 손 크기로 삼는다.
    const handSize = dist(wrist.x, wrist.y, middleTip.x, middleTip.y);
    // 다섯 손가락 끝(엄지, 검지, 중지, 약지, 새끼)의 평균 x,y 좌표
    const centroidX = (thumbTip.x + indexTip.x + middleTip.x + ringTip.x + pinkyTip.x) / 5;
    const centroidY = (thumbTip.y + indexTip.y + middleTip.y + ringTip.y + pinkyTip.y) / 5;
    // 손가락 끝들이 어느 정도 가까이 모여 있어야 "주먹" 형태로 인식 -> closeThreshold
    const closeThreshold = handSize * 0.2;
    // tips 배열: 엄지부터 새끼까지 손가락 끝을 모음
    const tips = [thumbTip, indexTip, middleTip, ringTip, pinkyTip];
    // allTipsClose: 모든 손가락 끝이 손 중심부(centroidX, centroidY)에서 closeThreshold 내에 있는지?
    const allTipsClose = tips.every(tip => dist(tip.x, tip.y, centroidX, centroidY) < closeThreshold);
    
    // ─ 손가락이 펼쳐졌는지 여부 판별 ─
    // MCP(손허리관절) 위치와 손목(wrist) 사이 거리, 그리고 팁 위치와 wrist 거리의 비율로 판단
    const factor = 1.2;
    const thumbMCP = hand.keypoints[2];
    // 엄지 끝과 MCP 사이 길이 대비, wrist와 MCP 사이 길이 대비를 factor(1.2) 이상이면 펼쳐진 것
    const thumbExtended = dist(wrist.x, wrist.y, thumbTip.x, thumbTip.y) > factor * dist(wrist.x, wrist.y, thumbMCP.x, thumbMCP.y);
    
    const indexMCP = hand.keypoints[5];
    const indexExtended = dist(wrist.x, wrist.y, indexTip.x, indexTip.y) > factor * dist(wrist.x, wrist.y, indexMCP.x, indexMCP.y);
    
    const middleMCP = hand.keypoints[9];
    const middleExtended = dist(wrist.x, wrist.y, middleTip.x, middleTip.y) > factor * dist(wrist.x, wrist.y, middleMCP.x, middleMCP.y);
    
    const ringMCP = hand.keypoints[13];
    const ringExtended = dist(wrist.x, wrist.y, ringTip.x, ringTip.y) > factor * dist(wrist.x, wrist.y, ringMCP.x, ringMCP.y);
    
    const pinkyMCP = hand.keypoints[17];
    const pinkyExtended = dist(wrist.x, wrist.y, pinkyTip.x, pinkyTip.y) > factor * dist(wrist.x, wrist.y, pinkyMCP.x, pinkyMCP.y);
    
    // ─ 조건별 제스처 분기 ─
    // 1) 모든 손가락 끝이 모여있으면 "Default"
    if (allTipsClose) {
      resultGesture = "Default";
    }
    // 2) 엄지, 검지, 중지, 약지, 새끼가 모두 펼쳐져 있으면 "Palette"
    else if (thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) {
      resultGesture = "Palette";
    }
    // 3) 엄지, 검지, 중지 만 펼쳐졌으면 "Emergency"
    else if (indexExtended && middleExtended && thumbExtended && !ringExtended && !pinkyExtended) {
      resultGesture = "Emergency"; 
    }
    // 4) 엄지만 펼쳐졌으면, 엄지 위/아래 (ThumbsUp/ThumbsDown)
    else if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      // 엄지 끝의 y좌표가 MCP보다 작으면(위쪽이면) ThumbsUp, 아니면 ThumbsDown
      if (thumbTip.y < thumbMCP.y) {
        resultGesture = "ThumbsUp";
      } else {
        resultGesture = "ThumbsDown";
      }
    }
  }
  
  // gestureMessage: 전역 문자열에 감지된 제스처 정보 저장
  gestureMessage = `Gesture detected: ${resultGesture}`;
  // 최종 결과 반환
  return resultGesture;
}

/**
 * @brief 첫 번째 손의 키포인트 평균 위치를 계산해 { x, y }로 반환한다.
 * @param {Object} hand - 감지된 손 객체
 * @return {Object} 평균 위치 (x, y)
 * 
 * 이 함수는 여러 가지 UI 표시(예: 게이지 표시 위치)를 위해 사용된다.
 */
function getAverageKeypointPosition(hand) {
  // sumX, sumY에 모든 키포인트의 x, y를 누적
  let sumX = 0, sumY = 0;
  for (let i = 0; i < hand.keypoints.length; i++) {
    sumX += hand.keypoints[i].x;
    sumY += hand.keypoints[i].y;
  }
  // 평균 계산 (keypoints.length는 일반적으로 21)
  // flipX()로 x좌표만 좌우 반전
  return { x: flipX(sumX / hand.keypoints.length), y: sumY / hand.keypoints.length };
}

/**
 * @brief 제스처 유지 정도를 게이지 형태로 시각화한다.
 * @param {number} percentage 0~1 범위의 유지 비율
 * @param {Object} avgPos 게이지를 그릴 위치 { x, y }
 * 
 * 예: percentage가 0.5면 게이지 절반만 표시, 1이면 전부 표시
 * avgPos는 보통 손의 평균 위치에 기반해 정해짐
 */
function drawGestureGauge(percentage, avgPos) {
  // 게이지의 너비(gaugeWidth)는 화면 폭의 20%, 높이(gaugeHeight)는 10px
  let gaugeWidth = width * 0.2;
  let gaugeHeight = 10;
  // 게이지를 손 평균 위치 아래쪽(70px 아래)에 배치
  let x = avgPos.x - gaugeWidth / 2;
  let y = avgPos.y + 70;
  
  // 게이지 배경(테두리만)
  stroke(0);    // 검정색 선
  noFill();     // 내부 채우기 없음
  rect(x, y, gaugeWidth, gaugeHeight);
  
  // 게이지 진행 부분(녹색 바)
  noStroke();        // 선 없음
  fill(0, 200, 0, 150);  // 약간 투명한 초록색
  // percentage 비율만큼 너비를 채움
  rect(x, y, gaugeWidth * percentage, gaugeHeight);
}

/**
 * @brief 1초 진행 상황을 보라색 테두리로 표시한다.
 * @param {number} x 사각형 x 위치
 * @param {number} y 사각형 y 위치
 * @param {number} w 사각형 너비
 * @param {number} h 사각형 높이
 * @param {number} percentage 0~1 범위의 진행도 (0=0%, 1=100%)
 * 
 * 이 함수는 예를 들어, 1초간 버튼 위에 손가락이 머무는 진행 상황을
 * 시각적으로 보여주기 위해 사용된다.
 */
function drawProgressBorder(x, y, w, h, percentage) {
  // 현재 그래픽 설정을 저장
  push();
  // 내부 채우기 없음
  noFill();
  // 선 색상: (255, 69, 0) 오렌지 계열, alpha는 percentage에 비례
  stroke(255, 69, 0, percentage * 255);
  // 선 두께 3px
  strokeWeight(3);
  // (x,y) 위치에 (w,h) 크기의 사각형 테두리만 그림
  rect(x, y, w, h);
  // 저장한 그래픽 설정 복원
  pop();
}

// ----------------------------------------------------
// 모드 전환 및 오버레이
// ----------------------------------------------------

/**
 * @brief 판별된 제스처에 따라 팔레트 모드, 긴급 모드, 엄지 모드 등을 전환한다.
 * @param {string} gesture - detectGesture() 함수에서 판별된 제스처 문자열
 * 
 * 동작 개요:
 *  1) "Palette" 제스처가 들어오면 paletteActive를 토글하고, currentMode를 "default"로 설정
 *  2) 이미 팔레트 모드가 활성화 중(paletteActive == true)이면, 다른 제스처를 무시
 *  3) "Default" 제스처가 들어오면 currentMode를 "default"로 설정
 *  4) "Emergency" 제스처 -> currentMode를 "emergency"
 *  5) "ThumbsUp"  제스처 -> currentMode를 "thumbsUp"
 *  6) "ThumbsDown" 제스처 -> currentMode를 "thumbsDown"
 * 
 * 이렇게 currentMode가 바뀌면, draw() 함수 내에서 해당 모드에 맞는 처리를 수행
 */
function changeMode(gesture) {
  // 1) "Palette" 제스처가 감지된 경우
  if (gesture === "Palette") {
    // paletteActive를 true/false로 토글
    paletteActive = !paletteActive;
    // 모드를 "default"로 되돌린다 (팔레트 모드는 별개 상태)
    currentMode = "default";
    // 콘솔에 현재 팔레트 모드 상태와 기본 모드로 전환되었음을 표시
    console.log("팔레트 모드 " + (paletteActive ? "활성화" : "비활성화") + ", 기본 모드로 전환");
    // 함수 종료 (아래 로직은 실행하지 않음)
    return;
  }

  // 2) 이미 paletteActive가 true라면, 다른 제스처 무시 (팔레트 모드 유지)
  if (paletteActive) return;

  // 3) "Default" 제스처 -> currentMode를 "default"
  if (gesture === "Default") {
    currentMode = "default";
    console.log("기본 모드로 돌아갑니다.");
    return;
  }

  // 4) "Emergency" 제스처 -> 긴급 모드
  if (gesture === "Emergency") {
    currentMode = "emergency";
    console.log("긴급 모드 진입");
  }
  // 5) "ThumbsUp" 제스처 -> 엄지 위 모드
  else if (gesture === "ThumbsUp") {
    currentMode = "thumbsUp";
    console.log("엄지 위 모드 진입");
  }
  // 6) "ThumbsDown" 제스처 -> 엄지 아래 모드
  else if (gesture === "ThumbsDown") {
    currentMode = "thumbsDown";
    console.log("엄지 아래 모드 진입");
  }
}

/**
 * @brief currentMode에 따라 오버레이(화면 전체 배경 + 텍스트)를 그린다.
 * @param {string} mode - 현재 모드("default", "emergency", "thumbsUp", "thumbsDown" 등)
 * 
 * 동작 개요:
 *  1) push()로 현재 그래픽 상태를 저장
 *  2) 모드별로 fill(...) 색상을 달리 설정(반투명)
 *  3) rect(0, 0, width, height)로 화면 전체를 덮는 사각형을 그림
 *  4) 텍스트 중앙 정렬 후, 모드별로 다른 메시지를 출력
 *  5) pop()으로 그래픽 상태 복원
 */
function drawOverlay(mode) {
  // 그래픽 상태 저장 (p5.js 함수)
  push();
  // 사각형을 그릴 때 테두리는 사용하지 않음
  noStroke();

  // ─ 모드별 배경색 설정 ─
  // "emergency" -> 반투명 검정
  if (mode === "emergency") {
    fill(0, 0, 0, 150);       // RGBA(0,0,0,150): 흑색 배경, 약간 투명
  }
  // "thumbsUp" -> 반투명 초록
  else if (mode === "thumbsUp") {
    fill(0, 190, 0, 150);     // RGBA(0,190,0,150): 초록색 배경
  }
  // "thumbsDown" -> 반투명 오렌지
  else if (mode === "thumbsDown") {
    fill(255, 165, 0, 150);   // RGBA(255,165,0,150): 오렌지색 배경
  }
  // 그 외 모드 -> 기본 반투명 검정
  else {
    fill(0, 0, 0, 150);       // RGBA(0,0,0,150): 검정색 배경
  }

  // 화면 전체(0,0)부터 (width,height)까지 사각형을 그려서 반투명 배경을 씌움
  rect(0, 0, width, height);

  // ─ 텍스트 표시 ─
  // 텍스트 정렬을 가로세로 모두 중앙으로
  textAlign(CENTER, CENTER);
  // 텍스트 크기 48px
  textSize(48);
  // 글자색 흰색
  fill(255);

  // 모드별로 다른 문구를 중앙에 표시
  if (mode === "emergency") {
    // 긴급 모드 시 "자리 비움" 표시
    text("자리 비움", width / 2, height / 2);
  } else if (mode === "thumbsUp") {
    // 엄지 위 모드 시 "좋은 의견이에요!"
    text("좋은 의견이에요!", width / 2, height / 2);
  } else if (mode === "thumbsDown") {
    // 엄지 아래 모드 시 "질문 있어요!"
    text("질문 있어요!", width / 2, height / 2);
  }
  // push() 이전 상태로 그래픽 설정을 복원
  pop();
}

// ----------------------------------------------------
// 팔레트 모드 UI
// ----------------------------------------------------

/**
 * @brief 팔레트 모드가 활성화되면 펜 색상/크기/지우개 등을 설정하는 UI를 그린다.
 * 
 * 주요 기능:
 *  1) 화면 좌측 상단에 "All Clear" 버튼 표시 (1초간 손가락이 머무르면 drawingLayer 전체 지움)
 *  2) 화면 우측의 펜/지우개 아이콘, 펜 색상/크기 설정 블록 표시
 *  3) 색상/크기 패드가 활성화된 경우 그리드 UI 표시 및 선택 로직 처리
 *  4) 펜/지우개 아이콘을 선택하거나 핀치 동작에 따라 실제 드로잉(펜) 또는 지우기(eraser) 가능
 */
function drawPalette() {
  // ─ Clear All 버튼: 좌측 상단 ─
  // x=20, y=150 위치, 너비/높이=50
  const clearButton = { x: 20, y: 150, width: 50, height: 50 };
  // 배경색(핑크 계열), 테두리(검정)
  fill(255, 125, 125);
  stroke(0);
  rect(clearButton.x, clearButton.y, clearButton.width, clearButton.height);
  // 내부 텍스트("All Clear"): 중앙 정렬, 크기=12
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(12);
  text("All Clear", clearButton.x + clearButton.width / 2, clearButton.y + clearButton.height / 2);

  // ─ 전체 지우기 로직 ─
  // 만약 손(hands 배열) 존재 시, 인덱스 손가락(검지) 위치가 clearButton 위에 1초 이상 머무르면 drawingLayer.clear()
  if (hands.length > 0) {
    let hand = hands[0];
    // 검지 끝(keypoints[8]) 좌표
    let indexTip = hand.keypoints[8];
    // flipX로 x 반전, y는 그대로
    let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
    // clearButton 영역 내에 있는지 검사
    if (
      tipPos.x > clearButton.x && tipPos.x < clearButton.x + clearButton.width &&
      tipPos.y > clearButton.y && tipPos.y < clearButton.y + clearButton.height
    ) {
      // 처음 들어갔을 때 clearActivationStart=0 -> millis()로 초기화
      if (clearActivationStart === 0) {
        clearActivationStart = millis();
      } else if (millis() - clearActivationStart > 1000) {
        // 1초 경과 시 drawingLayer를 전부 지움
        drawingLayer.clear();
        console.log("전체 지우기 실행");
        clearActivationStart = 0;
      }
      // 진행도(0~1) 계산
      let progress = constrain((millis() - clearActivationStart) / 1000, 0, 1);
      // 버튼 테두리에 보라색 진행 표시
      drawProgressBorder(clearButton.x, clearButton.y, clearButton.width, clearButton.height, progress);
    } else {
      // 영역 벗어나면 타이머 리셋
      clearActivationStart = 0;
    }
  }

  // ─ 아이콘 및 설정 블록 위치 정의 ─
  // 화면 우측에 penIcon, eraserIcon, toolSizeBlock, penColorBlock
  const penIcon = { x: 580, y: 75, size: 50 };
  const eraserIcon = { x: 580, y: 150, size: 50 };
  const toolSizeBlock = { x: 580, y: 225, size: 50 };
  const penColorBlock = { x: 580, y: 300, size: 50 };

  // ─ 도구 아이콘 및 설정 블록 그리기 ─
  drawToolIcons(penIcon, eraserIcon, penColorBlock, toolSizeBlock);

  // ─ 색상 패드 처리 ─ (handleColorPad)
  handleColorPad(penColorBlock);

  // ─ 사이즈 패드 처리 ─ (handleSizePad)
  handleSizePad(toolSizeBlock);

  // ─ 도구 선택 및 동작 처리 ─ (handleToolSelection)
  handleToolSelection(penIcon, eraserIcon);
}

/**
 * @brief 팔레트 UI에서 펜/지우개/펜색상/사이즈 블록을 그린다.
 * @param {Object} penIcon      - 펜 아이콘 위치/크기
 * @param {Object} eraserIcon   - 지우개 아이콘 위치/크기
 * @param {Object} penColorBlock - 펜 색상 블록
 * @param {Object} toolSizeBlock - 펜 사이즈 블록
 * 
 * 동작 개요:
 *  1) penIcon: 선택Tool이 pen이면 청록색(#009688), 아니면 흰색
 *  2) eraserIcon: 선택Tool이 eraser이면 청록색, 아니면 흰색
 *  3) penColorBlock: 현재 penColor로 내부 채움
 *  4) toolSizeBlock: "Size : (toolSize)" 텍스트 표시
 */
function drawToolIcons(penIcon, eraserIcon, penColorBlock, toolSizeBlock) {
  // ─ 펜 아이콘 ─
  fill(selectedTool === "pen" ? '#009688' : 'white'); // 선택된 도구면 #009688
  stroke(0);
  rect(penIcon.x, penIcon.y, penIcon.size, penIcon.size);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("pen", penIcon.x + penIcon.size / 2, penIcon.y + penIcon.size / 2);

  // ─ 지우개 아이콘 ─
  fill(selectedTool === "eraser" ? '#009688' : 'white');
  stroke(0);
  rect(eraserIcon.x, eraserIcon.y, eraserIcon.size, eraserIcon.size);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("eraser", eraserIcon.x + eraserIcon.size / 2, eraserIcon.y + eraserIcon.size / 2);

  // ─ 펜 색상 블록 ─
  // penColor(전역변수)에 따라 사각형 내부를 채움
  fill(penColor);
  stroke(0);
  rect(penColorBlock.x, penColorBlock.y, penColorBlock.size, penColorBlock.size);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("Color", penColorBlock.x + penColorBlock.size / 2, penColorBlock.y + penColorBlock.size / 2);

  // ─ 펜 크기 설정 블록 ─
  fill(200);
  stroke(0);
  rect(toolSizeBlock.x, toolSizeBlock.y, toolSizeBlock.size, toolSizeBlock.size);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(15);
  // 현재 toolSize를 표시
  text("Size : " + toolSize, toolSizeBlock.x + toolSizeBlock.size / 2, toolSizeBlock.y + toolSizeBlock.size / 2);
}

/**
 * @brief 색상 패드 활성화 및 색상 선택 처리
 * @param {Object} penColorBlock - 펜 색상 블록 영역
 * 
 * 동작 개요:
 *  1) colorPadActive가 false이면, penColorBlock 영역 위에 1초 머무르면 colorPadActive=true
 *  2) colorPadActive=true이면, 4×4 그리드 표시 -> 손가락이 셀 위에 1초 머무르면 penColor 변경
 */
function handleColorPad(penColorBlock) {
  // ─ 색상 패드 비활성 상태 ─
  if (!colorPadActive) {
    // 손이 있으면
    if (hands.length > 0) {
      let hand = hands[0];
      let indexTip = hand.keypoints[8]; // 검지 끝
      let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
      // penColorBlock 영역 위에 1초간 있으면 colorPadActive=true
      if (pointInRect(tipPos, penColorBlock)) {
        if (colorActivationStart === 0) {
          colorActivationStart = millis();
        } else if (millis() - colorActivationStart > 1000) {
          colorPadActive = true;
          console.log("색상 패드 활성화");
          colorActivationStart = 0;
        }
        // 진행도(0~1)
        let progress = constrain((millis() - colorActivationStart) / 1000, 0, 1);
        // 블록 테두리에 보라색 진행 표시
        drawProgressBorder(penColorBlock.x, penColorBlock.y, penColorBlock.size, penColorBlock.size, progress);
      } else {
        // 영역 벗어나면 타이머 리셋
        colorActivationStart = 0;
      }
    }
  } 
  // ─ 색상 패드 활성 상태 ─
  else {
    // 4×4 그리드 (총 16색) 표시
    let gridCols = 4;
    let gridRows = 4;
    let cellSize = 30;
    let gridMargin = 5;
    // 그리드 시작 x좌표: penColorBlock 왼쪽으로 펼쳐지게
    let gridX = penColorBlock.x - (gridCols * (cellSize + gridMargin)) - 10;
    let gridY = penColorBlock.y;
    
    // 어떤 셀이 선택되었는지 추적
    let selectedCellIndex = -1;
    // 모든 셀을 그리며, 손가락이 해당 셀 위에 있는지 검사
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        let cellIndex = r * gridCols + c; // 0~15
        let cellX = gridX + c * (cellSize + gridMargin);
        let cellY = gridY + r * (cellSize + gridMargin);
        // colorPadOptions[cellIndex]로 fill
        fill(colorPadOptions[cellIndex]);
        stroke(0);
        rect(cellX, cellY, cellSize, cellSize);

        // 손이 있으면 셀 위에 있는지 검사
        if (hands.length > 0) {
          let hand = hands[0];
          let indexTip = hand.keypoints[8];
          let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
          // pointInRect()로 셀 내부 여부 확인
          if (pointInRect(tipPos, { x: cellX, y: cellY, size: cellSize })) {
            selectedCellIndex = cellIndex;
          }
        }
      }
    }

    // selectedCellIndex != -1이면 손가락이 특정 셀 위에 있음
    if (selectedCellIndex != -1) {
      // colorPadSelectionStart가 0이면, 지금 막 들어온 것 -> millis()로 초기화
      if (colorPadSelectionStart === 0) {
        colorPadSelectionStart = millis();
      }
      // 진행도 계산(0~1)
      let cellProgress = constrain((millis() - colorPadSelectionStart) / 1000, 0, 1);

      // 해당 셀의 (cellX, cellY) 재계산
      let r = floor(selectedCellIndex / gridCols);
      let c = selectedCellIndex % gridCols;
      let cellX = gridX + c * (cellSize + gridMargin);
      let cellY = gridY + r * (cellSize + gridMargin);

      // 셀 테두리에 진행 표시
      drawProgressBorder(cellX, cellY, cellSize, cellSize, cellProgress);

      // 1초 이상 유지되면 penColor 확정
      if (cellProgress >= 1) {
        penColor = colorPadOptions[selectedCellIndex];
        console.log("색상 확정됨: " + penColor);
        // 색상 패드 닫기
        colorPadActive = false;
        colorPadSelectionStart = 0;
      }
    } else {
      // 셀 위에서 벗어났으면 타이머 리셋
      colorPadSelectionStart = 0;
    }
  }
}

/**
 * @brief 사이즈 패드 활성화 및 사이즈 선택 처리
 * @param {Object} toolSizeBlock - 펜 사이즈 블록 영역
 * 
 * 동작 개요:
 *  1) sizePadActive=false일 때, toolSizeBlock 위에 1초간 손가락이 머무르면 sizePadActive=true
 *  2) sizePadActive=true이면 2×8 그리드(16칸) 표시 -> 손가락이 셀 위에 1초 머무르면 toolSize 변경
 */
function handleSizePad(toolSizeBlock) {
  // ─ 사이즈 패드 비활성 상태 ─
  if (!sizePadActive) {
    // 손이 있으면
    if (hands.length > 0) {
      let hand = hands[0];
      let indexTip = hand.keypoints[8]; // 검지 끝
      let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
      // toolSizeBlock 영역 위에 1초간 있으면 sizePadActive=true
      if (pointInRect(tipPos, toolSizeBlock)) {
        if (sizeActivationStart === 0) {
          sizeActivationStart = millis();
        } else if (millis() - sizeActivationStart > 1000) {
          sizePadActive = true;
          console.log("사이즈 패드 활성화");
          sizeActivationStart = 0;
        }
        // 진행도 표시
        let progress = constrain((millis() - sizeActivationStart) / 1000, 0, 1);
        drawProgressBorder(toolSizeBlock.x, toolSizeBlock.y, toolSizeBlock.size, toolSizeBlock.size, progress);
      } else {
        // 영역 벗어나면 타이머 리셋
        sizeActivationStart = 0;
      }
    }
  } 
  // ─ 사이즈 패드 활성 상태 ─
  else {
    // 2×8 그리드 -> 총 16칸 (사이즈 1~16)
    let gridCols = 8;
    let gridRows = 2;
    let cellWidth = 30;
    let cellHeight = 30;
    let gridMargin = 5;
    // toolSizeBlock 왼쪽으로 열림
    let gridX = toolSizeBlock.x - (gridCols * (cellWidth + gridMargin)) - 10;
    let gridY = toolSizeBlock.y;
    
    // 어떤 셀이 선택되었는지 추적
    let selectedSizeCell = -1;
    // 모든 셀을 표시
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        let cellIndex = r * gridCols + c; // 0~15
        let cellX = gridX + c * (cellWidth + gridMargin);
        let cellY = gridY + r * (cellHeight + gridMargin);
        fill(220);
        stroke(0);
        rect(cellX, cellY, cellWidth, cellHeight);
        fill(0);
        textAlign(CENTER, CENTER);
        textSize(12);
        // 셀 번호(1~16) 표시
        text(cellIndex + 1, cellX + cellWidth / 2, cellY + cellHeight / 2);

        // 손가락이 셀 위에 있는지 검사
        if (hands.length > 0) {
          let hand = hands[0];
          let indexTip = hand.keypoints[8];
          let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
          // pointInRect() -> size=cellWidth
          if (pointInRect(tipPos, { x: cellX, y: cellY, size: cellWidth })) {
            selectedSizeCell = cellIndex;
          }
        }
      }
    }

    // selectedSizeCell != -1이면 특정 셀 위
    if (selectedSizeCell != -1) {
      if (sizePadSelectionStart === 0) {
        sizePadSelectionStart = millis();
      }
      // 진행도 계산(0~1)
      let cellProgress = constrain((millis() - sizePadSelectionStart) / 1000, 0, 1);

      // 셀 위치 재계산
      let r = floor(selectedSizeCell / gridCols);
      let c = selectedSizeCell % gridCols;
      let cellX = gridX + c * (cellWidth + gridMargin);
      let cellY = gridY + r * (cellHeight + gridMargin);

      // 보라색 진행 테두리
      drawProgressBorder(cellX, cellY, cellWidth, cellHeight, cellProgress);

      // 1초 이상이면 toolSize 확정
      if (cellProgress >= 1) {
        toolSize = selectedSizeCell + 1; // 사이즈는 1~16
        console.log("사이즈 확정됨: " + toolSize);
        sizePadActive = false;
        sizePadSelectionStart = 0;
      }
    } else {
      // 셀 벗어나면 타이머 리셋
      sizePadSelectionStart = 0;
    }
  }
}

/**
 * @brief 팔레트 UI에서 펜/지우개 도구를 선택하고, 핀치 동작에 따라 펜/지우개를 사용한다.
 * @param {Object} penIcon - 펜 아이콘 영역
 * @param {Object} eraserIcon - 지우개 아이콘 영역
 * 
 * 동작 개요:
 *  1) penIcon, eraserIcon 위에 1초 이상 머무르면 selectedTool="pen"/"eraser"
 *  2) 그 외 영역에서 엄지-검지 사이 거리가 pinchThreshold 이하이면 핀치 상태
 *  3) 핀치 상태 + selectedTool="pen" -> 드로잉
 *  4) 핀치 상태 + selectedTool="eraser" -> 지우개
 */
function handleToolSelection(penIcon, eraserIcon) {
  // 손이 있어야 도구 선택/핀치 가능
  if (hands.length > 0) {
    let hand = hands[0];
    // 엄지 끝(keypoints[4])과 검지 끝(keypoints[8]) 가져오기
    let thumbTip = hand.keypoints[4];
    let indexTip = hand.keypoints[8];
    // flipX로 x좌표 반전
    let tipPos = { x: flipX(indexTip.x), y: indexTip.y };

    // ─ 펜 아이콘 영역 검사 ─
    if (pointInRect(tipPos, penIcon)) {
      // 처음 들어오면 toolActivationStart=0 -> millis()로 초기화
      if (toolActivationStart === 0) {
        toolActivationStart = millis();
      } else if (millis() - toolActivationStart > 1000) {
        // 1초 이상 유지 -> selectedTool="pen"
        selectedTool = "pen";
        console.log("펜 모드 활성화");
        toolActivationStart = 0;
      }
      // 진행도
      let progress = constrain((millis() - toolActivationStart) / 1000, 0, 1);
      drawProgressBorder(penIcon.x, penIcon.y, penIcon.size, penIcon.size, progress);
    }
    // ─ 지우개 아이콘 영역 검사 ─
    else if (pointInRect(tipPos, eraserIcon)) {
      if (toolActivationStart === 0) {
        toolActivationStart = millis();
      } else if (millis() - toolActivationStart > 1000) {
        // 1초 이상 유지 -> selectedTool="eraser"
        selectedTool = "eraser";
        console.log("지우개 모드 활성화");
        toolActivationStart = 0;
      }
      let progress = constrain((millis() - toolActivationStart) / 1000, 0, 1);
      drawProgressBorder(eraserIcon.x, eraserIcon.y, eraserIcon.size, eraserIcon.size, progress);
    }
    // ─ 도구 아이콘 영역이 아닌 곳 ─
    else {
      // 타이머 리셋
      toolActivationStart = 0;

      // ─ 핀치 동작 검사 ─
      const pinchThreshold = 20; // 엄지-검지 거리 20px 이하이면 핀치
      let pinchDistance = dist(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y);
      let isPinched = pinchDistance < pinchThreshold;

      // 엄지, 검지의 flipX 적용 좌표
      let thumbPos = { x: flipX(thumbTip.x), y: thumbTip.y };
      let indexPos = { x: flipX(indexTip.x), y: indexTip.y };
      // 파란 선으로 엄지-검지 연결 시각화
      push();
      stroke(0, 0, 255, 150);
      strokeWeight(4);
      line(thumbPos.x, thumbPos.y, indexPos.x, indexPos.y);
      pop();

      // "Active" 텍스트 표시(핀치 상태일 때)
      if (isPinched) {
        let midX = (thumbPos.x + indexPos.x) / 2;
        let midY = (thumbPos.y + indexPos.y) / 2;
        push();
        textAlign(CENTER, CENTER);
        textSize(24);
        fill(255, 255, 255, 150);
        text("Active", midX, midY - 30);
        pop();
      }

      // ─ selectedTool이 pen이면 -> 드로잉 ─
      if (selectedTool === "pen") {
        if (isPinched) {
          // 보라색 원 표시 (펜 터치 지점)
          push();
          noStroke();
          fill(128, 0, 128, 150);
          ellipse(tipPos.x, tipPos.y, toolSize * 3, toolSize * 3);
          pop();
          // drawingLayer에 선 그리기
          drawingLayer.stroke(penColor);
          drawingLayer.strokeWeight(toolSize);
          if (lastTipPos != null) {
            // 이전 프레임 좌표~현재 프레임 좌표를 잇는 선
            drawingLayer.line(lastTipPos.x, lastTipPos.y, tipPos.x, tipPos.y);
          }
          // lastTipPos 갱신
          lastTipPos = tipPos;
        } else {
          // 핀치가 풀리면 lastTipPos 초기화
          lastTipPos = null;
        }
      }
      // ─ selectedTool이 eraser이면 -> 지우개 ─
      else if (selectedTool === "eraser") {
        if (isPinched) {
          // 보라색 원 표시 (지우개 터치 지점)
          push();
          noStroke();
          fill(128, 0, 128, 150);
          ellipse(tipPos.x, tipPos.y, toolSize * 5, toolSize * 5);
          pop();
          lastTipPos = tipPos;
          // drawingLayer.erase() ~ noErase()로 지우개 처리
          drawingLayer.erase();
          drawingLayer.noStroke();
          // toolSize * 5 크기로 원을 그려 그 영역을 지움
          drawingLayer.ellipse(tipPos.x, tipPos.y, toolSize * 5, toolSize * 5);
          drawingLayer.noErase();
        } else {
          // 핀치가 풀리면 lastTipPos 초기화
          lastTipPos = null;
        }
      }
    }
  }
}

// ----------------------------------------------------
// 헬퍼 함수: pointInRect
// ----------------------------------------------------

/**
 * @brief pt가 rectObj 영역 내부에 있는지 판별한다.
 * @param {Object} pt      - { x, y } 형태로, 검사할 점의 좌표
 * @param {Object} rectObj - { x, y, size } 또는 { x, y, width, height } 형태의 영역 정보
 * @return {boolean}       - 점이 사각형 내부에 있으면 true, 아니면 false
 *
 * 동작 개요:
 *  1) rectObj에 size가 존재한다면, rectObj.width, rectObj.height 대신 rectObj.size 사용
 *  2) pt.x가 rectObj.x ~ rectObj.x+rectObj.size 사이에 있고,
 *     pt.y가 rectObj.y ~ rectObj.y+rectObj.size 사이에 있으면 내부로 판단
 *
 * 사용 예시:
 *   if (pointInRect({x:10, y:20}, {x:0, y:0, size:50})) {
 *     // (10,20)은 (0,0)에서 가로세로 50인 사각형 내부
 *   }
 */
function pointInRect(pt, rectObj) {
  return pt.x > rectObj.x && pt.x < rectObj.x + rectObj.size &&
         pt.y > rectObj.y && pt.y < rectObj.y + rectObj.size;
}

// ----------------------------------------------------
// p5.js setup(), draw()
// ----------------------------------------------------

/**
 * @brief p5.js 초기화 함수. 캔버스, 웹캠, drawingLayer 설정 후 HandPose 시작.
 * 
 * 동작 개요:
 *  1) createCanvas(640, 480): 640×480 크기의 캔버스 생성
 *  2) createCapture(VIDEO, { flipped: true }): 웹캠을 좌우 반전 모드로 캡처
 *  3) video.size(640, 480) 및 video.hide()로 웹캠 영상 세팅
 *  4) drawingLayer = createGraphics(640, 480)로 드로잉용 그래픽 레이어 생성
 *  5) handPose.detectStart(video, gotHands): ml5.js HandPose 모델에 영상, 콜백 설정
 */
function setup() {
  // (1) 640×480 캔버스 생성
  createCanvas(640, 480);

  // (2) 웹캠 캡처, flipped:true로 좌우 반전
  video = createCapture(VIDEO, { flipped: true });
  // (3) 웹캠 해상도 설정(640×480), video 요소 숨기기
  video.size(640, 480);
  video.hide();

  // (4) 드로잉용 레이어 생성, 초기 상태는 투명(clear)
  drawingLayer = createGraphics(640, 480);
  drawingLayer.clear();

  // (5) HandPose 모델 시작: video를 입력으로, 결과는 gotHands 콜백으로
  handPose.detectStart(video, gotHands);
}

/**
 * @brief p5.js 메인 루프. 매 프레임마다 영상, 제스처, 팔레트 모드, 버튼 등을 업데이트한다.
 * 
 * 동작 개요:
 *  1) image(video, 0, 0, width, height): 웹캠 영상을 캔버스에 표시
 *  2) drawHandKeypointsAndSkeleton(): HandPose 결과(키포인트, 스켈레톤) 그리기
 *  3) hands.length가 0보다 크면 -> detectGesture(hands[0])로 제스처 인식
 *     - gestureTimer 누적 -> 일정 시간(gestureThreshold=1초) 이상 유지되면 확정
 *     - 확정된 제스처에 따라 changeMode() 호출
 *  4) paletteActive가 true이면 drawPalette() 호출
 *  5) currentMode가 "default"이면 drawReactiveButtons() 호출
 *  6) image(drawingLayer, 0, 0): 펜 드로잉 레이어를 화면에 합성
 *  7) 화면 좌측 상단에 gestureMessage 표시
 *  8) currentMode가 "default"가 아니면 drawOverlay()로 오버레이
 */
function draw() {
  // (1) 웹캠 영상 표시
  image(video, 0, 0, width, height);

  // (2) HandPose 결과(키포인트, 스켈레톤) 표시
  drawHandKeypointsAndSkeleton();
  
  // (3) 제스처 인식
  if (hands.length > 0) {
    // 첫 번째 손(hands[0])로 detectGesture
    let detectedGesture = detectGesture(hands[0]);

    // 이전 프레임과 같은 제스처면 gestureTimer 누적, 아니면 0으로 리셋
    if (detectedGesture === lastGesture) {
      gestureTimer += deltaTime;   // deltaTime은 이전 프레임과의 시간(ms)
    } else {
      lastGesture = detectedGesture;
      gestureTimer = 0;
    }

    // 손의 평균 위치(avgPos)를 구해 게이지 표시
    let avgPos = getAverageKeypointPosition(hands[0]);
    // 0~1 범위의 진행도
    let progress = constrain(gestureTimer / gestureThreshold, 0, 1);
    drawGestureGauge(progress, avgPos);
    
    // gestureTimer가 1초 이상 유지 & 현재 확정 제스처와 다르면 -> 제스처 확정
    if (gestureTimer >= gestureThreshold && detectedGesture !== confirmedGesture) {
      confirmedGesture = detectedGesture;
      // 모드 변경
      changeMode(confirmedGesture);
    }
  } else {
    // 손이 없으면 제스처 관련 변수 초기화
    gestureTimer = 0;
    lastGesture = "";
    confirmedGesture = "";
    // 팔레트 모드가 아니라면, 게이지를 0으로 표시
    if (!paletteActive) {
      drawGestureGauge(0, { x: width / 2, y: height - 40 });
    }
  }
  
  // (4) 팔레트 모드가 활성화되어 있으면, drawPalette()로 펜 설정 UI 표시
  if (paletteActive) {
    drawPalette();
  }
  
  // (5) currentMode가 "default"이면, 반응형 버튼 표시
  if (currentMode === "default") {
    drawReactiveButtons();
  }
  
  // (6) 펜 드로잉 레이어 합성
  image(drawingLayer, 0, 0);
  
  // (7) 화면 좌측 상단에 제스처 메시지 표시
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text(gestureMessage, 10, 10);
  
  // (8) currentMode가 "default"가 아니면 -> drawOverlay()로 오버레이
  if (currentMode !== "default") {
    drawOverlay(currentMode);
  }
}

// ----------------------------------------------------
// Reactive Button 관련
// ----------------------------------------------------

/**
 * @brief 캔버스 좌측 중앙에 배치된 반응형 버튼들.
 * 
 * 각 버튼은:
 *   - id: 버튼 식별 번호
 *   - label: 화면에 표시될 이모지(🖐️, 😍, 🤣, 😮 등)
 *   - x, y, width, height: 버튼의 위치 및 크기
 *   - activationStart: 버튼 위에 손가락이 머무르기 시작한 시점 (millis() 값)
 *   - active: 버튼이 활성화되었는지 여부
 *   - displayStart: 버튼 활성화가 시작된 시점 (millis() 값) -> 효과 함수에서 사용
 *   - triggered, effectCalled: 추가적으로 사용할 수 있는 플래그 (현재는 사용 안함)
 */
let reactiveButtons = [
  { id: 1, label: "🖐️", x: 20, y: 135, width: 50, height: 50, activationStart: 0, active: false, displayStart: 0, triggered: false, effectCalled: false },
  { id: 2, label: "😍", x: 20, y: 195, width: 50, height: 50, activationStart: 0, active: false, displayStart: 0, triggered: false, effectCalled: false },
  { id: 3, label: "🤣", x: 20, y: 255, width: 50, height: 50, activationStart: 0, active: false, displayStart: 0, triggered: false, effectCalled: false },
  { id: 4, label: "😮", x: 20, y: 315, width: 50, height: 50, activationStart: 0, active: false, displayStart: 0, triggered: false, effectCalled: false }
];

/**
 * @brief 기본 모드에서만 반응형 버튼을 그리며, 1초간 버튼 영역에 머물면 버튼이 활성화된다.
 * 
 * 동작 개요:
 *   1) currentMode가 "default"가 아니거나, paletteActive=true라면 버튼 표시/작동 안 함
 *   2) 각 버튼을 순회하여 배경(색상), 라벨(이모지) 그리기
 *   3) 손가락(검지)이 버튼 영역 위에 1초 이상 있으면 active=true
 *   4) active=true된 버튼은 3초 후 해제(효과 함수에서 해제 로직 수행)
 */
function drawReactiveButtons() {
  // (1) 기본 모드가 아니거나, 팔레트 모드면 버튼 동작 안 함
  if (currentMode !== "default" || paletteActive) return;

  // (2) hands.length>0이면 손이 존재
  let handActive = (hands.length > 0);
  let indexTip = null;
  if (handActive) {
    // hands[0].keypoints[8] -> 첫 번째 손의 검지 끝
    let tip = hands[0].keypoints[8];
    // flipX(tip.x)로 x 좌표 반전, y는 그대로
    indexTip = { x: flipX(tip.x), y: tip.y };
  }
  
  // anyActive: 하나라도 active=true인 버튼이 있으면 true
  // (어떤 버튼이 이미 활성화 상태라면, 다른 버튼은 눌러지지 않도록)
  let anyActive = reactiveButtons.some(b => b.active);
  
  // (3) 모든 버튼을 순회
  for (let i = 0; i < reactiveButtons.length; i++) {
    let btn = reactiveButtons[i];
    
    // ─ 버튼 배경 색상 설정 ─
    // 아무 버튼도 활성화되지 않았다면 연녹색(140,255,140),
    // 이미 다른 버튼이 활성화됐다면 연분홍색(255,150,150)
    if (!anyActive) {
      fill(140, 255, 140);
    } else {
      fill(255, 150, 150);
    }
    stroke(0);
    // (btn.x, btn.y)에 (btn.width, btn.height) 크기의 사각형 그리기
    rect(btn.x, btn.y, btn.width, btn.height);
    
    // ─ 버튼 라벨(이모지) 표시 ─
    push();
    fill(255);                // 라벨 텍스트는 흰색
    textAlign(CENTER, CENTER);// 중앙 정렬
    textSize(30);             // 이모지 크기(30px)
    text(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2);
    pop();
    
    // ─ 손가락이 버튼 영역 안에 있는지 검사 ─
    // (다른 버튼이 active라면 선택 불가)
    if (handActive && indexTip &&
        indexTip.x >= btn.x && indexTip.x <= btn.x + btn.width &&
        indexTip.y >= btn.y && indexTip.y <= btn.y + btn.height && !anyActive) {
      
      // 아직 활성화되지 않았다면( btn.active=false ) -> 1초 카운트
      if (!btn.active) {
        // 처음 들어온 경우 btn.activationStart=0 -> millis()로 초기화
        if (btn.activationStart === 0) {
          btn.activationStart = millis();
        } else {
          // 1초 경과 판단
          let progress = (millis() - btn.activationStart) / 1000;
          // 버튼 테두리에 진행도 표시(보라색)
          drawProgressBorder(btn.x, btn.y, btn.width, btn.height, constrain(progress, 0, 1));
          // 1초 넘으면 active=true
          if (progress >= 1) {
            btn.active = true;
            btn.displayStart = millis();
            btn.activationStart = 0; // 타이머 리셋
            console.log("버튼 " + btn.id + " 효과 활성화됨");
          }
        }
      }
    } else {
      // 손이 영역을 벗어나거나, 다른 버튼이 이미 활성화 중이면
      // 아직 활성화되지 않은 버튼은 타이머 리셋
      if (!btn.active) {
        btn.activationStart = 0;
      }
    }
    
    // ─ 버튼이 활성화된 경우(active=true) -> 3초 후 해제 ─
    // 실제 해제 로직은 handleButtonXEffect 함수 내에서 millis() 체크 후 수행
    if (btn.active) {
      // 버튼 id에 따라 다른 효과 함수 호출
      switch (btn.id) {
        case 1:
          handleButton1Effect(btn);
          break;
        case 2:
          handleButton2Effect(btn);
          break;
        case 3:
          handleButton3Effect(btn);
          break;
        case 4:
          handleButton4Effect(btn);
          break;
      }
    }
  }
}

// ----------------------------------------------------
// 버튼 효과 함수들 (3초 지속)
// ----------------------------------------------------

/**
 * @brief 각 버튼 효과가 3초 경과 시 버튼 상태를 해제한다.
 * 
 * 전역 변수:
 *  - effectDuration (ms): 3000 -> 3초
 *  - handleButton1Effect, handleButton2Effect, handleButton3Effect, handleButton4Effect
 *    각 버튼의 고유 효과를 담당하는 함수. 활성화된 버튼(btn.active=true)이
 *    3초 이상 경과하면 btn.active=false로 되돌리고 해제 처리.
 */
let effectDuration = 3000;

/**
 * @brief 버튼 1 효과: "안녕하세요! 반가워요." (🖐️)
 * @param {Object} btn - 활성화된 버튼 객체
 * 
 * 동작 개요:
 *  1) 3초(elapsed >= effectDuration) 경과 시 버튼 해제
 *  2) 초기 실행 시 btn.emojis가 없으면 좌우 두 지점에 🖐️ 이모지를 배치
 *  3) sin(millis()/500)로 좌우 손바닥을 흔들듯이 약간 회전
 *  4) 화면 상단에 "안녕하세요! 반가워요." 텍스트 표시
 */
function handleButton1Effect(btn) {
  // elapsed: 버튼 활성화된 후 경과 시간(ms)
  let elapsed = millis() - btn.displayStart;

  // (1) 3초 경과하면 해제
  if (elapsed >= effectDuration) {
    btn.active = false;
    btn.activationStart = 0;
    btn.displayStart = 0;
    // btn.emojis에 저장된 임시 데이터 제거
    delete btn.emojis;
    console.log("버튼 1 효과 해제됨");
    return;
  }
  
  // (2) 최초 실행 시 btn.emojis가 undefined -> 좌우 위치 정의
  if (!btn.emojis) {
    btn.emojis = {
      left: { x: width * 0.25, y: height / 2 },   // 화면 왼쪽 25% 지점, 수직 중앙
      right: { x: width * 0.75, y: height / 2 }  // 화면 오른쪽 75% 지점, 수직 중앙
    };
  }
  
  // (3) 흔들림 애니메이션: sin(millis()/500) * 0.5
  let angleOffset = sin(millis() / 500) * 0.5;
  
  // ─ 좌측 이모지 ─
  push();
  translate(btn.emojis.left.x, btn.emojis.left.y); // 기준점 이동
  textAlign(CENTER, CENTER);   // 회전 중심이 텍스트 중앙이 되도록
  rotate(angleOffset);         // 시계방향 회전
  textSize(150);               // 이모지 크기(150px)
  fill(0, 0, 255);             // 파란색
  text("🖐️", 0, 0);           // (0,0)에 이모지 그리기
  pop();
  
  // ─ 우측 이모지 ─
  push();
  translate(btn.emojis.right.x, btn.emojis.right.y);
  textAlign(CENTER, CENTER);
  rotate(-angleOffset);        // 반시계방향 회전
  textSize(150);
  fill(0, 0, 255);
  text("🖐️", 0, 0);
  pop();
  
  // ─ 화면 상단 텍스트 ─
  push();
  textAlign(CENTER, TOP);      // 수평 중앙, 수직 상단 정렬
  textSize(32);
  fill(255,255,0);             // 노란색 텍스트
  text("안녕하세요! 반가워요.", width / 2, 10);
  pop();
}

/**
 * @brief 버튼 2 효과: "감동 받았어요!" (😍)
 * @param {Object} btn - 활성화된 버튼 객체
 * 
 * 동작 개요:
 *  1) 3초 경과 시 해제
 *  2) 최초 실행 시, 화면 임의 위치에 4~8개의 😍 이모지 생성
 *  3) 각 이모지는 angle 속성을 조금씩 변화시켜 흔들림
 *  4) 화면 상단에 "감동 받았어요!" 텍스트 표시
 */
function handleButton2Effect(btn) {
  let elapsed = millis() - btn.displayStart;
  // (1) 3초 후 해제
  if (elapsed >= effectDuration) {
    btn.active = false;
    btn.activationStart = 0;
    btn.displayStart = 0;
    delete btn.emojis;
    console.log("버튼 2 효과 해제됨");
    return;
  }
  
  // (2) 최초 실행 시, btn.emojis 배열에 여러 😍 이모지 정보 push
  if (!btn.emojis) {
    btn.emojis = [];
    // 6~9개 이모지
    let count = int(random(6, 9));
    for (let i = 0; i < count; i++) {
      btn.emojis.push({
        x: random(50, width - 50),   // 화면 안쪽(가로)
        y: random(50, height - 50), // 화면 안쪽(세로)
        angle: random(-0.2, 0.2),   // 초기 회전값
        size: random(50, 125)       // 이모지 크기
      });
    }
  }
  
  // (3) 각 이모지 angle을 약간씩 변화 -> 흔들림
  for (let emoji of btn.emojis) {
    // 흔들림 범위 확대: random(-0.06, 0.06)
    emoji.angle += random(-0.06, 0.06);
    push();
    translate(emoji.x, emoji.y);  // 이모지 위치로 이동
    rotate(emoji.angle);          // 각도만큼 회전
    textSize(emoji.size);         // 이모지 크기
    fill(0, 0, 255);              // 파란색
    text("😍", 0, 0);             // (0,0)에 이모지
    pop();
  }
  
  // (4) 화면 상단 텍스트
  push();
  textAlign(CENTER, TOP);
  textSize(32);
  fill(125, 0, 125);             // 보라색 텍스트
  text("감동 받았어요!", width / 2, 10);
  pop();
}

/**
 * @brief 버튼 3 효과: "웃음이 터져요!" (🤣)
 * @param {Object} btn - 활성화된 버튼 객체
 * 
 * 동작 개요:
 *  1) 3초 경과 시 해제
 *  2) 최초 실행 시, 화면 하단 밖에서 위로 올라오는 🤣 이모지 여러 개 생성
 *  3) 각 이모지는 매 프레임 y -= speed로 위로 이동
 *  4) 화면 상단에 "웃음이 터져요!" 텍스트 표시
 */
function handleButton3Effect(btn) {
  let elapsed = millis() - btn.displayStart;
  // (1) 3초 후 해제
  if (elapsed >= effectDuration) {
    btn.active = false;
    btn.activationStart = 0;
    btn.displayStart = 0;
    delete btn.emojis;
    console.log("버튼 3 효과 해제됨");
    return;
  }
  
  // (2) 최초 실행 시, 여러 🤣 이모지를 아래쪽(화면 밖)에서 생성
  if (!btn.emojis) {
    btn.emojis = [];
    // 10개 정도 생성
    for (let i = 0; i < 10; i++) {
      btn.emojis.push({
        x: random(width),          // 화면 가로 범위 임의 위치
        y: height + random(20, 100), // 화면 하단 밖(높이+α)
        size: random(30, 60),      // 이모지 크기
        speed: random(0.5, 2)      // 위로 이동 속도
      });
    }
  }
  
  // (3) 각 이모지를 위로 이동(y -= speed) 후 표시
  for (let emoji of btn.emojis) {
    emoji.y -= emoji.speed; // 위로 이동
    push();
    textAlign(CENTER, CENTER);
    textSize(emoji.size);
    fill(0, 0, 255);        // 파란색
    text("🤣", emoji.x, emoji.y);
    pop();
  }
  
  // (4) 화면 상단 텍스트
  push();
  textAlign(CENTER, TOP);
  textSize(32);
  fill(0,255,255);         // 청록색
  text("웃음이 터져요!", width / 2, 10);
  pop();
}

/**
 * @brief 버튼 4 효과: "놀라워요!" (😮)
 * @param {Object} btn - 활성화된 버튼 객체
 * 
 * 동작 개요:
 *  1) 3초 경과 시 해제
 *  2) 최초 실행 시, 중앙에서 😮 이모지가 파티클처럼 튀어나오는 효과
 *  3) 각 파티클은 랜덤 방향, 속도로 이동
 *  4) frameCount%60==0 마다 새로운 파티클 추가
 *  5) 화면 상단에 "놀라워요!" 텍스트 표시
 */
function handleButton4Effect(btn) {
  let elapsed = millis() - btn.displayStart;
  // (1) 3초 후 해제
  if (elapsed >= effectDuration) {
    btn.active = false;
    btn.activationStart = 0;
    btn.displayStart = 0;
    // 파티클 데이터 제거
    delete btn.emojis;
    console.log("버튼 4 효과 해제됨");
    return;
  }
  
  // (2) 최초 실행 시, 30개 파티클 생성
  if (!btn.emojis) {
    btn.emojis = [];
    for (let i = 0; i < 30; i++) {
      btn.emojis.push(createEmojiParticle());
    }
  }
  
  // (3) 각 파티클 위치 업데이트, 😮 표시
  for (let i = btn.emojis.length - 1; i >= 0; i--) {
    let e = btn.emojis[i];
    // x, y에 vx, vy 더해 이동
    e.x += e.vx;
    e.y += e.vy;
    push();
    textAlign(CENTER, CENTER);
    textSize(e.size);
    fill(0);   // 검정색
    text("😮", e.x, e.y);
    pop();
  }
  
  // (4) 60프레임(약 1초)마다 새로운 파티클 추가
  if (frameCount % 60 === 0) {
    btn.emojis.push(createEmojiParticle());
  }
  
  // (5) 화면 상단 텍스트
  push();
  textAlign(CENTER, TOP);
  textSize(32);
  fill(255,165,0); // 오렌지색
  text("놀라워요!", width / 2, 10);
  pop();
}

// ----------------------------------------------------
// 이모지 파티클 생성 (버튼 4)
// ----------------------------------------------------

/**
 * @brief 😮 이모지 파티클-like 객체를 생성한다.
 * @return {Object} 파티클 객체 (x, y, vx, vy, size 등)
 * 
 * 동작 개요:
 *  1) 초기 위치(x,y)는 화면 중앙(width/2, height/2)
 *  2) vx, vy는 랜덤 방향과 랜덤 속도(1~3)
 *  3) size는 15~60 범위의 랜덤값
 */
function createEmojiParticle() {
  return {
    x: width / 2,   // 중앙 x
    y: height / 2,  // 중앙 y
    vx: cos(random(0, TWO_PI)) * random(1, 3), // 임의 각도, 속도
    vy: sin(random(0, TWO_PI)) * random(1, 3),
    size: random(15, 60) // 크기
  };
}
