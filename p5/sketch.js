// 전역 변수 정의
let video;
let hands = [];
let gestureTimer = 0;
let gestureThreshold = 1000; // 1초 (1000ms)
let lastGesture = "";
let confirmedGesture = "";
let paletteActive = false; // 팔레트 모드 활성 여부
let gestureMessage = "";
let currentMode = "default"; // default, emergency, thumbsUp, thumbsDown

// 팔레트 모드에서 사용할 도구 관련 변수
let selectedTool = "";  // "pen" 또는 "eraser"
let toolActivationStart = 0;  // 아이콘 위에 손가락이 머문 시간을 위한 타이머

// drawingLayer: 펜으로 그린 픽셀을 기록할 p5.Graphics 레이어
let drawingLayer;
let lastTipPos = null; // 펜 도구 사용 시 마지막 검지 끝 좌표

// 전체 지우기 버튼 관련
let clearActivationStart = 0;

// 추가: 펜 색상 및 도구 크기 설정 관련 변수
let penColor = '#000000';
let availableColors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
let currentColorIndex = 0;
let toolSize = 4;
let availableSizes = [2, 4, 6, 8, 10];
let currentSizeIndex = 1;
let colorActivationStart = 0;
let sizeActivationStart = 0;

// 색상 패드 관련 전역 변수
let colorPadActive = false;
let colorPadSelectionStart = 0;
let colorPadOptions = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00',
  '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#800000', '#008000', '#000080', '#808000',
  '#800080', '#008080', '#808080', '#C0C0C0'
];

// 사이즈 패드 관련 전역 변수
let sizePadActive = false;
let sizePadSelectionStart = 0;

const fingerConnections = [       
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20]
];

// ── 버튼1 효과 관련 전역 변수 및 함수 ──
let btn1Effect = {
  active: false,
  startTime: 0,
  particles: []
};
// ── 파티클 클래스 정의 ──
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    let angle = random(0, TWO_PI);
    let speed = random(1, 3);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
    this.alpha = 255;
    this.size = random(5, 15);
    // 주황과 노랑 색상 중 하나 선택 (배열에서 랜덤 선택)
    let colors = [[255, 165, 0], [255, 255, 0]];
    this.col = random(colors);
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 2; // 매 프레임마다 서서히 페이드 아웃
    if (this.alpha < 0) this.alpha = 0;
  }
  display() {
    noStroke();
    fill(this.col[0], this.col[1], this.col[2], this.alpha);
    ellipse(this.x, this.y, this.size);
  }
  isDead() {
    return this.alpha <= 0;
  }
}

function preload() {
  handPose = ml5.handPose();
}

function gotHands(results) {
  hands = results;
}

function flipX(x) {
  return 640 - x; 
}

function drawHandKeypointsAndSkeleton() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.keypoints.length; j++) {
      let kpt = hand.keypoints[j];
      fill(255, 0, 0);
      noStroke();
      circle(flipX(kpt.x), kpt.y, 10);
    }
    stroke(0, 255, 0);
    strokeWeight(2);
    for (let c = 0; c < fingerConnections.length; c++) {
      let [a, b] = fingerConnections[c];
      let ptA = hand.keypoints[a];
      let ptB = hand.keypoints[b];
      line(flipX(ptA.x), ptA.y, flipX(ptB.x), ptB.y);
    }
  }
}

