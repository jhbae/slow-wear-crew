// Admin 페이지 JavaScript

// Firebase 설정 (compat 방식)
const firebaseConfig = {
    apiKey: "AIzaSyCIjXYco5ydEsXcap0kq2hvRstNT4vjorY",
    authDomain: "slow-wear-crew.firebaseapp.com",
    databaseURL: "https://slow-wear-crew-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "slow-wear-crew",
    storageBucket: "slow-wear-crew.firebasestorage.app",
    messagingSenderId: "281669334869",
    appId: "1:281669334869:web:e8ebacf777c25127a5e1dc"
};

// Firebase 초기화
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

let allData = {
    participants: {},
    sessions: {},
    surveys: {},
    responses: {}
};

// 인증 상태 체크
auth.onAuthStateChanged(async (user) => {
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

        await auth.signInWithEmailAndPassword(email, password);

        // onAuthStateChanged에서 자동으로 처리됨
    } catch (error) {
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
        await auth.signOut();
        document.getElementById('adminEmail').value = '';
        document.getElementById('adminPassword').value = '';
    } catch (error) {
        alert('로그아웃 중 오류가 발생했습니다.');
    }
};

async function loadAllData() {
    try {
        // Sessions
        const sessionsSnapshot = await db.ref('sessions').once('value');
        allData.sessions = sessionsSnapshot.val() || {};

        // Surveys
        const surveysSnapshot = await db.ref('surveys').once('value');
        allData.surveys = surveysSnapshot.val() || {};

        // Participants
        const participantsSnapshot = await db.ref('participants').once('value');
        allData.participants = participantsSnapshot.val() || {};

        // Responses (전체 조회 가능 - auth != null)
        const responsesSnapshot = await db.ref('responses').once('value');
        allData.responses = responsesSnapshot.val() || {};

        console.log('✅ Admin 데이터 로드 성공:', {
            sessionsCount: Object.keys(allData.sessions).length,
            participantsCount: Object.keys(allData.participants).length,
            responsesCount: Object.keys(allData.responses).length
        });

        // UI 업데이트
        populateFilters();
        loadParticipantData();
    } catch (error) {
        console.error('❌ Admin 데이터 로드 실패:', error);
        console.error('상세 정보:', {
            paths: 'sessions, surveys, participants, responses',
            error: error.message
        });
        alert('문제가 발생했습니다.\n관리자에게 문의해주세요.\n\n(개발자: 콘솔을 확인하세요)');
    }
}

