// 공통 유틸리티 함수 (일반 script 전용)

/**
 * 민감도 레벨 계산
 * @param {number} score - 총점
 * @param {object} scoreRange - 점수 범위 객체 { low: [min, max], medium: [min, max], high: [min, max] }
 * @returns {object} { level: 'low'|'medium'|'high'|'na', text: '낮음'|'보통'|'높음'|'N/A'|'범위 오류' }
 */
function calculateSensitivity(score, scoreRange) {
    // scoreRange 데이터가 없을 경우 기본값 반환
    if (!scoreRange) {
        return { level: 'medium', text: 'N/A' };
    }

    if (score >= scoreRange.low[0] && score <= scoreRange.low[1]) {
        return { level: 'low', text: '낮음' };
    }

    if (score >= scoreRange.medium[0] && score <= scoreRange.medium[1]) {
        return { level: 'medium', text: '보통' };
    }

    if (score >= scoreRange.high[0] && score <= scoreRange.high[1]) {
        return { level: 'high', text: '높음' };
    }

    // 범위를 벗어난 경우
    return { level: 'na', text: '범위 오류' };
}

// 브라우저 전역 변수로 노출 (중요!)
window.calculateSensitivity = calculateSensitivity;
