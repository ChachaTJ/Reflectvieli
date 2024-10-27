// background.js
import CONFIG from './config.js';

chrome.runtime.onInstalled.addListener(async () => {
  // 사이드패널 자동 열림 설정
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  
  // 로컬 스토리지 초기화
  await chrome.storage.local.set({ 
    [CONFIG.STORAGE_KEYS.feedbackHistory]: [] 
  });
});

// 오프라인 피드백 동기화 처리
let syncInterval = null;

chrome.runtime.onStartup.addListener(() => {
  startSyncInterval();
});

function startSyncInterval() {
  if (syncInterval) return;
  
  syncInterval = setInterval(async () => {
    try {
      if (!navigator.onLine) return;
      
      const { feedbackHistory } = await chrome.storage.local.get(
        CONFIG.STORAGE_KEYS.feedbackHistory
      );
      
      const pendingFeedback = feedbackHistory.filter(f => f.pending);
      if (pendingFeedback.length === 0) return;
      
      for (const feedback of pendingFeedback) {
        try {
          await sendFeedbackToServer(feedback);
          
          // 성공적으로 전송된 피드백 제거
          const updatedHistory = feedbackHistory.filter(f => f !== feedback);
          await chrome.storage.local.set({ 
            [CONFIG.STORAGE_KEYS.feedbackHistory]: updatedHistory 
          });
        } catch (error) {
          console.error('Failed to sync feedback:', error);
        }
      }
    } catch (error) {
      console.error('Sync interval error:', error);
    }
  }, CONFIG.FEEDBACK_SYNC_INTERVAL);
}

async function sendFeedbackToServer(feedback) {
  const response = await fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.feedback}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(feedback)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// 확장프로그램 종료 시 인터벌 정리
chrome.runtime.onSuspend.addListener(() => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
});