// contentScript.js
(function() {
  // 이미 로드된 경우 중복 실행 방지
  if (window.hasOwnProperty('engageliContentScriptLoaded')) {
    return;
  }
  window.engageliContentScriptLoaded = true;

  // 디바운스 함수
  let reactionTimeout = null;
  
  // Engageli 반응 함수
  function sendEngageliReaction() {
    return new Promise(async (resolve) => {
      try {
        // 이전 타이머가 있다면 취소
        if (reactionTimeout) {
          clearTimeout(reactionTimeout);
        }

        // 새로운 타이머 설정
        reactionTimeout = setTimeout(async () => {
          // 1. 반응 버튼 찾기
          const reactionButton = document.querySelector('[data-testid="reaction-button"]');
          if (!reactionButton) {
            console.error("반응 버튼을 찾을 수 없습니다.");
            resolve(false);
            return;
          }
          
          // 2. 반응 버튼 클릭
          reactionButton.click();
          
          // 3. 하트 이모티콘 클릭
          setTimeout(() => {
            const heartButton = document.querySelector('[aria-label="Purple heart"]');
            if (heartButton) {
              heartButton.click();
              console.log("하트 반응 전송 완료");
              resolve(true);
            } else {
              console.error("하트 버튼을 찾을 수 없습니다.");
              resolve(false);
            }
          }, 500);
        }, 100); // 디바운스 대기 시간
      } catch (error) {
        console.error("Engageli 반응 전송 실패:", error);
        resolve(false);
      }
    });
  }

  // 메시지 리스너 (한 번만 등록)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Received message:", message);
    
    if (message.type === 'sendEngageliReaction') {
      sendEngageliReaction().then(success => {
        console.log("Reaction sent:", success);
        sendResponse({ success });
      });
      return true;  // 비동기 응답을 위해 true 반환
    }
  });

  console.log('Content script loaded (once)');
})();

// 피드백 전송 이벤트 리스너 수정
feedbackToolbar.querySelector('#send-feedback').addEventListener('click', async () => {
  const selectedEmoji = feedbackToolbar.querySelector('.emoji-button.active')?.dataset.mood;
  const feedbackText = feedbackToolbar.querySelector('.feedback-input').value.trim();

  if (!selectedEmoji) {
    alert('피드백 이모지를 선택해주세요.');
    return;
  }

  // confused나 repeat 상태일 때 Engageli 하트 반응 전송
  if (selectedEmoji === 'confused' || selectedEmoji === 'repeat') {
    await sendEngageliReaction();
  }

  // 피드백 메시지 전송 (기존 코드)
  chrome.runtime.sendMessage({
    type: 'sendFeedback',
    feedback: {
      type: selectedEmoji,
      emoji: CONFIG.EMOTIONS[selectedEmoji].emoji,
      text: feedbackText,
      timestamp: new Date().toISOString(),
      pending: !navigator.onLine
    }
  }, (response) => {
    if (response.status === 'success') {
      alert(response.message);
      feedbackToolbar.querySelector('.feedback-input').value = '';
      emojiButtons.forEach(b => b.classList.remove('active'));
    } else if (response.status === 'warning') {
      alert(response.message);
      feedbackToolbar.querySelector('.feedback-input').value = '';
      emojiButtons.forEach(b => b.classList.remove('active'));
    } else {
      alert(`오류: ${response.message}`);
    }
  });
});

(function() {
    // 기존에 삽입된 피드백 바가 있는지 확인
    if (document.getElementById('feedback-toolbar')) return;
  
    // 피드백 바 컨테이너 생성
    const toolbar = document.createElement('div');
    toolbar.id = 'feedback-toolbar';
    toolbar.style.position = 'fixed';
    toolbar.style.bottom = '0';
    toolbar.style.left = '0';
    toolbar.style.width = '100%';
    toolbar.style.backgroundColor = '#f1f1f1';
    toolbar.style.borderTop = '1px solid #ccc';
    toolbar.style.padding = '5px';
    toolbar.style.display = 'flex';
    toolbar.style.justifyContent = 'space-between';
    toolbar.style.alignItems = 'center';
    toolbar.style.zIndex = '10000'; // 페이지 콘텐츠 위에 표시
  
    // 이모지 버튼들
    const emojiContainer = document.createElement('div');
  
    const emojis = ['😊', '😐', '😢'];
    emojis.forEach(emoji => {
      const button = document.createElement('button');
      button.textContent = emoji;
      button.style.fontSize = '20px';
      button.style.marginRight = '5px';
      button.style.background = 'none';
      button.style.border = 'none';
      button.style.cursor = 'pointer';
      button.dataset.mood = emoji === '😊' ? 'happy' : (emoji === '😐' ? 'neutral' : 'sad');
      emojiContainer.appendChild(button);
    });
  
    // 피드백 입력창
    const feedbackInput = document.createElement('textarea');
    feedbackInput.id = 'feedback-input';
    feedbackInput.placeholder = '피드백을 입력하세요...';
    feedbackInput.style.flex = '1';
    feedbackInput.style.marginRight = '5px';
    feedbackInput.style.height = '30px';
    feedbackInput.style.resize = 'none';
  
    // 피드백 전송 버튼
    const sendButton = document.createElement('button');
    sendButton.id = 'send-feedback';
    sendButton.textContent = '보내기';
    sendButton.style.padding = '5px 10px';
    sendButton.style.cursor = 'pointer';
  
    // 피드백 바에 요소 추가
    toolbar.appendChild(emojiContainer);
    toolbar.appendChild(feedbackInput);
    toolbar.appendChild(sendButton);
  
    // 페이지에 피드백 바 삽입
    document.body.appendChild(toolbar);
  
    // 이벤트 리스너 추가
    sendButton.addEventListener('click', () => {
      const selectedEmoji = toolbar.querySelector('.emoji-button.active')?.dataset.mood;
      const feedbackText = feedbackInput.value.trim();
  
      if (!selectedEmoji) {
        alert('이모지를 선택해주세요.');
        return;
      }
  
      // 메시지 보내기 (백그라운드 또는 팝업과 통신)
      chrome.runtime.sendMessage({
        type: 'sendFeedback',
        feedback: {
          type: selectedEmoji,
          emoji: selectedEmoji === 'happy' ? '😊' : (selectedEmoji === 'neutral' ? '😐' : '😢'),
          text: feedbackText,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      });
  
      // 입력 초기화
      feedbackInput.value = '';
      toolbar.querySelectorAll('.emoji-button').forEach(b => b.classList.remove('active'));
    });
  
    // 이모지 버튼 클릭 이벤트
    toolbar.querySelectorAll('.emoji-button').forEach(button => {
      button.addEventListener('click', () => {
        toolbar.querySelectorAll('.emoji-button').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
      });
    });
  
  })();
  