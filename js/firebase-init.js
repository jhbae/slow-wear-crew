// [신규 공통 파일]
// Firebase v10 모듈식 SDK 임포트
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// 설정 객체
const firebaseConfig = {
    apiKey: "AIzaSyCIjXYco5ydEsXcap0kq2hvRstNT4vjorY",
    authDomain: "slow-wear-crew.firebaseapp.com",
    databaseURL: "https://slow-wear-crew-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "slow-wear-crew",
    storageBucket: "slow-wear-crew.firebasestorage.app",
    messagingSenderId: "281669334869",
    appId: "1:281669334869:web:e8ebacf777c25127a5e1dc"
};

// 앱 초기화
const app = initializeApp(firebaseConfig);

// 초기화된 서비스들을 export
export const db = getDatabase(app);
export const auth = getAuth(app);