function detectGesture(hand) {
  let resultGesture = "Unknown";
  if (!hand || !hand.keypoints || hand.keypoints.length < 21) {
    // 유효한 손 데이터가 없으면 판별 생략
  } else {
    const wrist = hand.keypoints[0];
    const thumbTip = hand.keypoints[4];
    const indexTip = hand.keypoints[8];
    const middleTip = hand.keypoints[12];
    const ringTip = hand.keypoints[16];
    const pinkyTip = hand.keypoints[20];
    
    const handSize = dist(wrist.x, wrist.y, middleTip.x, middleTip.y);
    const centroidX = (thumbTip.x + indexTip.x + middleTip.x + ringTip.x + pinkyTip.x) / 5;
    const centroidY = (thumbTip.y + indexTip.y + middleTip.y + ringTip.y + pinkyTip.y) / 5;
    const closeThreshold = handSize * 0.2;
    const tips = [thumbTip, indexTip, middleTip, ringTip, pinkyTip];
    const allTipsClose = tips.every(tip => dist(tip.x, tip.y, centroidX, centroidY) < closeThreshold);
    
    const factor = 1.2;
    const thumbMCP = hand.keypoints[2];
    const thumbExtended = dist(wrist.x, wrist.y, thumbTip.x, thumbTip.y) > factor * dist(wrist.x, wrist.y, thumbMCP.x, thumbMCP.y);
    const indexMCP = hand.keypoints[5];
    const indexExtended = dist(wrist.x, wrist.y, indexTip.x, indexTip.y) > factor * dist(wrist.x, wrist.y, indexMCP.x, indexMCP.y);
    const middleMCP = hand.keypoints[9];
    const middleExtended = dist(wrist.x, wrist.y, middleTip.x, middleTip.y) > factor * dist(wrist.x, wrist.y, middleMCP.x, middleMCP.y);
    const ringMCP = hand.keypoints[13];
    const ringExtended = dist(wrist.x, wrist.y, ringTip.x, ringTip.y) > factor * dist(wrist.x, wrist.y, ringMCP.x, ringMCP.y);
    const pinkyMCP = hand.keypoints[17];
    const pinkyExtended = dist(wrist.x, wrist.y, pinkyTip.x, pinkyTip.y) > factor * dist(wrist.x, wrist.y, pinkyMCP.x, pinkyMCP.y);
    
    if (allTipsClose) {
      resultGesture = "Default";
    } else if (thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) {
      resultGesture = "Palette";
    } else if (indexExtended && middleExtended && thumbExtended && !ringExtended && !pinkyExtended) {
      resultGesture = "Emergency"; 
    } else if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      if (thumbTip.y < thumbMCP.y) {
        resultGesture = "ThumbsUp";
      } else {
        resultGesture = "ThumbsDown";
      }
    }
  }
  gestureMessage = `Gesture detected: ${resultGesture}`;
  return resultGesture;
}

function getAverageKeypointPosition(hand) {
  let sumX = 0, sumY = 0;
  for (let i = 0; i < hand.keypoints.length; i++) {
    sumX += hand.keypoints[i].x;
    sumY += hand.keypoints[i].y;
  }
  return { x: flipX(sumX / hand.keypoints.length), y: sumY / hand.keypoints.length };
}

function drawGestureGauge(percentage, avgPos) {
  let gaugeWidth = width * 0.2;
  let gaugeHeight = 10;
  let x = avgPos.x - gaugeWidth / 2;
  let y = avgPos.y + 70;
  stroke(0);
  noFill();
  rect(x, y, gaugeWidth, gaugeHeight);
  noStroke();
  fill(0, 200, 0, 150);
  rect(x, y, gaugeWidth * percentage, gaugeHeight);
}

// drawProgressBorder: 보라색 진행 테두리 표시 (1초 진행 상황)
function drawProgressBorder(x, y, w, h, percentage) {
  push();
  noFill();
  stroke(255, 69, 0, percentage * 255);
  strokeWeight(3);
  rect(x, y, w, h);
  pop();
}

function changeMode(gesture) {
  if (gesture === "Palette") {
    paletteActive = !paletteActive;
    currentMode = "default"; // 팔레트 모드 진입 시 기본 모드 전환
    console.log("팔레트 모드 " + (paletteActive ? "활성화" : "비활성화") + "되었습니다. 모드는 기본 상태로 전환됩니다.");
    return;
  }
  if (paletteActive) return;
  if (gesture === "Default") {
    currentMode = "default";
    console.log("기본 모드로 돌아갑니다.");
    return;
  }
  if (gesture === "Emergency") {
    currentMode = "emergency";
    console.log("긴급 모드로 진입합니다.");
  } else if (gesture === "ThumbsUp") {
    currentMode = "thumbsUp";
    console.log("엄지 위 모드로 진입합니다.");
  } else if (gesture === "ThumbsDown") {
    currentMode = "thumbsDown";
    console.log("엄지 아래 모드로 진입합니다.");
  }
}

function drawOverlay(mode) {
  push();
  noStroke();
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  textAlign(CENTER, CENTER);
  textSize(48);
  fill(255);
  if (mode === "emergency") {
    text("자리 비움", width / 2, height / 2);
  } else if (mode === "thumbsUp") {
    text("좋은 의견이에요!", width / 2, height / 2);
  } else if (mode === "thumbsDown") {
    text("질문 있어요!", width / 2, height / 2);
  }
  pop();
}