function populateFilters() {
    // Sensory 필터
    const sensorySessionSelect = document.getElementById('sensorySessionFilter');
    sensorySessionSelect.innerHTML = '<option value="">-- Select a Session --</option>';
    Object.entries(allData.sessions).forEach(([id, session]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${session.name} (${session.startDate} ~ ${session.endDate})`;
        sensorySessionSelect.appendChild(option);
    });

    // Progress 필터
    const progressSessionSelect = document.getElementById('progressSessionFilter');
    progressSessionSelect.innerHTML = '<option value="">-- Select a Session --</option>';
    Object.entries(allData.sessions).forEach(([id, session]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${session.name} (${session.startDate} ~ ${session.endDate})`;
        progressSessionSelect.appendChild(option);
    });

    // Participant 필터
    const participantSessionSelect = document.getElementById('participantSessionFilter');
    participantSessionSelect.innerHTML = '<option value="">-- Select a Session --</option>';
    Object.entries(allData.sessions).forEach(([id, session]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${session.name} (${session.startDate} ~ ${session.endDate})`;
        participantSessionSelect.appendChild(option);
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
            statusBadge = '<span class="status-badge complete">✓ Complete</span>';
        } else if (hasWeek1 || hasWeek4) {
            statusBadge = '<span class="status-badge partial">⚠ Partial</span>';
        } else {
            statusBadge = '<span class="status-badge none">✗ No Response</span>';
        }

        const week1HTML = hasWeek1 ? renderWeekResponse('Week 1', participant.week1, surveyTemplate) :
            '<div class="no-response">Week 1 응답 없음</div>';

        const week4HTML = hasWeek4 ? renderWeekResponse('Week 4', participant.week4, surveyTemplate) :
            '<div class="no-response">Week 4 응답 없음</div>';

        return `
            <div class="response-item">
                <div class="response-header">
                    <div>
                        <span class="participant-id">${participant.participantId} - ${participant.petName}</span>
                        ${statusBadge}
                        <div class="participant-meta">
                            Access Code: ${participant.accessCode} | Last Access: ${new Date(participant.lastAccess).toLocaleString('ko-KR')}
                        </div>
                    </div>
                </div>

                <div class="grid-2col" style="margin-top: 20px;">
                    <div class="week-box ${hasWeek1 ? 'has-data' : ''}">
                        <h4>Week 1 ${hasWeek1 ? '✓' : ''}</h4>
                        ${week1HTML}
                    </div>
                    <div class="week-box ${hasWeek4 ? 'has-data' : ''}">
                        <h4>Week 4 ${hasWeek4 ? '✓' : ''}</h4>
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
    const sessionFilter = document.getElementById('participantSessionFilter').value;

    if (!sessionFilter) {
        document.getElementById('participantContent').style.display = 'none';
        document.getElementById('participantDetailView').style.display = 'none';
        document.getElementById('participantEmpty').style.display = 'block';
        return;
    }

    document.getElementById('participantContent').style.display = 'block';
    document.getElementById('participantDetailView').style.display = 'none';
    document.getElementById('participantEmpty').style.display = 'none';

    const statsDiv = document.getElementById('participantStats');
    const listDiv = document.getElementById('participantList');

    // 세션별 참가자 필터링
    const sessionParticipants = Object.entries(allData.participants)
        .filter(([id, data]) => data.sessionId === sessionFilter);

    const totalParticipants = sessionParticipants.length;
    const participantsWithResponses = sessionParticipants.filter(([id]) => allData.responses[id]).length;

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

    if (sessionParticipants.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>No participants in this session</h3>
            </div>
        `;
        return;
    }

    listDiv.innerHTML = sessionParticipants.map(([id, data]) => {
        const session = allData.sessions[data.sessionId];

        return `
            <div class="response-item participant-item-clickable" onclick="showParticipantDetail('${id}')">
                <div class="response-header">
                    <span class="participant-id">${id} - ${data.pet}</span>
                    <span class="detail-link">→ 상세보기</span>
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

window.loadProgressData = function() {
    const sessionFilter = document.getElementById('progressSessionFilter').value;

    if (!sessionFilter) {
        document.getElementById('progressContent').style.display = 'none';
        document.getElementById('progressEmpty').style.display = 'block';
        return;
    }

    document.getElementById('progressContent').style.display = 'block';
    document.getElementById('progressEmpty').style.display = 'none';

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
            week1: responses.week1?.progress || null,
            week2: responses.week2?.progress || null,
            week3: responses.week3?.progress || null,
            week4: responses.week4?.progress || null
        };
    });

    displayProgressStats(sessionFilter, participantData);
    displayProgressByParticipant(participantData);
};

function displayProgressStats(sessionId, participantData) {
    const statsDiv = document.getElementById('progressStats');

    const totalParticipants = participantData.length;
    const week1Responses = participantData.filter(p => p.week1).length;
    const week2Responses = participantData.filter(p => p.week2).length;
    const week3Responses = participantData.filter(p => p.week3).length;
    const week4Responses = participantData.filter(p => p.week4).length;
    const allWeeksComplete = participantData.filter(p => p.week1 && p.week2 && p.week3 && p.week4).length;

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
            <div class="stat-value">${week2Responses}</div>
            <div class="stat-label">Week 2 Responses</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${week3Responses}</div>
            <div class="stat-label">Week 3 Responses</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${week4Responses}</div>
            <div class="stat-label">Week 4 Responses</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${allWeeksComplete}</div>
            <div class="stat-label">All Weeks Complete</div>
        </div>
    `;
}

function displayProgressByParticipant(participantData) {
    const listDiv = document.getElementById('progressResponseList');

    if (participantData.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>No participants in this session</h3>
            </div>
        `;
        return;
    }

    listDiv.innerHTML = participantData.map(participant => {
        const hasWeek1 = !!participant.week1;
        const hasWeek2 = !!participant.week2;
        const hasWeek3 = !!participant.week3;
        const hasWeek4 = !!participant.week4;
        const completedCount = [hasWeek1, hasWeek2, hasWeek3, hasWeek4].filter(Boolean).length;

        let statusBadge = '';
        if (completedCount === 4) {
            statusBadge = '<span class="status-badge complete">✓ Complete (4/4)</span>';
        } else if (completedCount > 0) {
            statusBadge = `<span class="status-badge partial">⚠ Partial (${completedCount}/4)</span>`;
        } else {
            statusBadge = '<span class="status-badge none">✗ No Response</span>';
        }

        const weekHTML = ['week1', 'week2', 'week3', 'week4'].map((week, index) => {
            const weekNum = index + 1;
            const weekData = participant[week];
            const hasData = !!weekData;

            return `
                <div class="week-box ${hasData ? 'has-data' : ''}">
                    <h4>Week ${weekNum} ${hasData ? '✓' : ''}</h4>
                    ${hasData ? `
                        <div class="question-item">
                            <div class="field-label">🐾 한 주 동안, 우리 반려견에게 어떤 변화가 있었나요?</div>
                            <div class="response-text-box">${weekData.dogReaction}</div>
                        </div>
                        ${weekData.guardianMemo ? `
                            <div class="question-item" style="margin-top: 15px;">
                                <div class="field-label">📝 한 주 동안, 내가 새롭게 알게 된 점은 무엇인가요?</div>
                                <div class="response-text-box">${weekData.guardianMemo}</div>
                            </div>
                        ` : ''}
                        <div class="response-timestamp">
                            ${new Date(weekData.timestamp).toLocaleString('ko-KR')}
                        </div>
                    ` : `
                        <div class="no-response">응답 없음</div>
                    `}
                </div>
            `;
        }).join('');

        return `
            <div class="response-item">
                <div class="response-header">
                    <div>
                        <span class="participant-id">${participant.participantId} - ${participant.petName}</span>
                        ${statusBadge}
                        <div class="participant-meta">
                            Access Code: ${participant.accessCode} | Last Access: ${new Date(participant.lastAccess).toLocaleString('ko-KR')}
                        </div>
                    </div>
                </div>

                <div class="grid-2col-tight" style="margin-top: 20px;">
                    ${weekHTML}
                </div>
            </div>
        `;
    }).join('');
}

