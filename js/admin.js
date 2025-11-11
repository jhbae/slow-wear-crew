// Admin 페이지 JavaScript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import { calculateSensitivity } from './utils.js';

const firebaseConfig = {
    apiKey: "AIzaSyCIjXYco5ydEsXcap0kq2hvRstNT4vjorY",
    authDomain: "slow-wear-crew.firebaseapp.com",
    databaseURL: "https://slow-wear-crew-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "slow-wear-crew",
    storageBucket: "slow-wear-crew.firebasestorage.app",
    messagingSenderId: "281669334869",
    appId: "1:281669334869:web:e8ebacf777c25127a5e1dc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let allData = {
    participants: {},
    sessions: {},
    surveys: {},
    responses: {}
};

// 인증 상태 체크
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 로그인 성공
        document.getElementById('loginBox').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('userEmail').textContent = user.email;

        // 데이터 로드
        await loadAllData();
    } else {
        // 로그아웃 상태
        document.getElementById('loginBox').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
    }
});

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

        // onAuthStateChanged에서 자동으로 처리됨
    } catch (error) {
        console.error('Login error:', error);

        let errorMessage = '로그인 실패';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = '존재하지 않는 계정입니다.';
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

window.adminLogout = async function() {
    try {
        await signOut(auth);
        document.getElementById('adminEmail').value = '';
        document.getElementById('adminPassword').value = '';
    } catch (error) {
        console.error('Logout error:', error);
        alert('로그아웃 중 오류가 발생했습니다.');
    }
};

async function loadAllData() {
    try {
        // Sessions
        const sessionsSnapshot = await get(ref(db, 'sessions'));
        allData.sessions = sessionsSnapshot.val() || {};

        // Surveys
        const surveysSnapshot = await get(ref(db, 'surveys'));
        allData.surveys = surveysSnapshot.val() || {};

        // Participants
        const participantsSnapshot = await get(ref(db, 'participants'));
        allData.participants = participantsSnapshot.val() || {};

        // Responses (전체 조회 가능 - auth != null)
        const responsesSnapshot = await get(ref(db, 'responses'));
        allData.responses = responsesSnapshot.val() || {};

        // UI 업데이트
        populateFilters();
        loadParticipantData();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('데이터 로드 중 오류가 발생했습니다.');
    }
}

function populateFilters() {
    const sessionSelect = document.getElementById('sensorySessionFilter');
    sessionSelect.innerHTML = '<option value="">-- Select a Session --</option>';
    Object.entries(allData.sessions).forEach(([id, session]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${session.name} (${session.startDate} ~ ${session.endDate})`;
        sessionSelect.appendChild(option);
    });
}

window.loadSensoryData = function() {
    const sessionFilter = document.getElementById('sensorySessionFilter').value;

    if (!sessionFilter) {
        document.getElementById('sensoryContent').style.display = 'none';
        document.getElementById('sensoryEmpty').style.display = 'block';
        return;
    }

    document.getElementById('sensoryContent').style.display = 'block';
    document.getElementById('sensoryEmpty').style.display = 'none';

    const sessionParticipants = Object.entries(allData.participants)
        .filter(([id, data]) => data.sessionId === sessionFilter)
        .map(([id]) => id);

    const participantData = sessionParticipants.map(participantId => {
        const participant = allData.participants[participantId];
        const responses = allData.responses[participantId] || {};

        return {
            participantId,
            petName: participant.pet,
            accessCode: participant.accessCode,
            lastAccess: participant.lastAccess,
            week1: responses.week1?.sensory || null,
            week4: responses.week4?.sensory || null
        };
    });

    displaySensoryStats(sessionFilter, participantData);
    displaySensoryByParticipant(participantData);
};

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

    const surveyTemplate = allData.surveys.sensory_survey_v1;

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
                        <span class="participant-id">${participant.participantId} - ${participant.petName}</span>
                        ${statusBadge}
                        <div style="font-size: 12px; color: #999; margin-top: 5px;">
                            Access Code: ${participant.accessCode} | Last Access: ${new Date(participant.lastAccess).toLocaleString('ko-KR')}
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

function renderWeekResponse(weekLabel, responseData, surveyTemplate) {
    if (!responseData) return '';

    return surveyTemplate.categories.map(category => {
        const categoryData = responseData[category.id];
        if (!categoryData) return '';

        const totalScore = categoryData.questions.reduce((sum, q) => sum + q.value, 0);
        const sensitivity = calculateSensitivity(totalScore, category.scoreRange);

        const questionsHTML = category.questions.map((question, idx) => {
            const answer = categoryData.questions[idx];
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
                    <div> <span>${category.icon}</span>
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
        const responseCount = Object.keys(responses).length;

        return `
            <div class="response-item">
                <div class="response-header">
                    <span class="participant-id">${id}</span>
                    <span class="response-week">${responseCount} responses</span>
                </div>
                <div class="question-item">
                    <div class="question-text">Access Code: <strong>${data.accessCode}</strong></div>
                    <div class="question-text">Session: <strong>${session ? session.name : data.sessionId}</strong></div>
                    <div class="question-text">Last Access: <strong>${new Date(data.lastAccess).toLocaleString('ko-KR')}</strong></div>
                    <div class="question-text">Created: <strong>${data.createdAt}</strong></div>
                </div>
            </div>
        `;
    }).join('');
};

window.exportSensoryCSV = function() {
    const sessionFilter = document.getElementById('sensorySessionFilter').value;
    if (!sessionFilter) {
        alert('세션을 먼저 선택하세요.');
        return;
    }

    const sessionParticipants = Object.entries(allData.participants)
        .filter(([id, data]) => data.sessionId === sessionFilter)
        .map(([id]) => id);

    let rows = [['Participant ID', 'Access Code', 'Week', 'Category', 'Question', 'Score', 'Note', 'Timestamp']];
    const surveyTemplate = allData.surveys.sensory_survey_v1;

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
                    rows.push([
                        participantId,
                        participant.accessCode,
                        week,
                        category.title,
                        question,
                        answer.value,
                        answer.note || '',
                        weekData.timestamp
                    ]);
                });
            });
        });
    });

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const session = allData.sessions[sessionFilter];
    downloadFile(csv, `sensory-survey-${session.name.replace(/\s+/g, '-')}.csv`, 'text/csv');
};

window.exportSensoryJSON = function() {
    const sessionFilter = document.getElementById('sensorySessionFilter').value;
    if (!sessionFilter) {
        alert('세션을 먼저 선택하세요.');
        return;
    }

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
    const session = allData.sessions[sessionFilter];
    downloadFile(json, `sensory-survey-${session.name.replace(/\s+/g, '-')}.json`, 'application/json');
};

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.switchTab = function(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');

    if (tab === 'participants') {
        loadParticipantData();
    }
};

// Enter 키로 로그인
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            adminLogin();
        }
    });
});
