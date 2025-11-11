// ✅ [추가] 전역 변수
let surveyData = null; // 설문지 템플릿 (Firebase에서 로드)
let currentSurveyTemplateId = null; // 현재 세션의 설문지 ID

let currentUser = null;
let currentSessionId = null;
let currentWeek = 1;
let isAdmin = false;
let adminSessionList = [];

// 화면 전환
function showScreen(screenName) {
    document.querySelectorAll('.participant-dashboard-screen, .survey-screen, .result-screen, .admin-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.querySelector(`.${screenName}`).classList.add('active');
}

// ✅ [추가] 설문지 템플릿 로더
// sensorySurveyData가 로드되었는지 확인하고, 안됐으면 로드하는 함수
async function ensureSurveyDataLoaded() {
    // 1. 이미 로드했다면 즉시 종료
    if (surveyData) return true;

    // 2. 세션 저장소에서 템플릿 ID 가져오기 (로그인 시 저장함)
    currentSurveyTemplateId = sessionStorage.getItem('sensorySurveyTemplateId');
    if (!currentSurveyTemplateId) {
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
        logout(); // (location.hash = '#login'으로 대체)
        return false;
    }

    try {
        // 3. Firebase에서 실제 설문지 데이터 로드
        const surveySnapshot = await database.ref(`surveys/${currentSurveyTemplateId}`).once('value');

        if (!surveySnapshot.exists()) {
            alert('오류: 설문지를 찾을 수 없습니다.');
            logout();
            return false;
        }

        // 4. 전역 변수에 저장
        surveyData = surveySnapshot.val();
        return true;

    } catch (error) {
        console.error('설문지 로드 오류:', error);
        alert('설문지를 불러오는 중 오류가 발생했습니다.');
        logout();
        return false;
    }
}

// 통합 로그인 (쿼리 기반)
// 로그아웃
function logout() {
    currentUser = null;
    currentSessionId = null;
    isAdmin = false;
    adminSessionList = [];

    // ✅ [추가] 설문 데이터 초기화
    surveyData = null;
    currentSurveyTemplateId = null;

    sessionStorage.clear();

    // index.html로 이동
    window.location.href = 'index.html';
}

// 참가자 대시보드 로드
async function loadParticipantDashboard() {
    // ✅ [추가] 설문지 로드 확인
    if (!await ensureSurveyDataLoaded()) return;

    if (!currentUser || !currentSessionId) return;

    try {
        // 회차 정보 가져오기
        const sessionSnapshot = await database.ref(`sessions/${currentSessionId}`).once('value');
        const sessionData = sessionSnapshot.val() || {};

        // 회차 정보 표시
        const sessionInfo = document.getElementById('sessionInfo');
        sessionInfo.innerHTML = `
            <strong>${sessionData.name || currentSessionId}</strong><br>
            ${sessionData.startDate || ''} ${sessionData.endDate ? `~ ${sessionData.endDate}` : ''}
        `;

        // 내 응답 데이터 가져오기
        const responsesSnapshot = await database.ref(`responses/${currentUser}`).once('value');
        const myResponses = responsesSnapshot.val() || {};

        // 진행 현황 표시
        let completedWeeks = 0;
        const targetWeeks = [1, 4]; // 1주차와 4주차만 처리

        for (const week of targetWeeks) {
            const weekData = myResponses[`week${week}`];

            // ✅ [수정] weekData가 존재하고, 그 안에 sensory 키가 존재하는지 확인
            const isSubmitted = weekData && weekData.sensory;

            if (isSubmitted) {
                completedWeeks++;
            }
        }



        const progressDiv = document.getElementById('participantProgress');
        progressDiv.innerHTML = `
            <div style="font-size: 48px; font-weight: bold; color: white;">
                ${completedWeeks}/2
            </div>
            <div style="font-size: 18px; margin-top: 10px;">
                완료
            </div>
            <div class="progress-bar" style="margin-top: 15px; background: rgba(255,255,255,0.3);">
                <div class="progress-fill" style="width: ${(completedWeeks/2)*100}%; background: white;"></div>
            </div>
        `;

        // 주차별 카드
        const weekGrid = document.getElementById('weekGrid');
        weekGrid.innerHTML = '';



        for (const week of targetWeeks) {
            const weekData = myResponses[`week${week}`];
            const weekCard = document.createElement('div');
            weekCard.className = 'week-card-large';

            const isSubmitted = weekData && weekData.sensory;

            if (isSubmitted) {
                weekCard.classList.add('completed');
                const submissionTime = weekData.sensory.timestamp;

                let categoryScores = '';
                surveyData.categories.forEach((category) => {
                    const catData = weekData.sensory[category.id];

                    // ✅ [수정] catData가 있고, questions가 있을 때만 계산
                    if (catData && catData.questions) {
                        // ✅ [수정] 점수를 동적으로 계산
                        const calculatedTotal = catData.questions.reduce((sum, q) => sum + q.value, 0);
                        const sensitivity = calculateSensitivity(calculatedTotal, category.scoreRange);

                        categoryScores += `
                            <div class="score-item">
                                <span>${category.icon} ${category.title}</span>
                                <span>
                                    <strong>${calculatedTotal}점</strong>
                                    <span class="sensitivity ${sensitivity.level}">${sensitivity.text}</span>
                                </span>
                            </div>
                        `;
                    }
                });

                weekCard.innerHTML = `
                    <div class="week-header">
                        <h3>${week}주차 ✓</h3>
                        <div class="week-date">${new Date(submissionTime).toLocaleDateString('ko-KR')}</div>
                    </div>
                    <div class="week-content">
                        ${categoryScores}
                    </div>
                    <button class="btn" onclick="location.hash = '#week${week}'">상세 보기</button>
                `;
            } else {
                weekCard.innerHTML = `
                    <div class="week-header">
                        <h3>${week}주차</h3>
                        <div class="week-status incomplete">미완료</div>
                    </div>
                    <div class="week-content empty">
                        <div style="text-align: center; padding: 40px 0; color: #999;">
                            아직 작성하지 않았습니다
                        </div>
                    </div>
                    <button class="btn" onclick="location.hash = '#survey${week}'">설문 시작</button>
                `;
            }

            weekGrid.appendChild(weekCard);
        }

    } catch (error) {
        console.error('대시보드 로드 오류:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

// 주차 상세 보기
async function viewWeekDetail(week) {
    // ✅ [추가] 설문지 로드 확인
    if (!await ensureSurveyDataLoaded()) return;

    currentWeek = week;

    const snapshot = await database.ref(`responses/${currentUser}/week${week}/sensory`).once('value');
    const weekData = snapshot.val();

    if (!weekData) return;

    showResults(weekData);
}

// 설문 시작
function startWeekSurvey(week) {
    currentWeek = week;
    document.getElementById('surveyTitle').textContent = `${week}주차 설문 작성`;
    loadSurvey();
    showScreen('survey-screen');
}

// 대시보드로 돌아가기
function backToDashboard() {
    loadParticipantDashboard();

    location.hash = '#dashboard';
}

// [새로 추가] 카테고리 헤더 HTML 생성 (재사용)
function buildCategoryHeaderHTML(category) {
    return `
        <div class="category-header">
            <span class="category-icon">${category.icon}</span>
            <div>
                <div class="category-title">${category.title}</div>
                <div class="category-desc">${category.description}</div>
            </div>
        </div>
    `;
}

// [새로 추가] 카테고리 내 질문들 HTML 생성 (재사용)
// isReadOnly: true면 '읽기 전용' 폼 생성
function buildQuestionsHTML(category, catIndex, categoryResponseData, isReadOnly) {
    let questionsHTML = '';
    const disabledAttribute = isReadOnly ? 'disabled' : '';
    const readonlyAttribute = isReadOnly ? 'readonly' : '';

    // placeholder 텍스트도 모드에 따라 변경
    const notePlaceholder = isReadOnly ? '특이사항 없음' : '특이사항 (선택사항)';

    category.questions.forEach((questionText, qIndex) => {
        // name/id가 설문 폼과 결과 폼에서 충돌하지 않게 prefix 추가
        const qId = `${isReadOnly ? 'result_' : ''}${category.id}_${qIndex}`;
        const prevValue = categoryResponseData?.questions?.[qIndex]?.value || 0;
        const prevNote = categoryResponseData?.questions?.[qIndex]?.note || '';

        questionsHTML += `
            <div class="question">
                <div class="question-text">${catIndex + 1}-${qIndex + 1}. ${questionText}</div>
                <div class="radio-group">
                    <div class="radio-option">
                        <input type="radio" id="${qId}_1" name="${qId}" value="1" ${prevValue === 1 ? 'checked' : ''} ${disabledAttribute}>
                        <label for="${qId}_1">전혀 아니다<br>(1점)</label>
                    </div>
                    <div class="radio-option">
                        <input type="radio" id="${qId}_2" name="${qId}" value="2" ${prevValue === 2 ? 'checked' : ''} ${disabledAttribute}>
                        <label for="${qId}_2">가끔 그렇다<br>(2점)</label>
                    </div>
                    <div class="radio-option">
                        <input type="radio" id="${qId}_3" name="${qId}" value="3" ${prevValue === 3 ? 'checked' : ''} ${disabledAttribute}>
                        <label for="${qId}_3">자주 그렇다<br>(3점)</label>
                    </div>
                </div>
                <textarea class="note-input" placeholder="${notePlaceholder}" id="${qId}_note" ${readonlyAttribute}>${prevNote}</textarea>
            </div>
        `;
    });
    return questionsHTML;
}

// 설문 로드
async function loadSurvey() {
    // ✅ [추가] 설문지 로드 확인
    if (!await ensureSurveyDataLoaded()) return;

    const content = document.getElementById('surveyContent');
    content.innerHTML = ''; // 비우기

    if (!database || !currentUser) {
        content.innerHTML = '로그인이 필요합니다.';
        return;
    }

    try {
        // 기존 응답 데이터 가져오기
        const snapshot = await database.ref(`responses/${currentUser}/week${currentWeek}/sensory`).once('value');
        let previousResponses = snapshot.val();

        console.log(snapshot);
        console.log(previousResponses);

        // ✅ [추가] 임시 저장 데이터 로드 및 병합 (Firebase 데이터보다 우선)
        const storageKey = `draft_sensory_week${currentWeek}_${currentUser}`;
        const draftString = localStorage.getItem(storageKey);

        if (draftString) {
            const draftData = JSON.parse(draftString);
            // draftData를 기존 응답으로 사용하여 덮어씁니다.
            previousResponses = draftData;
            console.log(`[임시 저장] ${currentWeek}주차 임시 응답을 불러왔습니다.`);
        }

        surveyData.categories.forEach((category, catIndex) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';

            console.log(snapshot);
            console.log(previousResponses);

            const categoryResponseData = previousResponses?.[category.id];

            // [재사용] 헤더 + 질문 폼 (수정 가능 모드)
            categoryDiv.innerHTML =
                buildCategoryHeaderHTML(category) +
                buildQuestionsHTML(category, catIndex, categoryResponseData, false);

            content.appendChild(categoryDiv);
        });

        updateProgress(); // 진행률 업데이트
    } catch (error) {
        console.error('설문 로드 오류:', error);
        content.innerHTML = '설문 로드 중 오류가 발생했습니다.';
    }
}

// 진행률 업데이트
function updateProgress() {
    const totalQuestions = surveyData.categories.reduce((sum, cat) => sum + cat.questions.length, 0);
    let answered = 0;

    surveyData.categories.forEach(category => {
        category.questions.forEach((_, qIndex) => {
            const qId = `${category.id}_${qIndex}`;
            const selected = document.querySelector(`input[name="${qId}"]:checked`);
            if (selected) answered++;
        });
    });

    const progress = (answered / totalQuestions) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
}

// ✅ [추가] 임시 응답을 Session Storage에 저장
function saveDraftResponse(currentWeek) {
    const tempResponses = collectResponses(false); // allAnswered 체크를 건너뛰기 위해 false 전달

    // 데이터가 유효할 때만 저장 (로그인되지 않은 경우 등 제외)
    if (currentUser && tempResponses.data) {
        const storageKey = `draft_sensory_week${currentWeek}_${currentUser}`;
        localStorage.setItem(storageKey, JSON.stringify(tempResponses.data));
    }
}

// 응답 수집
function collectResponses(isFinalSubmit = true) {
    const data = {
        timestamp: new Date().toISOString()
    };

    let allAnswered = true;

    surveyData.categories.forEach((category, catIndex) => {
        data[category.id] = {
            questions: []
        };

        category.questions.forEach((_, qIndex) => {
            const qId = `${category.id}_${qIndex}`;
            const selected = document.querySelector(`input[name="${qId}"]:checked`);
            const note = document.getElementById(`${qId}_note`).value;

            // ✅ [수정] 최종 제출 시에만 allAnswered 체크
            if (isFinalSubmit && !selected) {
                allAnswered = false;
            }

            const value = selected ? parseInt(selected.value) : 0;
            data[category.id].questions.push({
                value: value,
                note: note
            });
        });
    });

    return { data, allAnswered };
}

// 설문 제출
async function submitSurvey() {
    const { data, allAnswered } = collectResponses(true);

    if (!allAnswered) {
        alert('모든 질문에 답해주세요.');
        return;
    }

    if (!database || !currentUser) {
        alert('로그인이 필요합니다.');
        return;
    }

    try {
        await database.ref(`responses/${currentUser}/week${currentWeek}/sensory`).set(data);

        // 임시 저장 데이터 삭제
        const storageKey = `draft_sensory_week${currentWeek}_${currentUser}`;
        localStorage.removeItem(storageKey);

        alert('제출이 완료되었습니다!');

        location.hash = '#dashboard';
    } catch (error) {
        console.error('제출 오류:', error);
        alert('제출 중 오류가 발생했습니다: ' + error.message);
    }
}

// 결과 표시
function showResults(data) {
    const content = document.getElementById('resultContent');
    content.innerHTML = `<h3 style="margin-bottom: 20px;">${currentWeek}주차 결과</h3>`;

    // surveyData의 카테고리 순서대로 반복
    surveyData.categories.forEach((category, catIndex) => {
        const categoryData = data[category.id];

        if (!categoryData || !categoryData.questions) return;

        // 1. 민감도 및 총점 계산
        const calculatedTotal = categoryData.questions.reduce((sum, q) => sum + q.value, 0);
        const sensitivity = calculateSensitivity(calculatedTotal, category.scoreRange);

        // 2. [재사용] 질문 폼만 생성 (읽기 전용 모드)
        // (카테고리 헤더는 result-header가 대신하므로 여기선 호출 X)
        const questionsHTML = buildQuestionsHTML(category, catIndex, categoryData, true);

        // 3. 최종 결과 카드 생성
        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';
        resultCard.innerHTML = `
            <div class="result-header">
                <div class="result-title">
                    <span>${category.icon}</span>
                    <span>${category.title}</span>
                </div>
                <div class="result-score">${calculatedTotal}점</div>
            </div>
            <div>
                <span class="sensitivity ${sensitivity.level}">민감도: ${sensitivity.text}</span>
            </div>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">

            ${questionsHTML}
        `;
        content.appendChild(resultCard);
    });

    showScreen('result-screen');
}

// 관리자 페이지 로드
async function loadAdminPage() {
    try {
        const sessionsSnapshot = await database.ref('sessions').once('value');
        const sessions = sessionsSnapshot.val() || {};

        const container = document.getElementById('adminContent');
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>👨‍💼 관리자 페이지</h2>
                <button class="btn btn-secondary" onclick="logout()" style="width: auto; padding: 10px 20px;">로그아웃</button>
            </div>
        `;

        if (Object.keys(sessions).length === 0) {
            container.innerHTML += '<div style="text-align: center; color: #999; padding: 40px;">등록된 회차가 없습니다.</div>';
            return;
        }

        // 모든 참가자와 응답 데이터를 각 회차별로 조회
        const responsesSnapshot = await database.ref('responses').once('value');
        const allResponses = responsesSnapshot.val() || {};

        // 회차별 참가자 ID 저장
        adminSessionList = [];

        for (const [sessionId, sessionData] of Object.entries(sessions)) {
            // 해당 회차의 참가자 ID 수집 (쿼리 사용)
            const participantsSnapshot = await database.ref('participants')
                .orderByChild('sessionId')
                .equalTo(sessionId)
                .once('value');

            const sessionParticipants = participantsSnapshot.val() || {};
            const participantIds = Object.keys(sessionParticipants);

            adminSessionList.push({
                sessionId: sessionId,
                participantIds: participantIds
            });

            const participantCount = participantIds.length;

            // 완료율 계산
            let totalWeeks = participantCount * 2;
            let completedWeeks = 0;

            participantIds.forEach(userId => {
                const userResponses = allResponses[userId] || {};
                if (userResponses['week1']) completedWeeks++;
                if (userResponses['week4']) completedWeeks++;
            });

            const completionRate = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;

            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'session-card';
            sessionDiv.innerHTML = `
                <h3>📅 ${sessionData.name || sessionId}</h3>
                <div style="font-size: 14px; color: #666; margin: 5px 0;">
                    ${sessionData.startDate || ''} ${sessionData.endDate ? `~ ${sessionData.endDate}` : ''}
                </div>
                <div class="session-stats">
                    <div>참가자: ${participantCount}명</div>
                    <div>완료율: ${completionRate}% (${completedWeeks}/${totalWeeks})</div>
                </div>
                <button class="btn" onclick="viewSessionDetail('${sessionId}')">상세 보기</button>
            `;

            container.appendChild(sessionDiv);
        }
    } catch (error) {
        console.error('관리자 페이지 로드 오류:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

// 회차 상세 보기
async function viewSessionDetail(sessionId) {
    try {
        const sessionSnapshot = await database.ref(`sessions/${sessionId}`).once('value');
        const sessionData = sessionSnapshot.val();

        // 해당 회차의 참가자만 쿼리
        const participantsSnapshot = await database.ref('participants')
            .orderByChild('sessionId')
            .equalTo(sessionId)
            .once('value');

        const sessionParticipants = participantsSnapshot.val() || {};

        const responsesSnapshot = await database.ref('responses').once('value');
        const allResponses = responsesSnapshot.val() || {};

        const container = document.getElementById('adminContent');
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h2>📅 ${sessionData.name || sessionId}</h2>
                    <div style="font-size: 14px; color: #666;">
                        ${sessionData.startDate || ''} ${sessionData.endDate ? `~ ${sessionData.endDate}` : ''}
                    </div>
                </div>
                <button class="btn btn-secondary" onclick="loadAdminPage()" style="width: auto; padding: 10px 20px;">← 돌아가기</button>
            </div>
        `;

        // 참가자별 진행 상황
        for (const [userId, userData] of Object.entries(sessionParticipants)) {
            const userResponses = allResponses[userId] || {};
            const completedWeeks = Object.keys(userResponses).length;

            const userDiv = document.createElement('div');
            userDiv.className = 'participant-item';
            userDiv.innerHTML = `
                <div>
                    <strong>${userId}</strong> (코드: ${userData.accessCode})
                    <div style="font-size: 12px; color: #666;">
                        진행: ${completedWeeks}/4주 완료
                        ${userData.lastAccess ? `| 마지막 접속: ${new Date(userData.lastAccess).toLocaleString('ko-KR')}` : ''}
                    </div>
                </div>
                <button class="btn" onclick="viewUserResponses('${userId}')" style="width: auto; padding: 10px 20px;">응답 보기</button>
            `;

            container.appendChild(userDiv);
        }
    } catch (error) {
        console.error('회차 상세 로드 오류:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

// 사용자 응답 보기
async function viewUserResponses(userId) {
    try {
        // 1. 참가자 정보 -> 세션 ID -> 템플릿 ID
        const participantSnapshot = await database.ref(`participants/${userId}`).once('value');
        const participantData = participantSnapshot.val();
        if (!participantData) {
            alert('참가자 정보를 찾을 수 없습니다.');
            return;
        }

        const sessionSnapshot = await database.ref(`sessions/${participantData.sessionId}`).once('value');
        const sessionData = sessionSnapshot.val();
        if (!sessionData) {
            alert('세션 정보를 찾을 수 없습니다.');
            return;
        }

        // 2. 해당 템플릿 ID로 설문지 로드 (변수 이름 변경)
        const templateSnapshot = await database.ref(`surveys/${sessionData.sensorySurveyTemplateId}`).once('value');
        if (!templateSnapshot.exists()) {
            alert('해당 세션의 설문지를 찾을 수 없습니다.');
            return;
        }
        const userSurveyTemplate = templateSnapshot.val(); // ✅ [변경] 중립적인 이름 사용

        // 3. 사용자 응답 로드
        const responsesSnapshot = await database.ref(`responses/${userId}`).once('value');
        const userResponses = responsesSnapshot.val() || {};

        const container = document.getElementById('adminContent');
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h2>📊 ${userId} 응답 결과</h2>
                    <div style="font-size: 14px; color: #666;">
                        ${sessionData.name || participantData.sessionId} | 코드: ${participantData.accessCode}
                    </div>
                </div>
                <button class="btn btn-secondary" onclick="viewSessionDetail('${participantData.sessionId}')" style="width: auto; padding: 10px 20px;">← 돌아가기</button>
            </div>
        `;

        const targetWeeks = [1, 4];
        for (const week of targetWeeks) {
            const weekData = userResponses[`week${week}/sensory`];

            if (!weekData) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'result-card';
                emptyDiv.innerHTML = `<h3>${week}주차</h3><div style="color: #999;">미완료</div>`;
                container.appendChild(emptyDiv);
                continue;
            }

            const weekDiv = document.createElement('div');
            weekDiv.className = 'result-card';
            weekDiv.innerHTML = `<h3>${week}주차 (${new Date(weekData.timestamp).toLocaleDateString('ko-KR')})</h3>`;

            userSurveyTemplate.categories.forEach((category) => {
                const categoryData = weekData[category.id];
                if (!categoryData) return;

                const calculatedTotal = categoryData.questions.reduce((sum, q) => sum + q.value, 0);
                const sensitivity = calculateSensitivity(calculatedTotal, category.scoreRange);

                const catDiv = document.createElement('div');
                catDiv.style.marginTop = '10px';
                catDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>${category.icon} ${category.title}</div>
                        <div>
                            <strong>${calculatedTotal}점</strong>
                            <span class="sensitivity ${sensitivity.level}">${sensitivity.text}</span>
                        </div>
                    </div>
                `;

                weekDiv.appendChild(catDiv);
            });

            container.appendChild(weekDiv);
        }
    } catch (error) {
        console.error('사용자 응답 로드 오류:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

async function handleRouteChange() {
    // 현재 해시값 (예: #week1, #dashboard)
    const hash = window.location.hash || '#dashboard';

    // 로그인 체크 - 로그인 안 되어 있으면 index.html로 리다이렉트
    const savedUser = sessionStorage.getItem('currentUser');
    const savedIsAdmin = sessionStorage.getItem('isAdmin');
    
    if (!savedUser && !savedIsAdmin) {
        // 로그인 안 됨 - 현재 페이지를 returnUrl로 저장하고 index.html로 이동
        sessionStorage.setItem('returnUrl', window.location.href);
        window.location.href = 'index.html';
        return;
    }

    // 모든 화면 숨기기
    document.querySelectorAll('.participant-dashboard-screen, .survey-screen, .result-screen, .admin-screen').forEach(screen => {
        screen.classList.remove('active');
    });

    // 해시 값에 따라 적절한 함수 호출

    if (hash === '#dashboard') {
        currentUser = savedUser;
        currentSessionId = sessionStorage.getItem('currentSessionId');
        await loadParticipantDashboard();
        showScreen('participant-dashboard-screen');

    } else if (hash === '#admin') {
        if (!savedIsAdmin) {
            window.location.href = 'index.html';
            return;
        }
        isAdmin = true;
        await loadAdminPage();
        showScreen('admin-screen');

    } else if (hash.startsWith('#week')) {
        const week = parseInt(hash.replace('#week', ''));
        currentUser = savedUser;
        await viewWeekDetail(week);

    } else if (hash.startsWith('#survey')) {
        const week = parseInt(hash.replace('#survey', ''));
        currentUser = savedUser;
        startWeekSurvey(week);

    } else {
        // 기본값: 대시보드로
        location.hash = '#dashboard';
    }
}

// 2. 페이지 로드 시 및 해시 변경 시 라우터 실행
window.addEventListener('load', () => {
    // 라우터 실행
    handleRouteChange();

    // 설문 변경 감지하여 임시 저장
    document.addEventListener('change', function(e) {
        if (e.target.type === 'radio' || e.target.tagName === 'TEXTAREA') {
            updateProgress();
            if (currentWeek && currentUser) {
                saveDraftResponse(currentWeek);
            }
        }
    });
});

window.addEventListener('hashchange', handleRouteChange);

