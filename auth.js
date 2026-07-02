/**
 * TripFlow 認証システム
 * Firebase Authentication を使用したログイン・新規登録処理
 */

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

let currentUser = null;
let authMode = 'login'; // 'login' or 'signup'

/**
 * 認証状態の監視・初期化
 */
export function initializeAuth() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      console.log('✅ ユーザーログイン:', user.displayName);
      await loadUserProfile(user.uid);
      updateUIForLoggedInUser(user);
      showToast(`おかえりなさい、${user.displayName || 'ユーザー'}さん！`, 'success');
    } else {
      console.log('❌ ログアウト状態');
      updateUIForLoggedOutUser();
    }
  });
}

/**
 * ログインフォーム送信処理
 */
export async function handleAuthSubmit(event) {
  event.preventDefault();
  
  const emailOrUser = document.getElementById('authEmailOrUser').value.trim();
  const password = document.getElementById('authPassword').value;
  const submitBtn = document.getElementById('btnAuthSubmit');
  
  // バリデーション
  if (!emailOrUser || !password) {
    showToast('ID とパスワードを入力してください', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('パスワードは6文字以上である必要があります', 'error');
    return;
  }

  // ボタンを無効化
  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>処理中...';

  try {
    if (authMode === 'login') {
      // ログイン処理
      // メールアドレスまたはユーザーIDの統一化
      const email = emailOrUser.includes('@') ? emailOrUser : `${emailOrUser}@tripflow.local`;
      await signInWithEmailAndPassword(auth, email, password);
      showToast('ログインしました！', 'success');
    } else {
      // サインアップ処理
      const displayName = document.getElementById('authDisplayName').value.trim();
      if (!displayName) {
        showToast('お名前を入力してください', 'error');
        return;
      }

      // メールアドレスまたはユーザーIDでサインアップ
      // Firebase Authではメールアドレスが必須なので、簡易的に処理
      const email = emailOrUser.includes('@') ? emailOrUser : `${emailOrUser}@tripflow.local`;
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // プロフィール設定
      await updateProfile(userCredential.user, {
        displayName: displayName
      });

      // Firestore にユーザー情報を保存
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        displayName: displayName,
        email: email,
        userId: emailOrUser,
        createdAt: serverTimestamp(),
        avatarColor: 'indigo',
        tripStyle: 'all',
        defaultTransport: 'train'
      });

      showToast('アカウントを作成しました！', 'success');
    }

    // モーダルを閉じる
    closeAuthModal();

  } catch (error) {
    console.error('認証エラー:', error);
    
    // Firebase エラーコードから日本語メッセージに変換
    const errorMsg = getJapaneseErrorMessage(error.code);
    showToast(errorMsg, 'error');

  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

/**
 * Firebase エラーコードを日本語に変換
 */
function getJapaneseErrorMessage(errorCode) {
  const errorMap = {
    'auth/user-not-found': 'ユーザーが見つかりません。',
    'auth/wrong-password': 'パスワードが間違っています。',
    'auth/email-already-in-use': 'このメールアドレスは既に登録されています。',
    'auth/invalid-email': 'メールアドレスの形式が正しくありません。',
    'auth/weak-password': 'より強力なパスワードを設定してください。',
    'auth/operation-not-allowed': 'この操作は許可されていません。',
    'auth/user-disabled': 'このアカウントは無効です。',
    'auth/too-many-requests': 'ログイン試行が多すぎます。しばらく待ってからもう一度お試しください。',
    'auth/invalid-credential': '入力内容が正しくありません。'
  };

  return errorMap[errorCode] || `認証に失敗しました: ${errorCode}`;
}

/**
 * ログアウト処理
 */
export async function handleSignOut() {
  try {
    await signOut(auth);
    showToast('ログアウトしました', 'success');
    goHome();
  } catch (error) {
    console.error('ログアウトエラー:', error);
    showToast('ログアウトに失敗しました', 'error');
  }
}

/**
 * ログイン/サインアップモード切り替え
 */
export function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  
  const titleEl = document.getElementById('authFormTitle');
  const descEl = document.getElementById('authFormDesc');
  const displayNameField = document.getElementById('authDisplayNameField');
  const emailLabelEl = document.getElementById('authEmailLabel');
  const btnToggleEl = document.getElementById('btnToggleAuthMode');
  const submitBtnEl = document.getElementById('btnAuthSubmit');

  if (authMode === 'signup') {
    titleEl.textContent = 'アカウントを作成';
    descEl.textContent = 'TripFlowのアカウントを新規作成してください。';
    displayNameField.classList.remove('hidden');
    emailLabelEl.textContent = 'ID (メールアドレスまたはユーザーID)';
    submitBtnEl.querySelector('span').textContent = '登録する';
    btnToggleEl.textContent = 'ログイン画面に戻る';
  } else {
    titleEl.textContent = 'アカウントにサインイン';
    descEl.textContent = '旅程をクラウド保存・同期するために認証を行ってください。';
    displayNameField.classList.add('hidden');
    emailLabelEl.textContent = '独自ID';
    submitBtnEl.querySelector('span').textContent = 'ログインする';
    btnToggleEl.textContent = '新規アカウントを作成する（サインアップ）';
  }
}

