// ── Hero typewriter rotation ─────────────────────────────
const rotateWords = ['Enterprise AI','NAS Storage','Photo Search','Document AI','Personal AI'];
let wordIndex = 0;
const typewriterEl = document.getElementById('hero-typewriter');

function typeNextWord() {
  if (!typewriterEl) return;
  const word = rotateWords[wordIndex];
  wordIndex = (wordIndex + 1) % rotateWords.length;
  
  // Delete current text
  let currentText = typewriterEl.textContent;
  const deleteInterval = setInterval(() => {
    currentText = currentText.slice(0, -1);
    typewriterEl.textContent = currentText;
    if (currentText.length === 0) {
      clearInterval(deleteInterval);
      // Type new word
      let charIdx = 0;
      const typeInterval = setInterval(() => {
        charIdx++;
        typewriterEl.textContent = word.slice(0, charIdx);
        if (charIdx >= word.length) {
          clearInterval(typeInterval);
          setTimeout(typeNextWord, 2800);
        }
      }, 80);
    }
  }, 40);
}

if (typewriterEl) setTimeout(typeNextWord, 3000);

// ── Chat typing simulation ──────────────────────────────
function triggerTypingReply(typingId, replyId, delay) {
  const typingEl = document.getElementById(typingId);
  const replyEl = document.getElementById(replyId);
  if (!typingEl || !replyEl) return;
  
  setTimeout(() => {
    typingEl.style.display = 'none';
    replyEl.style.display = 'block';
    replyEl.style.animation = 'fadeInUp 0.4s ease';
  }, delay);
}

// Trigger AI demos on load
setTimeout(() => triggerTypingReply('typing1', 'reply1', 2200), 1200);


// ── Demo Carousel ───────────────────────────────────────
const carouselTrack = document.getElementById('carouselTrack');
const carouselLabel = document.getElementById('carouselLabel');
const carouselDots = document.querySelectorAll('.demo-dot');
const progressBar = document.getElementById('carouselProgressBar');
const slideLabels = [
  '\u{1F916} Your Enterprise AI Assistant',
  '\u{1F4BE} Intelligent NAS Search',
  '\u{1F916} Your Personal AI Assistant',
  '\u{1F4BE} In-Place AI Analysis'
];
const SLIDE_DURATION = 8000;
let currentSlide = 0;
let carouselTimer = null;
let carouselPauseTimeout = null;
let nasSearchTriggered = false;
let nasAiTriggered = false;
let personalAiTriggered = false;

function resetProgressBar() {
  if (!progressBar) return;
  progressBar.classList.remove('running');
  progressBar.offsetHeight; // reflow
  progressBar.classList.add('running');
}

function goToSlide(index) {
  currentSlide = index;
  if (carouselTrack) carouselTrack.style.transform = 'translateX(-' + (index * 100) + '%)';
  
  // Update label with fade
  if (carouselLabel) {
    carouselLabel.style.opacity = '0';
    setTimeout(() => {
      carouselLabel.textContent = slideLabels[index];
      carouselLabel.style.opacity = '1';
    }, 200);
  }

  // Update dots
  carouselDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });

  // Reset progress bar
  resetProgressBar();

  // Trigger NAS animations on first visit
  if (index === 1 && !nasSearchTriggered) {
    nasSearchTriggered = true;
    runNasSearchDemo();
  }
  if (index === 2 && !personalAiTriggered) {
    personalAiTriggered = true;
    triggerTypingReply('typing2', 'reply2', 2800);
  }
  if (index === 3 && !nasAiTriggered) {
    nasAiTriggered = true;
    runNasAiDemo();
  }
}

function startCarousel() {
  stopCarousel();
  resetProgressBar();
  carouselTimer = setInterval(() => {
    goToSlide((currentSlide + 1) % 4);
  }, SLIDE_DURATION);
}

function stopCarousel() {
  if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
  if (progressBar) progressBar.classList.remove('running');
}

// Dot click — jump to slide + pause
carouselDots.forEach(dot => {
  dot.addEventListener('click', () => {
    goToSlide(parseInt(dot.dataset.slide));
    stopCarousel();
    resetProgressBar();
    if (carouselPauseTimeout) clearTimeout(carouselPauseTimeout);
    carouselPauseTimeout = setTimeout(() => startCarousel(), 20000);
  });
});

// Start auto-advance after AI typing completes (~5s)
setTimeout(() => startCarousel(), 5000);

