/**
 * firebase-config.js — Firebase 설정 파일
 *
 * 사용 방법:
 * 1. https://console.firebase.google.com 에서 프로젝트 생성
 * 2. 프로젝트 설정(⚙️) > 일반 > 내 앱 > 웹앱 추가
 * 3. SDK 설정에서 firebaseConfig 값을 아래에 붙여넣기
 * 4. index.html 상단의 Firebase 스크립트 주석 해제
 *
 * Firestore 보안 규칙 (Firebase 콘솔 > Firestore > 규칙):
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /stats/{docId} {
 *         allow read, write: if true;  // 공개 통계
 *       }
 *     }
 *   }
 */

const firebaseConfig = {
  apiKey: "AIzaSyAH_bNENaHGjS4jiBj2ZU1hJYbNWVxe32w",
  authDomain: "password-checker-ff7e1.firebaseapp.com",
  projectId: "password-checker-ff7e1",
  storageBucket: "password-checker-ff7e1.firebasestorage.app",
  messagingSenderId: "613393686776",
  appId: "1:613393686776:web:12e98ee48062872c90db0d"
};

firebase.initializeApp(firebaseConfig);
