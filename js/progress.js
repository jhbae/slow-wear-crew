// progress.html - 주차별 변화기록 JavaScript

// 전역 변수
let currentUser = null;
let sessionData = null;
let surveyTemplate = null;
let responsesData = {};

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', async () => {
    // 로그인 체크
    const savedUser = sessionStorage.getItem('currentUser');
    const savedSessionId = sessionStorage.getItem('currentSessionId');

    if (!savedUser || !savedSessionId) {
        alert('로그인이 필요합니다.');
        window.location.href = 'index.html';
        return;
    }

    // 전역 변수에 저장
    currentUser = {
        participantId: savedUser,
        sessionId: savedSessionId,
        accessCode: sessionStorage.getItem('accessCode'),
        pet: sessionStorage.getItem('petName') || '반려견'
    };

    try {
        await loadData();
        renderDashboard();
    } catch (error) {
        console.error('❌ 데이터 로드 실패:', error);
        console.error('상세 정보:', {
            participantId: currentUser.participantId,
            sessionId: currentUser.sessionId,
            error: error.message
        });
        alert('문제가 발생했습니다.\n관리자에게 문의해주세요.\n\n(개발자: 콘솔을 확인하세요)');
    }
});

// 데이터 로드
async function loadData() {
    const db = firebase.database();

    // 세션 정보 로드
    const sessionSnapshot = await db.ref(`sessions/${currentUser.sessionId}`).once('value');
    sessionData = sessionSnapshot.val();

    if (!sessionData) {
        console.error('❌ 세션 정보 없음:', {
            sessionId: currentUser.sessionId,
            path: `sessions/${currentUser.sessionId}`
        });
        throw new Error(`세션 정보를 찾을 수 없습니다. (sessionId: ${currentUser.sessionId})`);
    }

    // 설문 템플릿 로드
    const templateId = sessionData.wearingProgressSurveyTemplateId || 'progress_survey_v1';
    const surveySnapshot = await db.ref(`surveys/${templateId}`).once('value');
    surveyTemplate = surveySnapshot.val();

    if (!surveyTemplate) {
        console.error('❌ 설문 템플릿 없음:', {
            templateId,
            path: `surveys/${templateId}`
        });
        throw new Error(`설문 템플릿을 찾을 수 없습니다. (templateId: ${templateId})`);
    }

    console.log('✅ 데이터 로드 성공:', {
        sessionId: currentUser.sessionId,
        sessionName: sessionData.name,
        templateId,
        hasMissions: !!surveyTemplate.missions,
        missionCount: surveyTemplate.missions ? surveyTemplate.missions.length : 0
    });

    // 기존 응답 로드
    const responsesSnapshot = await db.ref(`responses/${currentUser.participantId}`).once('value');
    const allResponses = responsesSnapshot.val() || {};

    // progress 응답만 추출
    ['week1', 'week2', 'week3', 'week4'].forEach(week => {
        if (allResponses[week] && allResponses[week].progress) {
            responsesData[week] = allResponses[week].progress;
        }
    });
}

// 대시보드 렌더링
function renderDashboard() {
    // 세션 정보 표시
    const sessionInfoEl = document.getElementById('sessionInfo');
    sessionInfoEl.innerHTML = `
        <h3>🐕 ${currentUser.pet || '반려견'} 친구</h3>
        <p>${sessionData.name} (${sessionData.startDate} ~ ${sessionData.endDate})</p>
    `;

    // 미션 리스트 렌더링
    const missionListEl = document.getElementById('missionList');
    const weeks = ['week1', 'week2', 'week3', 'week4'];

    if (!surveyTemplate.missions || surveyTemplate.missions.length === 0) {
        missionListEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <h3>미션이 아직 준비되지 않았습니다</h3>
                <p>관리자가 주차별 미션을 설정하면 여기에 표시됩니다.</p>
            </div>
        `;
        return;
    }

    // 미션 정렬 및 매핑
    const sortedMissions = surveyTemplate.missions
        .map((mission, index) => ({
            ...mission,
            // week 필드가 있으면 사용, 없으면 index 기반 (1-based)
            week: mission.week || (index + 1),
            originalIndex: index
        }))
        .sort((a, b) => a.week - b.week); // week 순서대로 정렬

    missionListEl.innerHTML = sortedMissions.map((mission) => {
        const week = `week${mission.week}`;
        const response = responsesData[week];
        const isCompleted = !!response;

        return `
            <div class="mission-card ${isCompleted ? 'completed view-mode' : ''}" data-week="${week}">
                <div class="mission-header">
                    <div class="mission-week">${mission.week}주차 미션</div>
                    <div class="mission-status ${isCompleted ? 'completed' : 'incomplete'}">
                        ${isCompleted ? '✓ 완료' : '⚠ 미완료'}
                    </div>
                </div>

                <div class="mission-content">
                    <div class="mission-title">
                        ${mission.title || '미션이 없습니다'}
                    </div>

                    <div class="input-section">
                        <label>🐾 반려견의 반응</label>
                        <textarea
                            id="${week}-dogReaction"
                            placeholder="반려견이 어떻게 반응했나요? 자유롭게 기록해주세요."
                            ${isCompleted ? 'disabled' : ''}
                        >${response ? response.dogReaction : ''}</textarea>
                    </div>

                    <div class="input-section">
                        <label>📝 보호자 메모</label>
                        <textarea
                            id="${week}-guardianMemo"
                            placeholder="추가로 기록하고 싶은 내용을 작성해주세요."
                            ${isCompleted ? 'disabled' : ''}
                        >${response ? response.guardianMemo : ''}</textarea>
                    </div>

                    ${isCompleted ? `
                        <div class="mission-timestamp">
                            작성일시: ${new Date(response.timestamp).toLocaleString('ko-KR')}
                        </div>
                    ` : `
                        <div class="mission-actions">
                            <button class="btn-save" onclick="saveMission('${week}')">
                                💾 저장하기
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// 미션 저장
async function saveMission(week) {
    const dogReactionEl = document.getElementById(`${week}-dogReaction`);
    const guardianMemoEl = document.getElementById(`${week}-guardianMemo`);

    const dogReaction = dogReactionEl.value.trim();
    const guardianMemo = guardianMemoEl.value.trim();

    if (!dogReaction) {
        alert('반려견의 반응을 입력해주세요.');
        dogReactionEl.focus();
        return;
    }

    const confirmSave = confirm(`${week.replace('week', '')}주차 미션을 저장하시겠습니까?\n저장 후에는 수정할 수 없습니다.`);
    if (!confirmSave) return;

    try {
        const db = firebase.database();
        const responseData = {
            dogReaction,
            guardianMemo,
            timestamp: new Date().toISOString()
        };

        await db.ref(`responses/${currentUser.participantId}/${week}/progress`).set(responseData);

        // 로컬 데이터 업데이트
        responsesData[week] = responseData;

        console.log('✅ 저장 성공:', {
            participantId: currentUser.participantId,
            week,
            timestamp: responseData.timestamp
        });

        alert('저장되었습니다! 🎉');

        // 화면 다시 렌더링
        renderDashboard();
    } catch (error) {
        console.error('❌ 저장 실패:', error);
        console.error('상세 정보:', {
            participantId: currentUser.participantId,
            week,
            path: `responses/${currentUser.participantId}/${week}/progress`
        });
        alert('저장 중 문제가 발생했습니다.\n관리자에게 문의해주세요.\n\n(개발자: 콘솔을 확인하세요)');
    }
}

// 로그아웃
function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        sessionStorage.removeItem('userInfo');
        window.location.href = 'index.html';
    }
}
