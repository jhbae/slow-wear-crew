// progress.html - 주차별 변화기록 JavaScript

// 전역 변수
let currentUser = null;
let sessionData = null;
let surveyTemplate = null;
let responsesData = {};

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', async () => {
    // 로그인 체크
    const userInfo = sessionStorage.getItem('userInfo');
    if (!userInfo) {
        alert('로그인이 필요합니다.');
        window.location.href = 'index.html';
        return;
    }

    currentUser = JSON.parse(userInfo);

    try {
        await loadData();
        renderDashboard();
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다.');
    }
});

// 데이터 로드
async function loadData() {
    const db = firebase.database();

    // 세션 정보 로드
    const sessionSnapshot = await db.ref(`sessions/${currentUser.sessionId}`).once('value');
    sessionData = sessionSnapshot.val();

    if (!sessionData) {
        throw new Error('세션 정보를 찾을 수 없습니다.');
    }

    // 설문 템플릿 로드
    const templateId = sessionData.wearingProgressSurveyTemplateId || 'progress_survey_v1';
    const surveySnapshot = await db.ref(`surveys/${templateId}`).once('value');
    surveyTemplate = surveySnapshot.val();

    if (!surveyTemplate) {
        throw new Error('설문 템플릿을 찾을 수 없습니다.');
    }

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

    missionListEl.innerHTML = weeks.map((week, index) => {
        const weekNum = index + 1;
        const mission = surveyTemplate.missions[index]; // 각 주차별 미션
        const response = responsesData[week];
        const isCompleted = !!response;

        return `
            <div class="mission-card ${isCompleted ? 'completed view-mode' : ''}" data-week="${week}">
                <div class="mission-header">
                    <div class="mission-week">${weekNum}주차 미션</div>
                    <div class="mission-status ${isCompleted ? 'completed' : 'incomplete'}">
                        ${isCompleted ? '✓ 완료' : '⚠ 미완료'}
                    </div>
                </div>

                <div class="mission-content">
                    <div class="mission-title">
                        ${mission ? mission.title : '미션이 없습니다'}
                    </div>

                    <div class="input-section">
                        <label>🐾 반려견의 반응</label>
                        <textarea
                            id="${week}-reaction"
                            placeholder="반려견이 어떻게 반응했나요? 자유롭게 기록해주세요."
                            ${isCompleted ? 'disabled' : ''}
                        >${response ? response.reaction : ''}</textarea>
                    </div>

                    <div class="input-section">
                        <label>📝 기타 메모</label>
                        <textarea
                            id="${week}-memo"
                            placeholder="추가로 기록하고 싶은 내용을 작성해주세요."
                            ${isCompleted ? 'disabled' : ''}
                        >${response ? response.memo : ''}</textarea>
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
    const reactionEl = document.getElementById(`${week}-reaction`);
    const memoEl = document.getElementById(`${week}-memo`);

    const reaction = reactionEl.value.trim();
    const memo = memoEl.value.trim();

    if (!reaction) {
        alert('반려견의 반응을 입력해주세요.');
        reactionEl.focus();
        return;
    }

    const confirmSave = confirm(`${week.replace('week', '')}주차 미션을 저장하시겠습니까?\n저장 후에는 수정할 수 없습니다.`);
    if (!confirmSave) return;

    try {
        const db = firebase.database();
        const responseData = {
            reaction,
            memo,
            timestamp: new Date().toISOString()
        };

        await db.ref(`responses/${currentUser.participantId}/${week}/progress`).set(responseData);

        // 로컬 데이터 업데이트
        responsesData[week] = responseData;

        alert('저장되었습니다! 🎉');

        // 화면 다시 렌더링
        renderDashboard();
    } catch (error) {
        console.error('저장 실패:', error);
        alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}

// 로그아웃
function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        sessionStorage.removeItem('userInfo');
        window.location.href = 'index.html';
    }
}