/**
 * 認証モーダルを開く
 */
export function openAuthModal() {
  const modal = document.getElementById('authModal');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  document.body.style.overflow = 'hidden';
}

/**
 * 認証モーダルを閉じる
 */
export function closeAuthModal() {
  const modal = document.getElementById('authModal');
  modal.classList.add('opacity-0', 'pointer-events-none');
  document.body.style.overflow = '';
  
  // フォームをリセット
  document.getElementById('authForm').reset();
  authMode = 'login';
}

/**
 * UI更新：ログイン時
 */
function updateUIForLoggedInUser(user) {
  const userInfoArea = document.getElementById('userInfoArea');
  const guestHeaderArea = document.getElementById('guestHeaderArea');
  const userName = document.getElementById('userName');
  const drawerAvatar = document.getElementById('drawerAvatar');
  const drawerUserName = document.getElementById('drawerUserName');
  const drawerUserMail = document.getElementById('drawerUserMail');
  const drawerAuthBtn = document.getElementById('drawerAuthBtn');

  if (userInfoArea) userInfoArea.classList.remove('hidden');
  if (guestHeaderArea) guestHeaderArea.classList.add('hidden');
  
  const displayName = user.displayName || 'ユーザー';
  if (userName) userName.textContent = displayName;
  
  if (drawerAvatar) drawerAvatar.textContent = displayName.charAt(0).toUpperCase();
  if (drawerUserName) drawerUserName.textContent = displayName;
  if (drawerUserMail) drawerUserMail.textContent = user.email;
  if (drawerAuthBtn) {
    drawerAuthBtn.textContent = 'ログアウト';
    drawerAuthBtn.onclick = handleSignOut;
  }
}

/**
 * UI更新：ログアウト時
 */
function updateUIForLoggedOutUser() {
  const userInfoArea = document.getElementById('userInfoArea');
  const guestHeaderArea = document.getElementById('guestHeaderArea');
  const drawerAvatar = document.getElementById('drawerAvatar');
  const drawerUserName = document.getElementById('drawerUserName');
  const drawerUserMail = document.getElementById('drawerUserMail');
  const drawerAuthBtn = document.getElementById('drawerAuthBtn');

  if (userInfoArea) userInfoArea.classList.add('hidden');
  if (guestHeaderArea) guestHeaderArea.classList.remove('hidden');
  
  if (drawerAvatar) drawerAvatar.textContent = 'G';
  if (drawerUserName) drawerUserName.textContent = 'ゲストユーザー';
  if (drawerUserMail) drawerUserMail.textContent = 'ログインしていません';
  if (drawerAuthBtn) {
    drawerAuthBtn.textContent = 'ログイン';
    drawerAuthBtn.onclick = openAuthModal;
  }
}

/**
 * ユーザープロフィール読み込み
 */
async function loadUserProfile(uid) {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      console.log('✅ ユーザープロフィール読み込み:', userData);
      return userData;
    } else {
      console.log('⚠️ ユーザープロフィールが見つかりません');
    }
  } catch (error) {
    console.error('プロフィール読み込みエラー:', error);
  }
}

/**
 * トースト通知表示
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  const bgColor = type === 'error' ? 'bg-red-500' : 
                  type === 'success' ? 'bg-green-500' : 'bg-blue-500';
  const icon = type === 'error' ? 'fa-circle-xmark' : 
               type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
  
  toast.className = `${bgColor} text-white px-4 py-3 rounded-lg text-sm font-semibold shadow-lg flex items-center gap-2 animate-pulse`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * ドロワーメニューの認証ボタン動作
 */
export async function handleDrawerAuthAction() {
  if (currentUser) {
    await handleSignOut();
  } else {
    openAuthModal();
  }
}

/**
 * 現在のユーザー取得
 */
export function getCurrentUser() {
  return currentUser;
}