// ── 팔레트 모드 UI ──
function drawPalette() {
  // Clear All 버튼 (좌측 상단)
  const clearButton = { x: 20, y: 150, width: 50, height: 50 };
  fill(255, 125, 125);
  stroke(0);
  rect(clearButton.x, clearButton.y, clearButton.width, clearButton.height);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(12);
  text("All Clear", clearButton.x + clearButton.width/2, clearButton.y + clearButton.height/2);
  if (hands.length > 0) {
    let hand = hands[0];
    let indexTip = hand.keypoints[8];
    let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
    if (tipPos.x > clearButton.x && tipPos.x < clearButton.x + clearButton.width &&
        tipPos.y > clearButton.y && tipPos.y < clearButton.y + clearButton.height) {
      if (clearActivationStart === 0) {
        clearActivationStart = millis();
      } else if (millis() - clearActivationStart > 1000) {
        drawingLayer.clear();
        console.log("전체 지우기 실행됨");
        clearActivationStart = 0;
      }
      let progress = constrain((millis() - clearActivationStart) / 1000, 0, 1);
      drawProgressBorder(clearButton.x, clearButton.y, clearButton.width, clearButton.height, progress);
    } else {
      clearActivationStart = 0;
    }
  }
  
  // 아이콘 및 설정 블록 위치 정의
  const penIcon = { x: 580, y: 75, size: 50 };
  const eraserIcon = { x: 580, y: 150, size: 50 };
  const toolSizeBlock = { x: 580, y: 225, size: 50 };
  const penColorBlock = { x: 580, y: 300, size: 50 };
  
  // 도구 아이콘 및 설정 블록 그리기
  // 도구 아이콘
  fill(selectedTool === "pen" ? '#009688' : 'white');
  stroke(0);
  rect(penIcon.x, penIcon.y, penIcon.size, penIcon.size);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("pen", penIcon.x + penIcon.size/2, penIcon.y + penIcon.size/2);
  fill(selectedTool === "eraser" ? '#009688' : 'white');
  stroke(0);
  rect(eraserIcon.x, eraserIcon.y, eraserIcon.size, eraserIcon.size);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("eraser", eraserIcon.x + eraserIcon.size/2, eraserIcon.y + eraserIcon.size/2);

  // 기본 컬러 박스 (펜 색상 블록)
  fill(penColor);
  stroke(0);
  rect(penColorBlock.x, penColorBlock.y, penColorBlock.size, penColorBlock.size);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("Color", penColorBlock.x + penColorBlock.size/2, penColorBlock.y + penColorBlock.size/2);
  
  // 도구 크기 설정 블록 (텍스트로 표시)
  fill(200);
  stroke(0);
  rect(toolSizeBlock.x, toolSizeBlock.y, toolSizeBlock.size, toolSizeBlock.size);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("Size : " + toolSize, toolSizeBlock.x + toolSizeBlock.size/2, toolSizeBlock.y + toolSizeBlock.size/2);
  
  // ─ 색상 패드 처리 ─
  if (!colorPadActive) {
    if (hands.length > 0) {
      let hand = hands[0];
      let indexTip = hand.keypoints[8];
      let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
      if (pointInRect(tipPos, penColorBlock)) {
        if (colorActivationStart === 0) {
          colorActivationStart = millis();
        } else if (millis() - colorActivationStart > 1000) {
          colorPadActive = true;
          console.log("색상 패드 활성화");
          colorActivationStart = 0;
        }
        let progress = constrain((millis() - colorActivationStart) / 1000, 0, 1);
        drawProgressBorder(penColorBlock.x, penColorBlock.y, penColorBlock.size, penColorBlock.size, progress);
      } else {
        colorActivationStart = 0;
      }
    }
  } else {
    // 색상 패드가 활성화된 상태: 4×4 그리드 (왼쪽으로 열림)
    let gridCols = 4;
    let gridRows = 4;
    let cellSize = 30;
    let gridMargin = 5;
    let gridX = penColorBlock.x - (gridCols * (cellSize + gridMargin)) - 10;
    let gridY = penColorBlock.y;
    
    let selectedCellIndex = -1;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        let cellIndex = r * gridCols + c;
        let cellX = gridX + c * (cellSize + gridMargin);
        let cellY = gridY + r * (cellSize + gridMargin);
        fill(colorPadOptions[cellIndex]);
        stroke(0);
        rect(cellX, cellY, cellSize, cellSize);
        
        if (hands.length > 0) {
          let hand = hands[0];
          let indexTip = hand.keypoints[8];
          let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
          if (pointInRect(tipPos, { x: cellX, y: cellY, size: cellSize })) {
            selectedCellIndex = cellIndex;
          }
        }
      }
    }
    
    if (selectedCellIndex != -1) {
      if (colorPadSelectionStart === 0) {
        colorPadSelectionStart = millis();
      }
      let cellProgress = constrain((millis() - colorPadSelectionStart) / 1000, 0, 1);
      
      let r = floor(selectedCellIndex / gridCols);
      let c = selectedCellIndex % gridCols;
      let cellX = gridX + c * (cellSize + gridMargin);
      let cellY = gridY + r * (cellSize + gridMargin);
      
      drawProgressBorder(cellX, cellY, cellSize, cellSize, cellProgress);
      
      if (cellProgress >= 1) {
        penColor = colorPadOptions[selectedCellIndex];
        console.log("색상 확정됨: " + penColor);
        colorPadActive = false;
        colorPadSelectionStart = 0;
      }
    } else {
      colorPadSelectionStart = 0;
    }
  }
  
  // ─ 사이즈 패드 처리 ─
  if (!sizePadActive) {
    if (hands.length > 0) {
      let hand = hands[0];
      let indexTip = hand.keypoints[8];
      let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
      if (pointInRect(tipPos, toolSizeBlock)) {
        if (sizeActivationStart === 0) {
          sizeActivationStart = millis();
        } else if (millis() - sizeActivationStart > 1000) {
          sizePadActive = true;
          console.log("사이즈 패드 활성화");
          sizeActivationStart = 0;
        }
        let progress = constrain((millis() - sizeActivationStart) / 1000, 0, 1);
        drawProgressBorder(toolSizeBlock.x, toolSizeBlock.y, toolSizeBlock.size, toolSizeBlock.size, progress);
      } else {
        sizeActivationStart = 0;
      }
    }
  } else {
    // 사이즈 패드가 활성화된 상태: 2×8 그리드 (총 16셀) (왼쪽으로 열림)
    let gridCols = 8;
    let gridRows = 2;
    let cellWidth = 30;
    let cellHeight = 30;
    let gridMargin = 5;
    let gridX = toolSizeBlock.x - (gridCols * (cellWidth + gridMargin)) - 10;
    let gridY = toolSizeBlock.y;
    
    let selectedSizeCell = -1;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        let cellIndex = r * gridCols + c;
        let cellX = gridX + c * (cellWidth + gridMargin);
        let cellY = gridY + r * (cellHeight + gridMargin);
        fill(220);
        stroke(0);
        rect(cellX, cellY, cellWidth, cellHeight);
        fill(0);
        textAlign(CENTER, CENTER);
        textSize(12);
        text(cellIndex + 1, cellX + cellWidth/2, cellY + cellHeight/2);
        
        if (hands.length > 0) {
          let hand = hands[0];
          let indexTip = hand.keypoints[8];
          let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
          if (pointInRect(tipPos, { x: cellX, y: cellY, size: cellWidth })) {
            selectedSizeCell = cellIndex;
          }
        }
      }
    }
    
    if (selectedSizeCell != -1) {
      if (sizePadSelectionStart === 0) {
        sizePadSelectionStart = millis();
      }
      let cellProgress = constrain((millis() - sizePadSelectionStart) / 1000, 0, 1);
      
      let r = floor(selectedSizeCell / gridCols);
      let c = selectedSizeCell % gridCols;
      let cellX = gridX + c * (cellWidth + gridMargin);
      let cellY = gridY + r * (cellHeight + gridMargin);
      
      drawProgressBorder(cellX, cellY, cellWidth, cellHeight, cellProgress);
      
      if (cellProgress >= 1) {
        toolSize = selectedSizeCell + 1; // 사이즈는 1~16 픽셀
        console.log("사이즈 확정됨: " + toolSize);
        sizePadActive = false;
        sizePadSelectionStart = 0;
      }
    } else {
      sizePadSelectionStart = 0;
    }
  }
  
  // ─ 기존 도구 선택 및 동작 처리 ─
  if (hands.length > 0) {
    let hand = hands[0];
    let thumbTip = hand.keypoints[4];
    let indexTip = hand.keypoints[8];
    let tipPos = { x: flipX(indexTip.x), y: indexTip.y };
    
    if (pointInRect(tipPos, penIcon)) {
      if (toolActivationStart === 0) {
        toolActivationStart = millis();
      } else if (millis() - toolActivationStart > 1000) {
        selectedTool = "pen";
        console.log("펜 모드 활성화");
        toolActivationStart = 0;
      }
      let progress = constrain((millis() - toolActivationStart) / 1000, 0, 1);
      drawProgressBorder(penIcon.x, penIcon.y, penIcon.size, penIcon.size, progress);
    } else if (pointInRect(tipPos, eraserIcon)) {
      if (toolActivationStart === 0) {
        toolActivationStart = millis();
      } else if (millis() - toolActivationStart > 1000) {
        selectedTool = "eraser";
        console.log("지우개 모드 활성화");
        toolActivationStart = 0;
      }
      let progress = constrain((millis() - toolActivationStart) / 1000, 0, 1);
      drawProgressBorder(eraserIcon.x, eraserIcon.y, eraserIcon.size, eraserIcon.size, progress);
    } else {
      toolActivationStart = 0;
      
      const pinchThreshold = 20;
      let pinchDistance = dist(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y);
      let isPinched = pinchDistance < pinchThreshold;
      
      let thumbPos = { x: flipX(thumbTip.x), y: thumbTip.y };
      let indexPos = { x: flipX(indexTip.x), y: indexTip.y };
      push();
      stroke(0, 0, 255, 150);
      strokeWeight(4);
      line(thumbPos.x, thumbPos.y, indexPos.x, indexPos.y);
      pop();
      
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
      
      if (selectedTool === "pen") {
        if (isPinched) {
          push();
          noStroke();
          fill(128, 0, 128, 150);
          ellipse(tipPos.x, tipPos.y, toolSize * 3, toolSize * 3);
          pop();
          drawingLayer.stroke(penColor);
          drawingLayer.strokeWeight(toolSize);
          if (lastTipPos != null) {
            drawingLayer.line(lastTipPos.x, lastTipPos.y, tipPos.x, tipPos.y);
          }
          lastTipPos = tipPos;
        } else {
          lastTipPos = null;
        }
      } else if (selectedTool === "eraser") {
        if (isPinched) {
          push();
          noStroke();
          fill(128, 0, 128, 150);
          ellipse(tipPos.x, tipPos.y, toolSize * 5, toolSize * 5);
          pop();
          lastTipPos = tipPos;
          drawingLayer.erase();
          drawingLayer.noStroke();
          drawingLayer.ellipse(tipPos.x, tipPos.y, toolSize * 5, toolSize * 5);
          drawingLayer.noErase();
        } else {
          lastTipPos = null;
        }
      }
    }
  }
}

