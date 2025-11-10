// [수정] 공통 모듈에서 db 임포트
import { db } from './firebase-init.js';
// [수정] v10(v9 모듈식) SDK 함수 임포트
import { ref, get, set, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
// [수정] 공통 유틸리티에서 함수 임포트
import { calculateSensitivity } from './utils.js';

let surveyData = null; 
let currentSurveyTemplateId = null; 

let currentUser = null;
let currentSessionId = null;
let currentWeek = 1;
let isAdmin = false;
let adminSessionList = [];

// 화면 전환
function showScreen(screenName) {
    document.querySelectorAll('.login-screen, .participant-dashboard-screen, .survey-screen, .result-screen, .admin-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.querySelector(`.${screenName}`).classList.add('active');
}

async function ensureSurveyDataLoaded() {
    if (surveyData) return true; 
    currentSurveyTemplateId = sessionStorage.getItem('sensorySurveyTemplateId');
    if (!currentSurveyTemplateId) {
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
        logout(); 
        return false;
    }
    try {
        // [수정] v10 구문
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

// 통합 로그인 (쿼리 기반)
async function login() {
    const input = document.getElementById('loginInput').value.trim();
    if (!input) {
        alert('코드 또는 비밀번호를 입력해주세요.');
        return;
    }
    
    try {
        // [수정] v10 구문
        const adminSnapshot = await get(ref(db, `admin/${input}`));
        if (adminSnapshot.exists()) {
            isAdmin = true;
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('adminPassword', input);
            location.hash = '#admin';
            return;
        }
        
        // [수정] v10 쿼리
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

            // [수정] v10 구문
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
            
            // [수정] v10 구문
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
    document.getElementById('loginInput').value = '';
    location.hash = '#login';
}

// 참가자 대시보드 로드
async function loadParticipantDashboard() {
    if (!await ensureSurveyDataLoaded()) return;
    if (!currentUser || !currentSessionId) return;
    
    try {
        // [수정] v10 구문
        const sessionSnapshot = await get(ref(db, `sessions/${currentSessionId}`));
        const sessionData = sessionSnapshot.val() || {};
        
        const sessionInfo = document.getElementById('sessionInfo');
        sessionInfo.innerHTML = `
            <strong>${sessionData.name || currentSessionId}</strong><br>
            ${sessionData.startDate || ''} ${sessionData.endDate ? `~ ${sessionData.endDate}` : ''}
        `;
        
        // [수정] v10 구문
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
                // ... (중략) ...
                // [수정] calculateSensitivity는 이제 공통 유틸리티에서 가져옴
                const sensitivity = calculateSensitivity(calculatedTotal, category.scoreRange); 
                // ... (중략) ...
            } else {
                // ... (중략) ...
            }
            weekGrid.appendChild(weekCard);
        }
    } catch (error) {
        console.error('대시보드 로드 오류:', error);
    }
}

// (중략... viewWeekDetail, startWeekSurvey, backToDashboard, buildCategoryHeaderHTML, buildQuestionsHTML 함수는 Firebase 호출이 없으므로 그대로 둡니다)

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
        // [수정] v10 구문
        const snapshot = await get(ref(db, `responses/${currentUser}/week${currentWeek}/sensory`));
        let previousResponses = snapshot.val();

        const storageKey = `draft_sensory_week${currentWeek}_${currentUser}`;
        const draftString = localStorage.getItem(storageKey);
        if (draftString) {
            previousResponses = JSON.parse(draftString); 
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

// (중략... updateProgress, saveDraftResponse, collectResponses 함수는 Firebase 호출이 없으므로 그대로 둡니다)

// [삭제] calculateSensitivity 함수 (js/utils.js로 이동)

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
        // [수정] v10 구문
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

// (중략... showResults 함수는 Firebase 호출이 없으므로 그대로 둡니다)

// 관리자 페이지 로드
async function loadAdminPage() {
    try {
        // [수정] v10 구문
        const sessionsSnapshot = await get(ref(db, 'sessions'));
        const sessions = sessionsSnapshot.val() || {};
        
        const container = document.getElementById('adminContent');
        // ... (중략) ...
        
        // [수정] v10 구문
        const responsesSnapshot = await get(ref(db, 'responses'));
        const allResponses = responsesSnapshot.val() || {};
        
        adminSessionList = [];
        
        for (const [sessionId, sessionData] of Object.entries(sessions)) {
            // [수정] v10 쿼리
            const participantsQuery = query(
                ref(db, 'participants'),
                orderByChild('sessionId'),
                equalTo(sessionId)
            );
            const participantsSnapshot = await get(participantsQuery);
            // ... (중략) ...
        }
    } catch (error) {
        console.error('관리자 페이지 로드 오류:', error);
    }
}

// 회차 상세 보기
async function viewSessionDetail(sessionId) {
    try {
        // [수정] v10 구문
        const sessionSnapshot = await get(ref(db, `sessions/${sessionId}`));
        const sessionData = sessionSnapshot.val();
        
        // [수정] v10 쿼리
        const participantsQuery = query(
            ref(db, 'participants'),
            orderByChild('sessionId'),
            equalTo(sessionId)
        );
        const participantsSnapshot = await get(participantsQuery);
        const sessionParticipants = participantsSnapshot.val() || {};
        
        // [수정] v10 구문
        const responsesSnapshot = await get(ref(db, 'responses'));
        const allResponses = responsesSnapshot.val() || {};
        // ... (중략) ...
    } catch (error) {
        console.error('회차 상세 로드 오류:', error);
    }
}

// 사용자 응답 보기
async function viewUserResponses(userId) {
    try {
        // [수정] v10 구문
        const participantSnapshot = await get(ref(db, `participants/${userId}`));
        // ... (중략) ...
        // [수정] v10 구문
        const sessionSnapshot = await get(ref(db, `sessions/${participantData.sessionId}`));
        // ... (중략) ...
        // [수정] v10 구문
        const templateSnapshot = await get(ref(db, `surveys/${sessionData.sensorySurveyTemplateId}`));
        // ... (중략) ...
        // [수정] v10 구문
        const responsesSnapshot = await get(ref(db, `responses/${userId}`));
        // ... (중략) ...
    } catch (error) {
        console.error('사용자 응답 로드 오류:', error);
    }
}

// (중략... handleRouteChange 함수는 Firebase 호출이 없으므로 그대로 둡니다)

// [수정] 모듈 스크립트에서 전역 함수로 노출 (HTML의 onclick="" 때문)
window.login = login;
window.logout = logout;
window.backToDashboard = backToDashboard;
window.submitSurvey = submitSurvey;
window.viewSessionDetail = viewSessionDetail;
window.viewUserResponses = viewUserResponses;
window.loadAdminPage = loadAdminPage;

// 2. 페이지 로드 시 및 해시 변경 시 라우터 실행
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
            if (e.key === 'Enter') login();
        });
    }
});
window.addEventListener('hashchange', handleRouteChange);

/* * sensory.html의 <body> 끝에 다음 스크립트 태그를 추가해야 합니다:
 * <script type="module" src="js/sensory.js"></script>
 */