// ── NAS Demo 1: Search + Photo Grid ─────────────────────
function runNasSearchDemo() {
  const searchText = 'beach photos from Goa trip';
  const typingEl = document.getElementById('nas-search-typing');
  const cursorEl = document.getElementById('nas-search-cursor');
  const sparkleEl = document.getElementById('nas-search-sparkle');
  const resultsEl = document.getElementById('nas-search-results');
  const labelEl = document.getElementById('nas-results-label');
  const metaEl = document.getElementById('nas-meta');

  if (!typingEl) return;

  let charIdx = 0;
  // Step 1: Type search text
  function typeChar() {
    if (charIdx < searchText.length) {
      charIdx++;
      typingEl.textContent = searchText.substring(0, charIdx);
      setTimeout(typeChar, 55 + Math.random() * 40);
    } else {
      // Step 2: Sparkle pulses
      if (cursorEl) cursorEl.style.display = 'none';
      if (sparkleEl) sparkleEl.classList.add('pulse');
      
      // Step 3: Show results area
      setTimeout(() => {
        if (sparkleEl) sparkleEl.classList.remove('pulse');
        if (resultsEl) resultsEl.style.display = 'flex';
        if (labelEl) { labelEl.style.display = 'flex'; }
        
        // Step 4: Fade in photos one by one
        [1, 2, 3, 4].forEach((n, i) => {
          setTimeout(() => {
            const photo = document.getElementById('nas-photo-' + n);
            if (photo) {
              photo.style.opacity = '1';
              photo.style.animation = 'fadeInUp 0.4s ease';
            }
          }, i * 200);
        });

        // Step 5: Show meta
        setTimeout(() => {
          if (metaEl) { metaEl.style.display = 'block'; }
        }, 1200);
      }, 800);
    }
  }
  setTimeout(typeChar, 400);
}

// ── NAS Demo 2: In-place AI ─────────────────────────────
function runNasAiDemo() {
  const ctxMenu = document.getElementById('nas-ctx-menu');
  const ctxAi = document.getElementById('nas-ctx-ai');
  const aiPanel = document.getElementById('nas-ai-panel');
  const userMsg = document.getElementById('nas-ai-user-msg');
  const aiTyping = document.getElementById('nas-ai-typing');
  const botMsg = document.getElementById('nas-ai-bot-msg');

  if (!ctxMenu) return;

  // Step 1: Show context menu (delayed)
  setTimeout(() => {
    ctxMenu.style.display = 'block';
  }, 800);

  // Step 2: Highlight "Ask AI" option
  setTimeout(() => {
    if (ctxAi) ctxAi.classList.add('highlight');
  }, 2000);

  // Step 3: Hide context menu, show AI panel
  setTimeout(() => {
    ctxMenu.style.display = 'none';
    if (aiPanel) aiPanel.style.display = 'flex';
  }, 2800);

  // Step 4: Show user message
  setTimeout(() => {
    if (userMsg) userMsg.style.display = 'block';
  }, 3400);

  // Step 5: Show typing dots
  setTimeout(() => {
    if (aiTyping) aiTyping.style.display = 'flex';
  }, 3900);

  // Step 6: Hide typing, show bot response
  setTimeout(() => {
    if (aiTyping) aiTyping.style.display = 'none';
    if (botMsg) botMsg.style.display = 'block';
  }, 5200);
}

// ── Scroll reveal (IntersectionObserver) ─────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── Navbar scroll effect ─────────────────────────────────
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 30);
});

// ── Animated stats counter ───────────────────────────────
const statItems = document.querySelectorAll('.stat-item[data-count-type]');
if (statItems.length) {
  const statsObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
        entry.target.classList.add('counted');
        const type = entry.target.dataset.countType;
        const numberEl = entry.target.querySelector('.stat-number');
        
        if (type === 'number') {
          // Count UP from 0 to target
          const target = parseInt(entry.target.dataset.countTarget, 10);
          const suffix = entry.target.dataset.countSuffix || '';
          const prefix = entry.target.dataset.countPrefix || '';
          const duration = 1800;
          const startTime = performance.now();
          
          const animate = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * eased);
            numberEl.textContent = prefix + current + suffix;
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        } else if (type === 'countdown') {
          // Count DOWN from start to target
          const start = parseInt(entry.target.dataset.countStart, 10);
          const target = parseInt(entry.target.dataset.countTarget, 10);
          const suffix = entry.target.dataset.countSuffix || '';
          const prefix = entry.target.dataset.countPrefix || '';
          const duration = 2000;
          const startTime = performance.now();
          
          const animate = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start - (start - target) * eased);
            numberEl.textContent = prefix + current + suffix;
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      }
    });
  }, { threshold: 0.3 });
  
  statItems.forEach(item => statsObserver.observe(item));
}