function pointInRect(pt, rectObj) {
  return pt.x > rectObj.x && pt.x < rectObj.x + rectObj.size &&
         pt.y > rectObj.y && pt.y < rectObj.y + rectObj.size;
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();
  drawingLayer = createGraphics(640, 480);
  drawingLayer.clear();
  handPose.detectStart(video, gotHands);
}

// ── draw() 함수 내에서 버튼1 효과 업데이트 호출 ──
function draw() {
  image(video, 0, 0, width, height);
  drawHandKeypointsAndSkeleton();
  
  if (hands.length > 0) {
    let detectedGesture = detectGesture(hands[0]);
    if (detectedGesture === lastGesture) {
      gestureTimer += deltaTime;
    } else {
      lastGesture = detectedGesture;
      gestureTimer = 0;
    }
    let avgPos = getAverageKeypointPosition(hands[0]);
    let progress = constrain(gestureTimer / gestureThreshold, 0, 1);
    drawGestureGauge(progress, avgPos);
    
    if (gestureTimer >= gestureThreshold && detectedGesture !== confirmedGesture) {
      confirmedGesture = detectedGesture;
      changeMode(confirmedGesture);
    }
  } else {
    gestureTimer = 0;
    lastGesture = "";
    confirmedGesture = "";
    if (!paletteActive) {
      drawGestureGauge(0, { x: width / 2, y: height - 40 });
    }
  }
  
  if (paletteActive) {
    drawPalette();
  }
  
  // 기본 모드일 때 반응형 버튼 그리기
  if (currentMode === "default") {
    drawReactiveButtons();
  }
  
  image(drawingLayer, 0, 0);
  
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text(gestureMessage, 10, 10);
  
  if (currentMode !== "default") {
    drawOverlay(currentMode);
  }
}

