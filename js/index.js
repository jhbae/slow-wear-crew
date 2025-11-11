// index.html 전용 JavaScript

let currentUser = null;
let currentSessionId = null;
let isAdmin = false;

// 화면 전환 (login/select만)
function showScreen(screenName) {
    document.querySelectorAll('.login-screen, .survey-select-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.querySelector(`.${screenName}`).classList.add('active');
}

// 로그인
async function login() {
    const input = document.getElementById('loginInput').value.trim();
    if (!input || !database) return;

    try {
        // 1. 관리자 확인
        const adminSnapshot = await database.ref(`admin/${input}`).once('value');
        if (adminSnapshot.exists()) {
            isAdmin = true;
            sessionStorage.setItem('isAdmin', 'true');
            
            // returnUrl 확인
            const returnUrl = sessionStorage.getItem('returnUrl');
            if (returnUrl) {
                sessionStorage.removeItem('returnUrl');
                window.location.href = returnUrl;
            } else {
                location.hash = '#select';
            }
            return;
        }
        
        // 2. 참가자 확인 및 세션 정보 로드
        const participantsSnapshot = await database.ref('participants')
            .orderByChild('accessCode')
            .equalTo(input.toUpperCase())
            .once('value');
        
        const participants = participantsSnapshot.val();
        
        if (participants && Object.keys(participants).length > 0) {
            const userId = Object.keys(participants)[0];
            const userData = participants[userId];

            const sessionSnapshot = await database.ref(`sessions/${userData.sessionId}`).once('value');
            const sessionData = sessionSnapshot.val();
            
            if (!sessionData || !sessionData.sensorySurveyTemplateId || !sessionData.wearingProgressSurveyTemplateId) {
                 alert('오류: 이 세션에 할당된 설문지 템플릿 정보가 불완전합니다.');
                 return;
            }

            // ✅ [핵심] 두 템플릿 ID를 모두 저장
            sessionStorage.setItem('currentUser', userId);
            sessionStorage.setItem('currentSessionId', userData.sessionId);
            sessionStorage.setItem('accessCode', input.toUpperCase());
            sessionStorage.setItem('petName', userData.pet || '반려견');
            sessionStorage.setItem('sensorySurveyTemplateId', sessionData.sensorySurveyTemplateId);
            sessionStorage.setItem('wearingProgressSurveyTemplateId', sessionData.wearingProgressSurveyTemplateId);
            
            // 마지막 접속 시간 업데이트
            await database.ref(`participants/${userId}/lastAccess`).set(new Date().toISOString());
            
            // returnUrl 확인 - sensory.html 등에서 돌아온 경우
            const returnUrl = sessionStorage.getItem('returnUrl');
            if (returnUrl) {
                sessionStorage.removeItem('returnUrl');
                window.location.href = returnUrl;
            } else {
                location.hash = '#select';
            }
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
    sessionStorage.clear();
    document.getElementById('loginInput').value = '';
    location.hash = '#login';
}

// 라우터
async function handleRouteChange() {
    const hash = window.location.hash || '#login';
    const savedUser = sessionStorage.getItem('currentUser');
    const savedIsAdmin = sessionStorage.getItem('isAdmin');

    if (hash === '#select') {
        if (!savedUser && !savedIsAdmin) return location.hash = '#login';
        // 관리자는 이 페이지에서 로그아웃만 가능
        showScreen('survey-select-screen'); 
        
    } else { // '#login'
        if (savedUser || savedIsAdmin) {
            location.hash = '#select'; 
        } else {
            showScreen('login-screen');
        }
    }
}

// 이벤트 리스너
window.addEventListener('load', handleRouteChange);
window.addEventListener('hashchange', handleRouteChange);
document.getElementById('loginInput').addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') login(); 
});
