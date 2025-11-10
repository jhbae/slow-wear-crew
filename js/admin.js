// [수정] 공통 모듈에서 db, auth 임포트
import { db, auth } from './firebase-init.js';
// [수정] v10 SDK 함수 임포트
import { ref, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
// [수정] 공통 유틸리티에서 함수 임포트
import { calculateSensitivity, downloadFile } from './utils.js';

// --- 전역 변수 ---
let allData = {
    participants: {},
    sessions: {},
    surveys: {},
    responses: {}
};

// --- 1. 인증 ---

// 인증 상태 체크 (페이지 로드 시 실행)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 로그인 성공
        document.getElementById('loginBox').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('userEmail').textContent = user.email;
        
        // 핵심 데이터 로드
        await loadAllData();
    } else {
        // 로그아웃 상태
        document.getElementById('loginBox').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
    }
});

// [수정] 전역 함수로 노출 (HTML onclick="" 때문)
window.adminLogin = async function() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const errorDiv = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    errorDiv.classList.remove('show');
    errorDiv.textContent = '';

    if (!email || !password) {
        errorDiv.textContent = '이메일과 비밀번호를 입력하세요.';
        errorDiv.classList.add('show');
        return;
    }

    try {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';

        await signInWithEmailAndPassword(auth, email, password);
        // 성공 시 onAuthStateChanged가 자동으로 화면 전환 처리
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = '로그인 실패';
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/invalid-credential': // 최신 SDK는 이 코드를 사용
                errorMessage = '존재하지 않는 계정이거나 잘못된 비밀번호입니다.';
                break;
            case 'auth/wrong-password':
                errorMessage = '잘못된 비밀번호입니다.';
                break;
            case 'auth/invalid-email':
                errorMessage = '올바른 이메일 형식이 아닙니다.';
                break;
            case 'auth/too-many-requests':
                errorMessage = '너무 많은 로그인 시도. 잠시 후 다시 시도하세요.';
                break;
            default:
                errorMessage = `로그인 실패: ${error.message}`;
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.classList.add('show');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
};

// [수정] 전역 함수로 노출
window.adminLogout = async function() {
    try {
        await signOut(auth);
        // 성공 시 onAuthStateChanged가 자동으로 화면 전환 처리
        document.getElementById('adminEmail').value = '';
        document.getElementById('adminPassword').value = '';
    } catch (error) {
        console.error('Logout error:', error);
        alert('로그아웃 중 오류가 발생했습니다.');
    }
};

// --- 2. 데이터 로드 및 필터 ---

// (로그인 성공 시) 모든 핵심 데이터 로드
async function loadAllData() {
    try {
        // v10 구문 사용
        const sessionsSnapshot = await get(ref(db, 'sessions'));
        allData.sessions = sessionsSnapshot.val() || {};

        const surveysSnapshot = await get(ref(db, 'surveys'));
        allData.surveys = surveysSnapshot.val() || {};

        const participantsSnapshot = await get(ref(db, 'participants'));
        allData.participants = participantsSnapshot.val() || {};

        const responsesSnapshot = await get(ref(db, 'responses'));
        allData.responses = responsesSnapshot.val() || {};

        // UI 업데이트
        populateFilters();
        loadParticipantData(); // Participants 탭 기본 데이터 로드
    } catch (error) {
        console.error('Error loading data:', error);
        alert('데이터 로드 중 오류가 발생했습니다.');
    }
}

