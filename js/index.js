// [수정] 공통 모듈에서 db 임포트
import { db } from './firebase-init.js';
// [수정] v10(v9 모듈식) SDK 함수 임포트
import { ref, get, query, orderByChild, equalTo, set } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

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
    if (!input) return;

    try {
        // [수정] v10 구문으로 변경 (get, ref)
        const adminSnapshot = await get(ref(db, `admin/${input}`));
        if (adminSnapshot.exists()) {
            isAdmin = true;
            sessionStorage.setItem('isAdmin', 'true');
            location.hash = '#select';
            return;
        }
        
        // [수정] v10 쿼리 구문으로 변경 (query, orderByChild, equalTo)
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

            // [수정] v10 구문으로 변경
            const sessionSnapshot = await get(ref(db, `sessions/${userData.sessionId}`));
            const sessionData = sessionSnapshot.val();
            
            if (!sessionData || !sessionData.sensorySurveyTemplateId || !sessionData.wearingProgressSurveyTemplateId) {
                 alert('오류: 이 세션에 할당된 설문지 템플릿 정보가 불완전합니다.');
                 return;
            }

            sessionStorage.setItem('currentUser', userId);
            sessionStorage.setItem('currentSessionId', userData.sessionId);
            sessionStorage.setItem('accessCode', input.toUpperCase());
            sessionStorage.setItem('sensorySurveyTemplateId', sessionData.sensorySurveyTemplateId);
            sessionStorage.setItem('wearingProgressSurveyTemplateId', sessionData.wearingProgressSurveyTemplateId);
            
            // [수정] v10 구문으로 변경 (set)
            await set(ref(db, `participants/${userId}/lastAccess`), new Date().toISOString());
            
            location.hash = '#select'; 
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
        showScreen('survey-select-screen'); 
        
    } else { // '#login'
        if (savedUser || savedIsAdmin) {
            location.hash = '#select'; 
        } else {
            showScreen('login-screen');
        }
    }
}

// [수정] 모듈 스크립트에서 전역 함수로 노출
window.login = login;
window.logout = logout;

// 이벤트 리스너
window.addEventListener('load', handleRouteChange);
window.addEventListener('hashchange', handleRouteChange);
document.getElementById('loginInput').addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') {
        login(); // 이 파일 내부에서는 window.login()이 필요 없음
    } 
});
