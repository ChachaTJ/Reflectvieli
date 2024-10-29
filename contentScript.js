// contentScript.js
(function() {
  if (window.hasOwnProperty('engageliContentScriptLoaded')) {
    return;
  }
  window.engageliContentScriptLoaded = true;

  // 스타일 추가
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .engageli-popup {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 300px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 9999;
        padding: 16px;
        display: none;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .engageli-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .engageli-popup-title {
        font-size: 14px;
        font-weight: 600;
        color: #1F2937;
      }

      .engageli-popup-close {
        background: none;
        border: none;
        color: #6B7280;
        cursor: pointer;
        padding: 4px;
        font-size: 18px;
      }

      .engageli-emoji-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 12px;
      }

      .engageli-emoji-button {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        background: #F8F9FA;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .engageli-emoji-button:hover {
        border-color: #0066FF;
        background: rgba(0, 102, 255, 0.05);
      }

      .engageli-emoji-button.active {
        background: rgba(0, 102, 255, 0.1);
        border-color: #0066FF;
      }

      .engageli-emoji-button span {
        margin-left: 8px;
        font-size: 14px;
        color: #6B7280;
      }

      .engageli-input {
        width: 100%;
        padding: 8px 12px;
        background: #F8F9FA;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
        min-height: 60px;
        margin-bottom: 12px;
      }

      .engageli-input:focus {
        outline: none;
        border-color: #0066FF;
        box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.1);
      }

      .engageli-send-button {
        width: 100%;
        padding: 8px 16px;
        background: #0066FF;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }

      .engageli-send-button:hover {
        background: #0052CC;
      }
    `;
    document.head.appendChild(style);
  }

  function createPopup() {
    const popup = document.createElement('div');
    popup.className = 'engageli-popup';
    popup.innerHTML = `
      <div class="engageli-popup-header">
        <div class="engageli-popup-title">피드백 보내기</div>
        <button class="engageli-popup-close" aria-label="닫기">✕</button>
      </div>
      <div class="engageli-emoji-grid">
        <button class="engageli-emoji-button" data-mood="understand">
          😊 <span>Understood</span>
        </button>
        <button class="engageli-emoji-button" data-mood="question">
          ❓ <span>Question</span>
        </button>
        <button class="engageli-emoji-button" data-mood="confused">
          😐 <span>Confused</span>
        </button>
        <button class="engageli-emoji-button" data-mood="repeat">
          🔄 <span>Repeat</span>
        </button>
      </div>
      <textarea
        class="engageli-input"
        placeholder="추가 피드백이 있다면 입력해주세요 (선택사항)"
        maxlength="500"
      ></textarea>
      <button class="engageli-send-button">피드백 보내기</button>
    `;

    document.body.appendChild(popup);
    
    // 이벤트 리스너 추가
    const closeBtn = popup.querySelector('.engageli-popup-close');
    closeBtn.addEventListener('click', () => {
      popup.style.display = 'none';
    });

    // 이모지 버튼 이벤트
    const emojiButtons = popup.querySelectorAll('.engageli-emoji-button');
    let selectedEmoji = null;

    emojiButtons.forEach(button => {
      button.addEventListener('click', () => {
        emojiButtons.forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        selectedEmoji = button.dataset.mood;
      });
    });

    // 전송 버튼 이벤트
    const sendButton = popup.querySelector('.engageli-send-button');
    const textarea = popup.querySelector('.engageli-input');

    sendButton.addEventListener('click', async () => {
      if (!selectedEmoji) {
        alert('이모지를 선택해주세요.');
        return;
      }

      const feedback = {
        type: selectedEmoji,
        text: textarea.value.trim(),
        timestamp: new Date().toISOString(),
        emoji: getEmojiForType(selectedEmoji),
        pending: true
      };

      // Background Script로 메시지 전송
      chrome.runtime.sendMessage({ 
        type: 'sendFeedback', 
        feedback 
      }, (response) => {
        if (response?.success) {
          console.log('Feedback sent and saved successfully.');
          
          // UI 초기화 및 팝업 닫기
          textarea.value = '';
          selectedEmoji = null;
          emojiButtons.forEach(b => b.classList.remove('active'));
          popup.style.display = 'none';
        }
      });

      if (selectedEmoji === 'confused' || selectedEmoji === 'repeat') {
        const reactionButton = document.querySelector('[data-testid="reaction-button"]');
        if (reactionButton) {
          reactionButton.click();
          setTimeout(() => {
            const heartButton = document.querySelector('[aria-label="Purple heart"]');
            if (heartButton) {
              heartButton.click();
            }
          }, 500);
        }
      }
    });

    // 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
      if (!popup.contains(e.target) && 
          !document.getElementById('engageli-understand-button').contains(e.target)) {
        popup.style.display = 'none';
      }
    });

    return popup;
  }

  function getEmojiForType(type) {
    const emojiMap = {
      understand: '😊',
      question: '❓',
      confused: '😐',
      repeat: '🔄'
    };
    return emojiMap[type] || '❔';
  }

  function createUnderstandButton() {
    const existingButton = document.getElementById('engageli-understand-button');
    if (existingButton) {
      existingButton.remove();
    }

    const chatButton = document.querySelector('#open-chat-button');
    if (!chatButton) return;

    const button = document.createElement('button');
    button.id = 'engageli-understand-button';
    button.className = chatButton.className;
    button.setAttribute('aria-label', 'Feedback');

    const boxDiv = document.createElement('div');
    boxDiv.className = 'MuiBox-root css-1tdgbex';

    const span = document.createElement('span');
    span.className = 'MuiBadge-root css-1rzb3uu';
    span.setAttribute('aria-hidden', 'true');

    const emoji = document.createElement('div');
    emoji.style.fontSize = '28px';
    emoji.textContent = '🤔';

    const text = document.createElement('p');
    text.className = 'MuiTypography-root MuiTypography-body2 jss618 css-1tllh4l';
    text.textContent = 'Feedback';

    span.appendChild(emoji);
    boxDiv.appendChild(span);
    boxDiv.appendChild(text);
    button.appendChild(boxDiv);

    // 클릭 이벤트
    let popup = document.querySelector('.engageli-popup');
    button.addEventListener('click', () => {
      if (!popup) {
        popup = createPopup();
      }
      popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
    });

    chatButton.parentNode.insertBefore(button, chatButton.nextSibling);
  }

  // 초기화 코드
  addStyles();
  createUnderstandButton();

  // MutationObserver 설정
  const observer = new MutationObserver((mutations) => {
    if (!document.getElementById('engageli-understand-button')) {
      createUnderstandButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();