window.exportProgressCSV = function() {
    const sessionFilter = document.getElementById('progressSessionFilter').value;
    if (!sessionFilter) {
        alert('세션을 먼저 선택하세요.');
        return;
    }

    const sessionParticipants = Object.entries(allData.participants)
        .filter(([id, data]) => data.sessionId === sessionFilter)
        .map(([id]) => id);

    let rows = [['Participant ID', 'Pet Name', 'Access Code', 'Week', 'Dog Reaction', 'Guardian Memo', 'Timestamp']];

    sessionParticipants.forEach(participantId => {
        const participant = allData.participants[participantId];
        const responses = allData.responses[participantId] || {};

        ['week1', 'week2', 'week3', 'week4'].forEach(week => {
            const weekData = responses[week]?.progress;
            if (weekData) {
                rows.push([
                    participantId,
                    participant.pet || '',
                    participant.accessCode,
                    week,
                    weekData.dogReaction || '',
                    weekData.guardianMemo || '',
                    weekData.timestamp
                ]);
            }
        });
    });

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const session = allData.sessions[sessionFilter];
    downloadFile(csv, `progress-survey-${session.name.replace(/\s+/g, '-')}.csv`, 'text/csv');
};

window.exportProgressJSON = function() {
    const sessionFilter = document.getElementById('progressSessionFilter').value;
    if (!sessionFilter) {
        alert('세션을 먼저 선택하세요.');
        return;
    }

    const sessionParticipants = Object.entries(allData.participants)
        .filter(([id, data]) => data.sessionId === sessionFilter)
        .map(([id]) => id);

    let exportData = {};
    sessionParticipants.forEach(participantId => {
        const participant = allData.participants[participantId];
        const responses = allData.responses[participantId];
        if (responses) {
            exportData[participantId] = {
                petName: participant.pet || '',
                accessCode: participant.accessCode,
                progressResponses: {
                    week1: responses.week1?.progress || null,
                    week2: responses.week2?.progress || null,
                    week3: responses.week3?.progress || null,
                    week4: responses.week4?.progress || null
                }
            };
        }
    });

    const json = JSON.stringify(exportData, null, 2);
    const session = allData.sessions[sessionFilter];
    downloadFile(json, `progress-survey-${session.name.replace(/\s+/g, '-')}.json`, 'application/json');
};

window.showParticipantDetail = function(participantId) {
    window.location.hash = `participants/detail/${participantId}`;
};