// 세션 필터 채우기
function populateFilters() {
    const sessionSelect = document.getElementById('sensorySessionFilter');
    sessionSelect.innerHTML = '<option value="">-- Select a Session --</option>';
    Object.entries(allData.sessions).forEach(([id, session]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${session.name} (${session.startDate || 'N/A'} ~ ${session.endDate || 'N/A'})`;
        sessionSelect.appendChild(option);
    });
}

// --- 3. Sensory Survey 탭 ---

// "Load Data" 버튼 클릭 시
// [수정] 전역 함수로 노출
window.loadSensoryData = function() {
    const sessionFilter = document.getElementById('sensorySessionFilter').value;

    if (!sessionFilter) {
        document.getElementById('sensoryContent').style.display = 'none';
        document.getElementById('sensoryEmpty').style.display = 'block';
        return;
    }

    document.getElementById('sensoryContent').style.display = 'block';
    document.getElementById('sensoryEmpty').style.display = 'none';

    // 선택된 세션의 참가자 ID 목록 필터링
    const sessionParticipants = Object.entries(allData.participants)
        .filter(([id, data]) => data.sessionId === sessionFilter)
        .map(([id]) => id);

    // 참가자별로 필요한 데이터 재가공
    const participantData = sessionParticipants.map(participantId => {
        const participant = allData.participants[participantId];
        const responses = allData.responses[participantId] || {};
        
        return {
            participantId,
            accessCode: participant.accessCode,
            lastAccess: participant.lastAccess,
            week1: responses.week1?.sensory || null,
            week4: responses.week4?.sensory || null
        };
    });

    displaySensoryStats(sessionFilter, participantData);
    displaySensoryByParticipant(participantData);
};

// 통계 카드 표시
function displaySensoryStats(sessionId, participantData) {
    const statsDiv = document.getElementById('sensoryStats');
    
    const totalParticipants = participantData.length;
    const week1Responses = participantData.filter(p => p.week1).length;
    const week4Responses = participantData.filter(p => p.week4).length;
    const bothWeeksComplete = participantData.filter(p => p.week1 && p.week4).length;

    statsDiv.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalParticipants}</div>
            <div class="stat-label">Total Participants</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${week1Responses}</div>
            <div class="stat-label">Week 1 Responses</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${week4Responses}</div>
            <div class="stat-label">Week 4 Responses</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${bothWeeksComplete}</div>
            <div class="stat-label">Both Weeks Complete</div>
        </div>
    `;
}

// 참가자별 응답 목록 표시
function displaySensoryByParticipant(participantData) {
    const listDiv = document.getElementById('sensoryResponseList');
    
    if (participantData.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>No participants in this session</h3>
            </div>
        `;
        return;
    }

    // [주의] 'sensory_survey_v1' 하드코딩. 만약 템플릿 ID가 세션별로 다르다면 수정 필요.
    // 현재 구조에서는 sessionData에서 templateId를 가져와야 함.
    // 여기서는 allData.surveys에 'sensory_survey_v1'이 있다고 가정함.
    const surveyTemplate = allData.surveys.sensory_survey_v1; 
    if (!surveyTemplate) {
        listDiv.innerHTML = `<div class="error-message show">Error: 'sensory_survey_v1' 템플릿을 찾을 수 없습니다.</div>`;
        return;
    }
    
    listDiv.innerHTML = participantData.map(participant => {
        const hasWeek1 = !!participant.week1;
        const hasWeek4 = !!participant.week4;
        
        let statusBadge = '';
        if (hasWeek1 && hasWeek4) {
            statusBadge = '<span style="background: #28a745; color: white; padding: 5px 12px; border-radius: 12px; font-size: 12px; margin-left: 10px;">✓ Complete</span>';
        } else if (hasWeek1 || hasWeek4) {
            statusBadge = '<span style="background: #ffc107; color: white; padding: 5px 12px; border-radius: 12px; font-size: 12px; margin-left: 10px;">⚠ Partial</span>';
        } else {
            statusBadge = '<span style="background: #dc3545; color: white; padding: 5px 12px; border-radius: 12px; font-size: 12px; margin-left: 10px;">✗ No Response</span>';
        }

        const week1HTML = hasWeek1 ? renderWeekResponse('Week 1', participant.week1, surveyTemplate) : 
            '<div style="padding: 20px; text-align: center; color: #999;">Week 1 응답 없음</div>';

        const week4HTML = hasWeek4 ? renderWeekResponse('Week 4', participant.week4, surveyTemplate) : 
            '<div style="padding: 20px; text-align: center; color: #999;">Week 4 응답 없음</div>';

        return `
            <div class="response-item">
                <div class="response-header">
                    <div>
                        <span class="participant-id">${participant.participantId}</span>
                        ${statusBadge}
                        <div style="font-size: 12px; color: #999; margin-top: 5px;">
                            Access Code: ${participant.accessCode} | Last Access: ${participant.lastAccess ? new Date(participant.lastAccess).toLocaleString('ko-KR') : 'N/A'}
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                    <div style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fafafa;">
                        <h4 style="color: #667eea; margin-bottom: 15px; text-align: center;">Week 1</h4>
                        ${week1HTML}
                    </div>
                    <div style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fafafa;">
                        <h4 style="color: #764ba2; margin-bottom: 15px; text-align: center;">Week 4</h4>
                        ${week4HTML}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 주차별 응답 상세 렌더링
function renderWeekResponse(weekLabel, responseData, surveyTemplate) {
    if (!responseData) return '';

    return surveyTemplate.categories.map(category => {
        const categoryData = responseData[category.id];
        if (!categoryData) return '';

        const totalScore = categoryData.questions.reduce((sum, q) => sum + q.value, 0);
        
        // [공통 함수 사용]
        const sensitivity = calculateSensitivity(totalScore, category.scoreRange);

        const questionsHTML = category.questions.map((question, idx) => {
            const answer = categoryData.questions[idx];
            if (!answer) return ''; // 데이터 무결성 체크
            
            let scoreColor = '#28a745';
            if (answer.value === 2) scoreColor = '#ffc107';
            if (answer.value === 3) scoreColor = '#dc3545';

            return `
                <div class="question-item">
                    <div class="question-text" style="font-size: 13px;">${question}</div>
                    <div class="question-answer">
                        <span class="answer-value" style="color: ${scoreColor};">★ ${answer.value}</span>
                        ${answer.note ? `<span class="answer-note">"${answer.note}"</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="category-section" style="margin-bottom: 15px;">
                <div class="category-title" style="background: #f0f0f0; padding: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span>${category.icon}</span>
                        <span style="font-size: 14px;">${category.title}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 14px; font-weight: 600; color: #667eea; margin-right: 8px;">${totalScore}점</span>
                        <span class="admin-sensitivity ${sensitivity.level}">${sensitivity.text}</span>
                    </div>
                </div>
                ${questionsHTML}
            </div>
        `;
    }).join('');
}

// --- 4. Participants 탭 ---

// [수정] 전역 함수로 노출
window.loadParticipantData = function() {
    const statsDiv = document.getElementById('participantStats');
    const listDiv = document.getElementById('participantList');

    const totalParticipants = Object.keys(allData.participants).length;
    const participantsWithResponses = new Set(Object.keys(allData.responses)).size;
    
    statsDiv.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalParticipants}</div>
            <div class="stat-label">Total Participants</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${participantsWithResponses}</div>
            <div class="stat-label">With Responses</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalParticipants - participantsWithResponses}</div>
            <div class="stat-label">No Responses</div>
        </div>
    `;

    listDiv.innerHTML = Object.entries(allData.participants).map(([id, data]) => {
        const session = allData.sessions[data.sessionId];
        const responses = allData.responses[id] || {};
        const responseCount = Object.keys(responses).length; // week1, week4 등

        return `
            <div class="response-item">
                <div class="response-header">
                    <span class="participant-id">${id}</span>
                    <span class="response-week">${responseCount} responses</span>
                </div>
                <div class="question-item">
                    <div class="question-text">Access Code: <strong>${data.accessCode}</strong></div>
                    <div class="question-text">Session: <strong>${session ? session.name : data.sessionId}</strong></div>
                    <div class="question-text">Last Access: <strong>${data.lastAccess ? new Date(data.lastAccess).toLocaleString('ko-KR') : 'N/A'}</strong></div>
                    <div class="question-text">Created: <strong>${data.createdAt || 'N/A'}</strong></div>
                </div>
            </div>
        `;
    }).join('');
};

// --- 5. Export 기능 ---

// [수정] 전역 함수로 노출
window.exportSensoryCSV = function() {
    const sessionFilter = document.getElementById('sensorySessionFilter').value;
    if (!sessionFilter) {
        alert('세션을 먼저 선택하세요.');
        return;
    }
    const session = allData.sessions[sessionFilter];
    const surveyTemplate = allData.surveys.sensory_survey_v1; // [주의] 하드코딩

    if (!surveyTemplate) {
        alert("Error: 'sensory_survey_v1' 템플릿을 찾을 수 없습니다.");
        return;
    }

    const sessionParticipants = Object.entries(allData.participants)
        .filter(([id, data]) => data.sessionId === sessionFilter)
        .map(([id]) => id);

    let rows = [['Participant ID', 'Access Code', 'Week', 'Category', 'Question', 'Score', 'Note', 'Timestamp']];

    sessionParticipants.forEach(participantId => {
        const participant = allData.participants[participantId];
        const responses = allData.responses[participantId] || {};

        ['week1', 'week4'].forEach(week => {
            const weekData = responses[week]?.sensory;
            if (!weekData) return;

            surveyTemplate.categories.forEach(category => {
                const categoryData = weekData[category.id];
                if (!categoryData) return;

                category.questions.forEach((question, idx) => {
                    const answer = categoryData.questions[idx];
                    if (!answer) return;
                    rows.push([
                        participantId,
                        participant.accessCode,
                        week,
                        category.title,
                        question.replace(/"/g, '""'), // CSV 따옴표 이스케이프
                        answer.value,
                        answer.note ? answer.note.replace(/"/g, '""') : '',
                        weekData.timestamp
                    ]);
                });
            });
        });
    });

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    // [공통 함수 사용]
    downloadFile(csv, `sensory-survey-${session.name.replace(/\s+/g, '-')}.csv`, 'text/csv');
};

// [수정] 전역 함수로 노출
window.exportSensoryJSON = function() {
    const sessionFilter = document.getElementById('sensorySessionFilter').value;
    if (!sessionFilter) {
        alert('세션을 먼저 선택하세요.');
        return;
    }
    const session = allData.sessions[sessionFilter];

    const sessionParticipants = Object.entries(allData.participants)
        .filter(([id, data]) => data.sessionId === sessionFilter)
        .map(([id]) => id);

    let exportData = {};
    sessionParticipants.forEach(participantId => {
        const responses = allData.responses[participantId];
        if (responses) {
            exportData[participantId] = {
                accessCode: allData.participants[participantId].accessCode,
                responses: responses
            };
        }
    });

    const json = JSON.stringify(exportData, null, 2);
    // [공통 함수 사용]
    downloadFile(json, `sensory-survey-${session.name.replace(/\s+/g, '-')}.json`, 'application/json');
};


// --- 6. UI 이벤트 핸들러 ---

// [수정] 전역 함수로 노출
window.switchTab = function(tabName) {
    // event.target을 사용하기 위해 event 객체를 받아야 함
    // HTML에서 onclick="switchTab(event, 'sensory')"로 수정 필요
    // 또는 event를 쓰지 않고 tabName으로만 처리
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 'sensory' -> 'sensoryTab'
    document.getElementById(tabName + 'Tab').classList.add('active');
    // 'sensory' -> .tab-btn[onclick*="'sensory'"]
    // 간단한 방법: data-tab 속성 사용. 지금은 그냥 ID로 버튼을 찾아보자.
    // CSS 선택자를 사용해 버튼을 찾는 것이 더 견고함.
    // 예: document.querySelector(`.tab-btn[onclick*="'${tabName}'"]`).classList.add('active');
    // 하지만 HTML 구조가 바뀌면 깨지므로, data 속성 사용을 권장.
    // 지금은 임시로 버튼 텍스트 등으로 찾거나... 아니면 HTML 수정을 가정함.
    
    // HTML을 onclick="switchTab(this, 'sensory')" 로 바꾸는 것이 BEST
    // event.target.classList.add('active');

    // 임시: HTML 수정 없이 하려면...
    const buttons = document.querySelectorAll('.tab-btn');
    if (tabName === 'sensory') buttons[0].classList.add('active');
    else if (tabName === 'progress') buttons[1].classList.add('active');
    else if (tabName === 'participants') buttons[2].classList.add('active');

    if (tabName === 'participants') {
        loadParticipantData();
    }
};

// Enter 키로 로그인
document.addEventListener('DOMContentLoaded', () => {
    const adminPasswordInput = document.getElementById('adminPassword');
    if (adminPasswordInput) {
        adminPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.adminLogin(); // 전역으로 노출된 함수 호출
            }
        });
    }
});
