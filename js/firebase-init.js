// Firebase 공통 설정
const firebaseConfig = {
    apiKey: "AIzaSyCIjXYco5ydEsXcap0kq2hvRstNT4vjorY",
    authDomain: "slow-wear-crew.firebaseapp.com",
    projectId: "slow-wear-crew",
    storageBucket: "slow-wear-crew.firebasestorage.app",
    messagingSenderId: "281669334869",
    databaseURL: "https://slow-wear-crew-default-rtdb.asia-southeast1.firebasedatabase.app",
    appId: "1:281669334869:web:e8ebacf777c25127a5e1dc",
    measurementId: "G-ZSQMNN9WSH"
};

let app, database;

try {
    app = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
} catch (error) {
    console.log("Firebase 설정이 필요합니다:", error);
}
