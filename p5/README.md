# 가상 제스처 보드 - 기능 및 로직 설명

이 문서는 `ml5.js` HandPose 모델과 `p5.js`를 사용하여 구현된 가상 제스처 보드의 **주요 함수**와 **로직 흐름**을 정리한 것입니다.  
프로젝트 목적은 웹캠으로 인식된 손동작(제스처)을 바탕으로, 반응형 버튼을 활성화하거나 팔레트 UI를 통해 그림을 그리는 등 다양한 인터랙션을 제공하는 것입니다.

---

## 목차
1. [전역 변수 정의](#전역-변수-정의)  
2. [HandPose 초기화](#handpose-초기화)  
3. [스켈레톤 및 제스처 인식](#스켈레톤-및-제스처-인식)  
4. [모드 전환 및 오버레이](#모드-전환-및-오버레이)  
5. [팔레트 모드 UI](#팔레트-모드-ui)  
6. [Reactive Button (반응형 버튼)](#reactive-button-반응형-버튼)  
7. [p5.js setup(), draw()](#p5js-setup-draw)

---

## 전역 변수 정의

- **웹캠 캡처 관련**  
  - `video`: p5.js에서 `createCapture()`로 얻은 웹캠 영상 객체  
  - `hands`: HandPose 모델이 감지한 손 정보(배열)

- **제스처 판별 관련**  
  - `gestureTimer`: 특정 제스처가 연속 유지된 시간(ms)  
  - `gestureThreshold`: 제스처를 확정하기까지 필요한 시간(1초)  
  - `lastGesture`: 직전 프레임에서 감지된 제스처  
  - `confirmedGesture`: 1초 이상 유지되어 확정된 제스처 이름  

- **팔레트 모드 및 드로잉 관련**  
  - `paletteActive`: 팔레트 모드 활성화 여부(`true`면 `drawPalette()` 호출)  
  - `selectedTool`: `"pen"` 또는 `"eraser"` (팔레트 모드에서 선택된 도구)  
  - `drawingLayer`: 펜으로 그린 픽셀을 기록할 `p5.Graphics` 레이어  
  - `penColor`, `toolSize`: 현재 펜 색상 및 두께  

- **반응형 버튼 관련**  
  - `reactiveButtons`: 캔버스 좌측에 표시될 버튼들의 속성 배열  
  - 각 버튼은 `id`, `label`, `x`, `y`, `width`, `height` 및 활성화/해제 관련 변수를 지님  

---

## HandPose 초기화

1. **`preload()`**  
   - `handPose = ml5.handPose();`  
   - ml5.js의 HandPose 모델을 미리 로드(준비)하는 함수. p5.js의 `preload()` 시점에 호출.

2. **`gotHands(results)`**  
   - HandPose 모델이 매 프레임마다 감지한 결과(`results`)를 받아 `hands` 배열에 저장.  
   - `hands`에는 여러 손이 있을 수 있으며, 각 손에 `keypoints[]` 정보가 포함.

---

## 스켈레톤 및 제스처 인식

1. **`drawHandKeypointsAndSkeleton()`**  
   - `hands` 배열을 순회하면서, 각 손에 대해 21개 키포인트를 빨간 원으로 표시하고,  
   - `fingerConnections` 배열에 정의된 인덱스 쌍을 따라 초록색 스켈레톤 선을 그린다.  
   - 좌우 반전을 위해 `flipX(x) = 640 - x` 함수를 사용.

2. **`detectGesture(hand)`**  
   - 한 손(`hand`)을 입력받아, 특정 조건(엄지·검지·중지 등 펼침 여부)에 따라  
     `"Default"`, `"Palette"`, `"Emergency"`, `"ThumbsUp"`, `"ThumbsDown"`, `"Unknown"` 중 하나를 판별.  
   - 판별 로직:  
     - **모두 손가락 끝이 가까이** 모여 있으면 `"Default"`  
     - **모든 손가락이 펼침** → `"Palette"`  
     - **엄지·검지·중지**만 펼침 → `"Emergency"`  
     - **엄지 하나**만 펼침 → `ThumbsUp` 또는 `ThumbsDown` (엄지 위치로 위/아래 판단)  
   - 판별 결과를 `gestureMessage`에 저장하고, 문자열을 반환.

3. **`getAverageKeypointPosition(hand)`**  
   - 한 손의 모든 `keypoints` 평균 좌표를 계산해 `{x, y}` 형태로 반환.  
   - UI 표시(게이지 위치 등)에 활용.

4. **`drawGestureGauge(percentage, avgPos)`**  
   - 제스처가 유지된 정도(`percentage`)를 게이지 형태로 그린다.  
   - 보통 `gestureTimer / gestureThreshold`를 0~1로 매핑하여 사용.

5. **`drawProgressBorder(x, y, w, h, percentage)`**  
   - 1초(등) 진행 상황을 보라색 테두리로 시각화.  
   - 예: 버튼 위에 1초 머무르는 동안 테두리가 점차 오렌지색으로 채워짐.

---

## 모드 전환 및 오버레이

1. **`changeMode(gesture)`**  
   - `detectGesture()`로 판별된 제스처 문자열을 입력받아, `currentMode` 또는 `paletteActive`를 업데이트.  
   - `"Palette"`가 감지되면 `paletteActive`를 토글하고, `currentMode`는 `"default"`로 설정.  
   - 이미 `paletteActive`가 `true`인 상태에서는 다른 제스처를 무시.  
   - `"Default"` → `currentMode = "default"`  
   - `"Emergency"` → `currentMode = "emergency"`  
   - `"ThumbsUp"` → `currentMode = "thumbsUp"`  
   - `"ThumbsDown"` → `currentMode = "thumbsDown"`  

2. **`drawOverlay(mode)`**  
   - `currentMode`가 `"default"`가 아닐 때, 화면 전체를 반투명 배경으로 덮고, 모드별 텍스트를 중앙에 표시.  
   - `"emergency"` → 검정 배경 + "자리 비움"  
   - `"thumbsUp"` → 초록 배경 + "좋은 의견이에요!"  
   - `"thumbsDown"` → 오렌지 배경 + "질문 있어요!"  
   - 그 외에는 기본 검정 배경 처리.

---

## 팔레트 모드 UI

1. **`drawPalette()`**  
   - `paletteActive == true`일 때 호출되며, 팔레트 관련 UI를 그린다.  
   - **Clear All** 버튼(좌측 상단), 펜/지우개 아이콘, 색상/크기 설정 블록 등을 표시.  
   - Clear All 버튼 위에 1초간 손가락이 머무르면 `drawingLayer.clear()`로 전체 지움.

2. **`drawToolIcons(penIcon, eraserIcon, penColorBlock, toolSizeBlock)`**  
   - 펜/지우개 아이콘, 펜 색상 블록, 사이즈 블록을 그려주는 함수.  
   - 선택된 도구(`selectedTool`)가 `"pen"`이면 해당 아이콘을 청록색, 아니면 흰색으로 표시.

3. **`handleColorPad(penColorBlock)`**  
   - 색상 패드 활성화 및 색 선택 로직.  
   - 색상 패드 비활성 상태에서, `penColorBlock`에 1초 머무르면 4×4 그리드가 열림.  
   - 그리드 셀(16가지 색상) 중 하나에 1초 머무르면 `penColor`가 해당 색상으로 확정.

4. **`handleSizePad(toolSizeBlock)`**  
   - 펜/지우개 크기 설정 로직.  
   - 2×8(16칸) 그리드로 사이즈 1~16을 표시.  
   - 셀 위에 1초 머무르면 `toolSize` 확정.

5. **`handleToolSelection(penIcon, eraserIcon)`**  
   - 펜/지우개 아이콘을 선택하거나, 엄지-검지 핀치 동작으로 실제 드로잉/지우개를 수행.  
   - 아이콘에 1초 머무르면 `selectedTool`이 `"pen"`/`"eraser"`로 변경.  
   - 핀치가 감지되면(`thumbTip`~`indexTip` 거리 < `pinchThreshold`),  
     - `selectedTool === "pen"` → 보라색 원 표시 + `drawingLayer`에 선을 그림  
     - `selectedTool === "eraser"` → 보라색 원 표시 + `drawingLayer.erase()`로 지우개 처리

---

## Reactive Button (반응형 버튼)

1. **`reactiveButtons`**  
   - 4개의 버튼 정보 배열. 각 버튼은 `id`, `label(이모지)`, `x,y,width,height`, `activationStart`, `active` 등 속성을 가짐.

2. **`drawReactiveButtons()`**  
   - `currentMode === "default"`일 때만 표시.  
   - 각 버튼을 연녹색/연분홍색 배경으로 그리며, 손가락이 1초 머무르면 `active=true`.  
   - `active=true`가 된 버튼은 3초간 특정 효과를 실행하고, 그동안 다른 버튼은 선택 불가.  
   - 3초 후 해제 로직은 각 효과 함수 내부에서 처리.

3. **버튼 효과 함수들** (`handleButton1Effect`, `handleButton2Effect`, `handleButton3Effect`, `handleButton4Effect`)  
   - **공통 로직**:  
     - 버튼이 활성화된 시점(`btn.displayStart`)부터 3초간 효과 실행  
     - 3초가 지나면 `btn.active = false`로 해제  
   - **버튼 1**: "안녕하세요! 반가워요."  
     - 화면 좌우에 🖐️ 이모지를 배치, `sin()`으로 살짝 흔드는 애니메이션  
   - **버튼 2**: "감동 받았어요!"  
     - 😍 이모지를 여러 개 생성, 미세하게 흔들리는 효과  
   - **버튼 3**: "웃음이 터져요!"  
     - 🤣 이모지를 화면 하단에서 위로 떠오르게 함  
   - **버튼 4**: "놀라워요!"  
     - 😮 파티클(이모지)을 중앙에서 사방으로 튀어 나가게 표시

---

## p5.js setup(), draw()

1. **`setup()`**  
   - `createCanvas(640, 480)`: 640×480 캔버스  
   - `video = createCapture(VIDEO, { flipped: true })`: 웹캠을 좌우 반전 모드로 캡처  
   - `video.size(640, 480)`, `video.hide()`  
   - `drawingLayer = createGraphics(640, 480)`: 드로잉 전용 레이어  
   - `handPose.detectStart(video, gotHands)`: HandPose 모델에 영상과 콜백 설정

2. **`draw()`**  
   - `image(video, 0, 0, width, height)`: 웹캠 영상을 배경에 표시  
   - `drawHandKeypointsAndSkeleton()`: 스켈레톤 표시  
   - 손이 있으면 `detectGesture()`로 제스처 판별 → 1초 유지 시 `changeMode()`로 모드 전환  
   - `paletteActive == true` → `drawPalette()`  
   - `currentMode == "default"` → `drawReactiveButtons()`  
   - `image(drawingLayer, 0, 0)`: 드로잉 레이어 합성  
   - `text(gestureMessage, 10, 10)`: 좌상단에 제스처 메시지 표시  
   - `currentMode != "default"` → `drawOverlay(currentMode)`로 오버레이

---

## 요약

- **핵심 흐름**  
  1) 웹캠에서 손 인식(HandPose)  
  2) 제스처 판별(`detectGesture`) 및 유지 시간 체크  
  3) 모드 전환(`changeMode`): `default`, `emergency`, `thumbsUp`, `thumbsDown`, `paletteActive`  
  4) `paletteActive` → 팔레트 UI(`drawPalette`)에서 펜·지우개·색상·크기 조절  
  5) `default` → 반응형 버튼(`drawReactiveButtons`)로 다양한 이모지 효과  
  6) 모든 펜 드로잉은 `drawingLayer`에 기록되어, 모드 전환과 무관하게 유지  

- **사용자 인터랙션**  
  - **1초간 유지**(게이지 or 테두리 진행)라는 동일 규칙  
  - 제스처 유지 1초 → 모드 전환  
  - 버튼 영역 1초 → 버튼 활성화(3초 동안 효과)  
  - 팔레트 아이콘 1초 → 색상·크기 패드 열림 → 패드 셀 위 1초 → 설정 확정  

이상으로 각 함수와 전반적인 로직을 요약했습니다. 보다 자세한 내용은 코드 주석을 참고하시기 바랍니다.
