// [수정] 공통 모듈에서 db 임포트
import { db } from './firebase-init.js';
// [수정] v10(v9 모듈식) SDK 함수 임포트
import { ref, get, set, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
// [수정] 공통 유틸리티에서 함수 임포트
import { calculateSensitivity } from './utils.js';

// --- 전역 변수 선언 ---
let surveyData = null; // 설문지 템플릿 (Firebase에서 로드)
let currentSurveyTemplateId = null; // 현재 세션의 설문지 ID

let currentUser = null;
let currentSessionId = null;
let currentWeek = 1;
let isAdmin = false;
let adminSessionList = [];

// --- 1. 화면 전환 ---
function showScreen(screenName) {
    document.querySelectorAll('.login-screen, .participant-dashboard-screen, .survey-screen, .result-screen, .admin-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.querySelector(`.${screenName}`).classList.add('active');
}

// --- 2. 핵심 로더: 설문지 템플릿 로드 ---
async function ensureSurveyDataLoaded() {
    // 1. 이미 로드했다면 즉시 종료
    if (surveyData) return true; 

    // 2. 세션 저장소에서 템플릿 ID 가져오기
    currentSurveyTemplateId = sessionStorage.getItem('sensorySurveyTemplateId');
    if (!currentSurveyTemplateId) {
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
        logout(); 
        return false;
    }

    try {
        // 3. Firebase에서 실제 설문지 데이터 로드 (v10 구문)
        const surveySnapshot = await get(ref(db, `surveys/${currentSurveyTemplateId}`));
        
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

// --- 3. 인증 ---
// 통합 로그인 (쿼리 기반)
async function login() {
    const input = document.getElementById('loginInput').value.trim();
    if (!input) {
        alert('코드 또는 비밀번호를 입력해주세요.');
        return;
    }
    
    try {
        // 1. 관리자 확인 (v10 구문)
        const adminSnapshot = await get(ref(db, `admin/${input}`));
        if (adminSnapshot.exists()) {
            isAdmin = true;
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('adminPassword', input);
            location.hash = '#admin';
            return;
        }
        
        // 2. 참가자 코드 확인 (v10 쿼리)
        const participantsQuery = query(
            ref(db, 'participants'),
            orderByChild('accessCode'),
            equalTo(input.toUpperCase())
        );
        const participantsSnapshot = await get(participantsQuery);
        const participants = participantsSnapshot.val();
        
        if (participants && Object.keys(participants).length > 0) {
            const userId = Object.keys(participants)[0];
            const userData = participants[userId];

            // 3. 세션 정보 로드 (v10 구문)
            const sessionSnapshot = await get(ref(db, `sessions/${userData.sessionId}`));
            const sessionData = sessionSnapshot.val();
            
            if (!sessionData || !sessionData.sensorySurveyTemplateId) {
                alert('오류: 이 세션에 할당된 설문지가 없습니다.');
                return;
            }
            
            currentUser = userId;
            currentSessionId = userData.sessionId;
            sessionStorage.setItem('currentUser', userId);
            sessionStorage.setItem('currentSessionId', userData.sessionId);
            sessionStorage.setItem('accessCode', input.toUpperCase());
            sessionStorage.setItem('sensorySurveyTemplateId', sessionData.sensorySurveyTemplateId);
            
            // 4. 마지막 접속 시간 업데이트 (v10 구문)
            await set(ref(db, `participants/${userId}/lastAccess`), new Date().toISOString());
            
            location.hash = '#dashboard';
        } else {
            alert('유효하지 않은 코드 또는 비밀번호입니다.');
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        alert('로그인 중 오류: ' + error.message);
    }
}

// 로그아웃
function logout() {
    currentUser = null;
    currentSessionId = null;
    isAdmin = false;
    adminSessionList = [];
    surveyData = null;
    currentSurveyTemplateId = null;
    
    sessionStorage.clear();
    const loginInput = document.getElementById('loginInput');
    if(loginInput) loginInput.value = '';
    
    location.hash = '#login';
}

// --- 4. 참가자 대시보드 ---
async function loadParticipantDashboard() {
    if (!await ensureSurveyDataLoaded()) return;
    if (!currentUser || !currentSessionId) return;
    
    try {
        // 회차 정보 (v10)
        const sessionSnapshot = await get(ref(db, `sessions/${currentSessionId}`));
        const sessionData = sessionSnapshot.val() || {};
        
        const sessionInfo = document.getElementById('sessionInfo');
        sessionInfo.innerHTML = `
            <strong>${sessionData.name || currentSessionId}</strong><br>
            ${sessionData.startDate || ''} ${sessionData.endDate ? `~ ${sessionData.endDate}` : ''}
        `;
        
        // 내 응답 데이터 (v10)
        const responsesSnapshot = await get(ref(db, `responses/${currentUser}`));
        const myResponses = responsesSnapshot.val() || {};
        
        // 진행 현황
        let completedWeeks = 0; 
        const targetWeeks = [1, 4]; // 1주차와 4주차만 처리
        for (const week of targetWeeks) {
            const weekData = myResponses[`week${week}`];
            const isSubmitted = weekData && weekData.sensory; 
            if (isSubmitted) completedWeeks++;
        }

        const progressDiv = document.getElementById('participantProgress');
        progressDiv.innerHTML = `
            <div style="font-size: 48px; font-weight: bold; color: white;">${completedWeeks}/2</div>
            <div style="font-size: 18px; margin-top: 10px;">완료</div>
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
                    if (catData && catData.questions) {
                        const calculatedTotal = catData.questions.reduce((sum, q) => sum + q.value, 0);
                        // [공통 함수 사용]
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
                    <div class="week-content">${categoryScores}</div>
                    <button class="btn" onclick="location.hash = '#week${week}'">상세 보기</button>
                `;
            } else {
                weekCard.innerHTML = `
                    <div class="week-header">
                        <h3>${week}주차</h3>
                        <div class="week-status incomplete">미완료</div>
                    </div>
                    <div class="week-content empty">
                        <div style="text-align: center; padding: 40px 0; color: #999;">아직 작성하지 않았습니다</div>
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
    if (!await ensureSurveyDataLoaded()) return;
    currentWeek = week;
    
    // (v10 구문)
    const snapshot = await get(ref(db, `responses/${currentUser}/week${week}/sensory`));
    const weekData = snapshot.val();
    
    if (!weekData) {
        alert('데이터가 없습니다. 대시보드로 돌아갑니다.');
        location.hash = '#dashboard';
        return;
    }
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
    // loadParticipantDashboard()는 라우터가 '#dashboard'로 변경되면 자동으로 호출
    location.hash = '#dashboard';
}

// --- 5. 설문지/결과지 HTML 생성 (재사용 함수) ---
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

function buildQuestionsHTML(category, catIndex, categoryResponseData, isReadOnly) {
    let questionsHTML = '';
    const disabledAttribute = isReadOnly ? 'disabled' : '';
    const readonlyAttribute = isReadOnly ? 'readonly' : '';
    const notePlaceholder = isReadOnly ? '특이사항 없음' : '특이사항 (선택사항)';
    
    category.questions.forEach((questionText, qIndex) => {
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

// --- 6. 설문 진행 ---
// 설문 로드
async function loadSurvey() {
    if (!await ensureSurveyDataLoaded()) return;
    const content = document.getElementById('surveyContent');
    content.innerHTML = ''; 

    if (!currentUser) {
        content.innerHTML = '로그인이 필요합니다.';
        return;
    }

    try {
        // 기존 응답 데이터 (v10)
        const snapshot = await get(ref(db, `responses/${currentUser}/week${currentWeek}/sensory`));
        let previousResponses = snapshot.val();

        // 임시 저장 데이터 로드 및 병합
        const storageKey = `draft_sensory_week${currentWeek}_${currentUser}`;
        const draftString = localStorage.getItem(storageKey);
        
        if (draftString) {
            previousResponses = JSON.parse(draftString); 
            console.log(`[임시 저장] ${currentWeek}주차 임시 응답을 불러왔습니다.`);
        }
        
        surveyData.categories.forEach((category, catIndex) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            const categoryResponseData = previousResponses?.[category.id];
            
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
    if (!surveyData) return; // 설문지 로드 전엔 실행 방지
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

// 임시 응답 저장
function saveDraftResponse(currentWeek) {
    const tempResponses = collectResponses(false); // allAnswered 체크 X
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
        data[category.id] = { questions: [] };
        
        category.questions.forEach((_, qIndex) => {
            const qId = `${category.id}_${qIndex}`;
            const selected = document.querySelector(`input[name="${qId}"]:checked`);
            const note = document.getElementById(`${qId}_note`).value;

            if (isFinalSubmit && !selected) {
                allAnswered = false;
            }
            
            const value = selected ? parseInt(selected.value) : 0;
            data[category.id].questions.push({ value, note });
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
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
    }
    
    try {
        // (v10 구문)
        await set(ref(db, `responses/${currentUser}/week${currentWeek}/sensory`), data);

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
    
    surveyData.categories.forEach((category, catIndex) => {
        const categoryData = data[category.id];
        if (!categoryData || !categoryData.questions) return;

        // 1. 민감도 및 총점 계산
        const calculatedTotal = categoryData.questions.reduce((sum, q) => sum + q.value, 0);
        // [공통 함수 사용]
        const sensitivity = calculateSensitivity(calculatedTotal, category.scoreRange);
        
        // 2. 질문 폼 생성 (읽기 전용)
        const questionsHTML = buildQuestionsHTML(category, catIndex, categoryData, true);
        
        // 3. 최종 결과 카드
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

// --- 7. 관리자 페이지 (sensory.html 내장) ---
// 관리자 페이지 로드
async function loadAdminPage() {
    try {
        // (v10 구문)
        const sessionsSnapshot = await get(ref(db, 'sessions'));
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
        
        // (v10 구문)
        const responsesSnapshot = await get(ref(db, 'responses'));
        const allResponses = responsesSnapshot.val() || {};
        
        adminSessionList = [];
        
        for (const [sessionId, sessionData] of Object.entries(sessions)) {
            // (v10 쿼리)
            const participantsQuery = query(
                ref(db, 'participants'),
                orderByChild('sessionId'),
                equalTo(sessionId)
            );
            const participantsSnapshot = await get(participantsQuery);
            const sessionParticipants = participantsSnapshot.val() || {};
            const participantIds = Object.keys(sessionParticipants);
            
            adminSessionList.push({ sessionId, participantIds });
            
            const participantCount = participantIds.length;
            
            // 완료율 계산
            let totalWeeks = participantCount * 2; // (1주, 4주)
            let completedWeeks = 0;
            participantIds.forEach(userId => {
                const userResponses = allResponses[userId] || {};
                if (userResponses['week1']?.sensory) completedWeeks++;
                if (userResponses['week4']?.sensory) completedWeeks++;
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
        // (v10 구문)
        const sessionSnapshot = await get(ref(db, `sessions/${sessionId}`));
        const sessionData = sessionSnapshot.val();
        
        // (v10 쿼리)
        const participantsQuery = query(
            ref(db, 'participants'),
            orderByChild('sessionId'),
            equalTo(sessionId)
        );
        const participantsSnapshot = await get(participantsQuery);
        const sessionParticipants = participantsSnapshot.val() || {};
        
        // (v10 구문)
        const responsesSnapshot = await get(ref(db, 'responses'));
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
        
        for (const [userId, userData] of Object.entries(sessionParticipants)) {
            const userResponses = allResponses[userId] || {};
            const completedWeeks = (userResponses['week1']?.sensory ? 1 : 0) + (userResponses['week4']?.sensory ? 1 : 0);
            
            const userDiv = document.createElement('div');
            userDiv.className = 'participant-item';
            userDiv.innerHTML = `
                <div>
                    <strong>${userId}</strong> (코드: ${userData.accessCode})
                    <div style="font-size: 12px; color: #666;">
                        진행: ${completedWeeks}/2주 완료
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
        // 1. 참가자 정보 (v10)
        const participantSnapshot = await get(ref(db, `participants/${userId}`));
        const participantData = participantSnapshot.val();
        if (!participantData) { alert('참가자 정보를 찾을 수 없습니다.'); return; }

        // 2. 세션 정보 (v10)
        const sessionSnapshot = await get(ref(db, `sessions/${participantData.sessionId}`));
        const sessionData = sessionSnapshot.val();
        if (!sessionData) { alert('세션 정보를 찾을 수 없습니다.'); return; }

        // 3. 템플릿 로드 (v10)
        const templateSnapshot = await get(ref(db, `surveys/${sessionData.sensorySurveyTemplateId}`));
        if (!templateSnapshot.exists()) { alert('해당 세션의 설문지를 찾을 수 없습니다.'); return; }
        const userSurveyTemplate = templateSnapshot.val(); 

        // 4. 사용자 응답 로드 (v10)
        const responsesSnapshot = await get(ref(db, `responses/${userId}`));
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
            // week1.sensory 경로로 수정
            const weekData = userResponses[`week${week}`]?.sensory; 
            
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
                // [공통 함수 사용]
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


// --- 8. 라우터 및 이벤트 리스너 ---
async function handleRouteChange() {
    const hash = window.location.hash || '#login';
    
    document.querySelectorAll('.login-screen, .participant-dashboard-screen, .survey-screen, .result-screen, .admin-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const savedUser = sessionStorage.getItem('currentUser');
    const savedIsAdmin = sessionStorage.getItem('isAdmin');
    
    if (hash === '#dashboard') {
        if (!savedUser) { location.hash = '#login'; return; }
        currentUser = savedUser;
        currentSessionId = sessionStorage.getItem('currentSessionId');
        await loadParticipantDashboard(); 
        showScreen('participant-dashboard-screen'); 
        
    } else if (hash === '#admin') {
        if (!savedIsAdmin) { location.hash = '#login'; return; }
        isAdmin = true;
        await loadAdminPage(); 
        showScreen('admin-screen'); 

    } else if (hash.startsWith('#week')) {
        if (!savedUser) { location.hash = '#login'; return; }
        const week = parseInt(hash.replace('#week', ''));
        currentUser = savedUser;
        await viewWeekDetail(week); 
        
    } else if (hash.startsWith('#survey')) {
        if (!savedUser) { location.hash = '#login'; return; }
        const week = parseInt(hash.replace('#survey', ''));
        currentUser = savedUser;
        currentSessionId = sessionStorage.getItem('currentSessionId'); // ensureSurveyDataLoaded를 위해 필요
        startWeekSurvey(week); 

    } else { // '#login' 또는 알 수 없는 해시
        if (savedIsAdmin) {
            location.hash = '#admin'; 
        } else if (savedUser) {
            location.hash = '#dashboard';
        } else {
            showScreen('login-screen');
        }
    }
}

// [수정] 모듈 스크립트에서 전역 함수로 노출 (HTML의 onclick="" 때문)
window.login = login;
window.logout = logout;
window.backToDashboard = backToDashboard;
window.submitSurvey = submitSurvey;
window.viewSessionDetail = viewSessionDetail;
window.viewUserResponses = viewUserResponses;
window.loadAdminPage = loadAdminPage;

// 페이지 로드 시 및 해시 변경 시 라우터 실행
window.addEventListener('load', () => {
    handleRouteChange();
    
    // 임시저장 및 프로그레스바 이벤트 리스너
    document.addEventListener('change', function(e) {
        if (e.target.type === 'radio' || e.target.tagName === 'TEXTAREA') {
            updateProgress();
            if (currentWeek && currentUser) {
                saveDraftResponse(currentWeek);
            }
        }
    });

    // 로그인 엔터키
    const loginInput = document.getElementById('loginInput');
    if (loginInput) {
        loginInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
});
window.addEventListener('hashchange', handleRouteChange);

/* * sensory.html의 <body> 끝에 다음 스크립트 태그를 추가해야 합니다:
 * <script type="module" src="js/sensory.js"></script>
 */
