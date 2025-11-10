// [신규 공통 파일]

/**
 * 점수와 범위에 따라 민감도 레벨과 텍스트를 반환합니다.
 */
export function calculateSensitivity(score, scoreRange) {
    if (!scoreRange) {
        return { level: 'na', text: 'N/A' }; 
    }
    if (score >= scoreRange.low[0] && score <= scoreRange.low[1]) return { level: 'low', text: '낮음' };
    if (score >= scoreRange.medium[0] && score <= scoreRange.medium[1]) return { level: 'medium', text: '보통' };
    if (score >= scoreRange.high[0] && score <= scoreRange.high[1]) return { level: 'high', text: '높음' };
    
    // 모든 범위에 해당하지 않는 경우 (데이터 오류)
    return { level: 'na', text: '범위 오류' }; 
}

/**
 * 콘텐츠를 파일로 다운로드합니다.
 */
export function downloadFile(content, filename, mimeType) {
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