function drawOverlay(mode) {
  push();
  noStroke();
  // 모드별 배경색 지정 (알파값 150)
  if (mode === "emergency") {
    fill(0, 0, 0, 150); // 흑색 배경
  } else if (mode === "thumbsUp") {
    fill(0, 190, 0, 150); // 초록색 배경
  } else if (mode === "thumbsDown") {
    fill(255, 165, 0, 150); // 오렌지색 배경
  } else {
    fill(0, 0, 0, 150); // 기본 검정 배경
  }
  rect(0, 0, width, height);
  textAlign(CENTER, CENTER);
  textSize(48);
  fill(255);
  if (mode === "emergency") {
    text("자리 비움", width / 2, height / 2);
  } else if (mode === "thumbsUp") {
    text("좋은 의견이에요!", width / 2, height / 2);
  } else if (mode === "thumbsDown") {
    text("질문 있어요!", width / 2, height / 2);
  }
  pop();
}


// Reactive Button 관련 코드
// 전역 변수로 reactiveButtons 배열 선언 (캔버스 좌측 중앙에 배치)
let reactiveButtons = [
  { id: 1, label: "btn 1", x: 20, y: 135, width: 50, height: 50, activationStart: 0, active: false, displayStart: 0, triggered: false },
  { id: 2, label: "btn 2", x: 20, y: 195, width: 50, height: 50, activationStart: 0, active: false, displayStart: 0, triggered: false },
  { id: 3, label: "btn 3", x: 20, y: 255, width: 50, height: 50, activationStart: 0, active: false, displayStart: 0, triggered: false },
  { id: 4, label: "btn 4", x: 20, y: 315, width: 50, height: 50, activationStart: 0, active: false, displayStart: 0, triggered: false }
];
// ── 기존 reactiveButtons 수정 (버튼 1에 대한 효과 적용) ──
function drawReactiveButtons() {
  if (currentMode !== "default" || paletteActive) return;
  
  let handActive = (hands.length > 0);
  let indexTip = null;
  if (handActive) {
    let tip = hands[0].keypoints[8];
    indexTip = { x: flipX(tip.x), y: tip.y };
  }
  
  for (let i = 0; i < reactiveButtons.length; i++) {
    let btn = reactiveButtons[i];
    
    // 버튼 배경과 텍스트 그리기
    fill(200);
    stroke(0);
    rect(btn.x, btn.y, btn.width, btn.height);
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(12);
    text(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2);
    
    // 손가락이 버튼 영역 안에 있다면
    if (handActive && indexTip &&
        indexTip.x >= btn.x && indexTip.x <= btn.x + btn.width &&
        indexTip.y >= btn.y && indexTip.y <= btn.y + btn.height) {
      // 아직 트리거되지 않았다면 타이머 시작
      if (!btn.triggered) {
        if (btn.activationStart === 0) {
          btn.activationStart = millis();
        } else {
          let progress = constrain((millis() - btn.activationStart) / 1000, 0, 1);
          drawProgressBorder(btn.x, btn.y, btn.width, btn.height, progress);
          if (progress >= 1) {
            btn.triggered = true;  // 한 번 누르면 트리거됨
            btn.active = true;
            btn.displayStart = millis();
            btn.activationStart = 0;
          }
        }
      }
    } else {
      // 손이 영역을 벗어나면 타이머 및 트리거 리셋
      btn.activationStart = 0;
      btn.triggered = false;
    }
    
    // 효과 활성화된 버튼에 대해 ID에 따라 해당 효과 함수 호출
    if (btn.active) {
      switch (btn.id) {
        case 1:
          handleButton1Effect();
          break;
        case 2:
          handleButton2Effect();
          break;
        case 3:
          handleButton3Effect();
          break;
        case 4:
          handleButton4Effect();
          break;
      }
      // btn.active는 효과 함수 내부에서 종료 시점에 false로 리셋됨
    }
  }
}


//----------------------------------------------------------------------------------//
// 버튼 관련 함수들 
// ── 버튼 1 효과 통합 함수 ──
function handleButton1Effect() {
  // 버튼 1에 대한 반응 추가 예정

}

// ── 빈 함수 (버튼 2, 3, 4) ──
function handleButton2Effect() {
  // 버튼 2에 대한 반응 추가 예정
}

function handleButton3Effect() {
  // 버튼 3에 대한 반응 추가 예정
}

function handleButton4Effect() {
  // 버튼 4에 대한 반응 추가 예정
}
