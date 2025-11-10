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

// [삭제] isAdmin, adminSessionList 변수

// --- 1. 화면 전환 ---
function showScreen(screenName) {
    // [수정] .admin-screen 제거
    document.querySelectorAll('.login-screen, .participant-dashboard-screen, .survey-screen, .result-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.querySelector(`.${screenName}`).classList.add('active');
}

// --- 2. 핵심 로더: 설문지 템플릿 로드 ---
async function ensureSurveyDataLoaded() {
    if (surveyData) return true; 
    currentSurveyTemplateId = sessionStorage.getItem('sensorySurveyTemplateId');
    if (!currentSurveyTemplateId) {
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
        logout(); 
        return false;
    }
    try {
        const surveySnapshot = await get(ref(db, `surveys/${currentSurveyTemplateId}`));
        if (!surveySnapshot.exists()) {
            alert('오류: 설문지를 찾을 수 없습니다.');
            logout();
            return false;
        }
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
// [수정] 참가자 전용 로그인
async function login() {
    const input = document.getElementById('loginInput').value.trim();
    if (!input) {
        alert('코드를 입력해주세요.');
        return;
    }
    
    try {
        // [삭제] 관리자 확인 로직 삭제
        
        // 참가자 코드 확인 (v10 쿼리)
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
            
            await set(ref(db, `participants/${userId}/lastAccess`), new Date().toISOString());
            
            location.hash = '#dashboard';
        } else {
            alert('유효하지 않은 코드입니다.'); // [수정] "비밀번호" 문구 삭제
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
    // [삭제] isAdmin, adminSessionList 초기화 삭제
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
        const sessionSnapshot = await get(ref(db, `sessions/${currentSessionId}`));
        const sessionData = sessionSnapshot.val() || {};
        
        const sessionInfo = document.getElementById('sessionInfo');
        sessionInfo.innerHTML = `
            <strong>${sessionData.name || currentSessionId}</strong><br>
            ${sessionData.startDate || ''} ${sessionData.endDate ? `~ ${sessionData.endDate}` : ''}
        `;
        
        const responsesSnapshot = await get(ref(db, `responses/${currentUser}`));
        const myResponses = responsesSnapshot.val() || {};
        
        let completedWeeks = 0; 
        const targetWeeks = [1, 4]; 
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
    location.hash = '#dashboard';
}

// --- 5. 설문지/결과지 HTML 생성 ---
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
        const snapshot = await get(ref(db, `responses/${currentUser}/week${currentWeek}/sensory`));
        let previousResponses = snapshot.val();

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
        
        updateProgress();
    } catch (error) {
        console.error('설문 로드 오류:', error);
        content.innerHTML = '설문 로드 중 오류가 발생했습니다.';
    }
}

// 진행률 업데이트
function updateProgress() {
    if (!surveyData) return;
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
    const tempResponses = collectResponses(false);
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
        await set(ref(db, `responses/${currentUser}/week${currentWeek}/sensory`), data);
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

        const calculatedTotal = categoryData.questions.reduce((sum, q) => sum + q.value, 0);
        const sensitivity = calculateSensitivity(calculatedTotal, category.scoreRange);
        
        const questionsHTML = buildQuestionsHTML(category, catIndex, categoryData, true);
        
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

// [삭제] --- 7. 관리자 페이지 (sensory.html 내장) --- (관련 함수 3개 모두 삭제)

// --- 8. 라우터 및 이벤트 리스너 ---
async function handleRouteChange() {
    const hash = window.location.hash || '#login';
    
    // [수정] .admin-screen 제거
    document.querySelectorAll('.login-screen, .participant-dashboard-screen, .survey-screen, .result-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const savedUser = sessionStorage.getItem('currentUser');
    // [삭제] savedIsAdmin 변수

    if (hash === '#dashboard') {
        if (!savedUser) { location.hash = '#login'; return; }
        currentUser = savedUser;
        currentSessionId = sessionStorage.getItem('currentSessionId');
        await loadParticipantDashboard(); 
        showScreen('participant-dashboard-screen'); 
    
    // [삭제] else if (hash === '#admin') 블록
    
    } else if (hash.startsWith('#week')) {
        if (!savedUser) { location.hash = '#login'; return; }
        const week = parseInt(hash.replace('#week', ''));
        currentUser = savedUser;
        await viewWeekDetail(week); 
        
    } else if (hash.startsWith('#survey')) {
        if (!savedUser) { location.hash = '#login'; return; }
        const week = parseInt(hash.replace('#survey', ''));
        currentUser = savedUser;
        currentSessionId = sessionStorage.getItem('currentSessionId');
        startWeekSurvey(week); 

    } else { // '#login' 또는 알 수 없는 해시
        // [수정] 관리자 확인 로직 삭제
        if (savedUser) {
            location.hash = '#dashboard';
        } else {
            showScreen('login-screen');
        }
    }
}

// [수정] 모듈 스크립트에서 전역 함수로 노출
window.login = login;
window.logout = logout;
window.backToDashboard = backToDashboard;
window.submitSurvey = submitSurvey;
// [삭제] 관리자 관련 함수 3개

// 페이지 로드 시 및 해시 변경 시 라우터 실행
window.addEventListener('load', () => {
    handleRouteChange();
    
    document.addEventListener('change', function(e) {
        if (e.target.type === 'radio' || e.target.tagName === 'TEXTAREA') {
            updateProgress();
            if (currentWeek && currentUser) {
                saveDraftResponse(currentWeek);
            }
        }
    });

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