function renderParticipantDetail(participantId) {
    const participant = allData.participants[participantId];
    if (!participant) return;

    const responses = allData.responses[participantId] || {};
    const session = allData.sessions[participant.sessionId];
    const surveyTemplate = allData.surveys.sensory_survey_v1;

    // 뷰 전환
    document.getElementById('participantContent').style.display = 'none';
    document.getElementById('participantDetailView').style.display = 'block';
    document.getElementById('participantEmpty').style.display = 'none';

    // Sensory 응답 렌더링
    const hasSensoryWeek1 = !!responses.week1?.sensory;
    const hasSensoryWeek4 = !!responses.week4?.sensory;

    const sensoryWeek1HTML = hasSensoryWeek1
        ? renderWeekResponse('Week 1', responses.week1.sensory, surveyTemplate)
        : '<div class="no-response">Week 1 응답 없음</div>';

    const sensoryWeek4HTML = hasSensoryWeek4
        ? renderWeekResponse('Week 4', responses.week4.sensory, surveyTemplate)
        : '<div class="no-response">Week 4 응답 없음</div>';

    // Progress 응답 렌더링
    const progressHTML = ['week1', 'week2', 'week3', 'week4'].map((week, index) => {
        const weekNum = index + 1;
        const weekData = responses[week]?.progress;
        const hasData = !!weekData;

        return `
            <div class="week-box ${hasData ? 'has-data' : ''}">
                <h4>Week ${weekNum} ${hasData ? '✓' : ''}</h4>
                ${hasData ? `
                    <div class="question-item">
                        <div class="field-label">🐾 한 주 동안, 우리 반려견에게 어떤 변화가 있었나요?</div>
                        <div class="response-text-box">${weekData.dogReaction}</div>
                    </div>
                    ${weekData.guardianMemo ? `
                        <div class="question-item" style="margin-top: 15px;">
                            <div class="field-label">📝 한 주 동안, 내가 새롭게 알게 된 점은 무엇인가요?</div>
                            <div class="response-text-box">${weekData.guardianMemo}</div>
                        </div>
                    ` : ''}
                    <div class="response-timestamp">
                        ${new Date(weekData.timestamp).toLocaleString('ko-KR')}
                    </div>
                ` : `
                    <div class="no-response">응답 없음</div>
                `}
            </div>
        `;
    }).join('');

    document.getElementById('participantDetailView').innerHTML = `
        <div class="detail-header">
            <button class="btn btn-secondary btn-back" onclick="backToParticipantList()">← 목록으로</button>
            <button class="btn-export-pdf" onclick="exportParticipantPDF('${participantId}')">📥 Export PDF</button>
        </div>

        <div id="participant-pdf-content">
            <div class="participant-info-card">
                <h2>${participantId} - ${participant.pet}</h2>
                <div class="info-grid">
                    <div><strong>Access Code:</strong> ${participant.accessCode}</div>
                    <div><strong>Session:</strong> ${session ? session.name : participant.sessionId}</div>
                    <div><strong>Last Access:</strong> ${new Date(participant.lastAccess).toLocaleString('ko-KR')}</div>
                    <div><strong>Created:</strong> ${participant.createdAt}</div>
                </div>
            </div>

            <h3 class="section-header">💆 Sensory Survey</h3>
            <div class="grid-2col">
                <div class="week-box ${hasSensoryWeek1 ? 'has-data' : ''}">
                    <h4>Week 1 ${hasSensoryWeek1 ? '✓' : ''}</h4>
                    ${sensoryWeek1HTML}
                </div>
                <div class="week-box ${hasSensoryWeek4 ? 'has-data' : ''}">
                    <h4>Week 4 ${hasSensoryWeek4 ? '✓' : ''}</h4>
                    ${sensoryWeek4HTML}
                </div>
            </div>

            <h3 class="section-header">📈 Progress Survey</h3>
            <div class="grid-2col-tight">
                ${progressHTML}
            </div>
        </div>
    `;
};

window.backToParticipantList = function() {
    window.location.hash = 'participants';
};

window.exportParticipantPDF = function(participantId) {
    const participant = allData.participants[participantId];
    const content = document.getElementById('participant-pdf-content');

    // 새 창 열기
    const printWindow = window.open('', '', 'width=800,height=600');

    // HTML 구조 작성
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${participantId}_${participant.pet}_report</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }

                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
                    padding: 15px;
                    background: white;
                    font-size: 11px;
                    line-height: 1.4;
                }

                h2 {
                    font-size: 16px;
                    margin-bottom: 10px;
                    color: #667eea !important;
                }

                h3 {
                    font-size: 14px;
                    margin: 15px 0 10px 0;
                    color: #667eea !important;
                }

                h4 {
                    font-size: 12px;
                    margin-bottom: 8px;
                    color: #667eea !important;
                    text-align: center;
                }

                .participant-info-card {
                    background: white !important;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
                    margin-bottom: 15px;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 10px;
                    font-size: 10px;
                }

                .info-grid strong {
                    color: #555 !important;
                }

                .grid-2col {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 20px;
                }

                .grid-2col-tight {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }

                .week-box {
                    border: 2px solid #e0e0e0 !important;
                    border-radius: 8px;
                    padding: 10px;
                    background: #fafafa !important;
                }

                .week-box.has-data {
                    border-color: #28a745 !important;
                    background: #f8fff9 !important;
                }

                .question-item {
                    background: #f8f9fa !important;
                    padding: 8px;
                    margin-bottom: 6px;
                    border-radius: 6px;
                }

                .field-label {
                    font-weight: 600;
                    color: #333 !important;
                    margin-bottom: 6px;
                    font-size: 10px;
                }

                .response-text-box {
                    background: white !important;
                    padding: 8px;
                    border-radius: 6px;
                    border: 1px solid #e0e0e0 !important;
                    white-space: pre-wrap;
                    font-size: 10px;
                }

                .no-response {
                    padding: 15px;
                    text-align: center;
                    color: #999 !important;
                    font-size: 10px;
                }

                .response-timestamp {
                    font-size: 9px;
                    color: #999 !important;
                    margin-top: 8px;
                    text-align: right;
                }

                .category-section {
                    margin-bottom: 12px;
                }

                .category-title {
                    background: #f0f0f0 !important;
                    padding: 6px;
                    border-radius: 6px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 11px;
                }

                .admin-sensitivity {
                    padding: 3px 8px;
                    border-radius: 10px;
                    font-size: 10px;
                    font-weight: 600;
                    display: inline-block;
                }

                .admin-sensitivity.low {
                    background: #d4edda !important;
                    color: #155724 !important;
                }

                .admin-sensitivity.medium {
                    background: #fff3cd !important;
                    color: #856404 !important;
                }

                .admin-sensitivity.high {
                    background: #f8d7da !important;
                    color: #721c24 !important;
                }

                .admin-sensitivity.na {
                    background: #e9ecef !important;
                    color: #495057 !important;
                }

                .question-text {
                    font-size: 10px;
                    color: #666 !important;
                    margin-bottom: 4px;
                }

                .answer-value {
                    font-weight: 600;
                    font-size: 10px;
                }

                .answer-note {
                    font-size: 9px;
                    color: #888 !important;
                    font-style: italic;
                    margin-left: 10px;
                }

                @page {
                    size: auto;
                    margin: 0;
                }

                @media print {
                    html, body {
                        height: auto;
                        overflow: visible;
                    }

                    body {
                        padding: 10px;
                    }

                    /* 페이지 나누기 완전히 방지 */
                    * {
                        page-break-before: avoid !important;
                        page-break-after: avoid !important;
                        page-break-inside: avoid !important;
                    }

                    /* 머릿글, 바닥글 숨기기 */
                    @page {
                        margin: 0;
                    }
                }
            </style>
        </head>
        <body>
            ${content.innerHTML}
        </body>
        </html>
    `);

    printWindow.document.close();

    // CSS 로드 대기 후 인쇄
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };
};

window.switchTab = function(tab) {
    window.location.hash = tab;
};

function activateTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // 탭 버튼 활성화
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(tab)) {
            btn.classList.add('active');
        }
    });

    document.getElementById(tab + 'Tab').classList.add('active');
}

// URL Hash 기반 라우팅
function handleHashChange() {
    const hash = window.location.hash.substring(1) || 'participants';
    const parts = hash.split('/');
    const mainRoute = parts[0];

    // 탭 활성화
    if (['participants', 'sensory', 'progress'].includes(mainRoute)) {
        activateTab(mainRoute);
    }

    // Participants 상세 라우팅
    if (mainRoute === 'participants' && parts[1] === 'detail' && parts[2]) {
        renderParticipantDetail(parts[2]);
    } else if (mainRoute === 'participants') {
        // 목록 화면으로 복귀
        const participantContent = document.getElementById('participantContent');
        const participantDetailView = document.getElementById('participantDetailView');
        const participantEmpty = document.getElementById('participantEmpty');

        participantDetailView.style.display = 'none';

        // 이전에 로드된 데이터가 있는지 확인
        const hasLoadedData = participantContent && participantContent.querySelector('#participantList').children.length > 0;

        if (hasLoadedData) {
            participantContent.style.display = 'block';
            participantEmpty.style.display = 'none';
        } else {
            participantContent.style.display = 'none';
            participantEmpty.style.display = 'block';
        }
    }
}

// Hash 변경 이벤트 리스너
window.addEventListener('hashchange', handleHashChange);

// 페이지 로드 시 초기 hash 처리
window.addEventListener('load', () => {
    if (!window.location.hash) {
        window.location.hash = 'participants';
    } else {
        handleHashChange();
    }
});

// Enter 키로 로그인
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            adminLogin();
        }
    });
});
