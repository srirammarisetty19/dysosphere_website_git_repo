/* SphereX by DysoSphere — Multi-page Script */

// ── Navbar scroll ────────────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', scrollY > 40));
}

// ── Mobile toggle ────────────────────────────────────────
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

// ── Smooth scroll for same-page anchors ──────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const href = a.getAttribute('href');
  if (href === '#') return;
  e.preventDefault();
  const t = document.querySelector(href);
  if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (navLinks) navLinks.classList.remove('open');
}));

// ── Close mobile nav on link click ───────────────────────
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    if (navLinks) navLinks.classList.remove('open');
  });
});

// ── Chat typing animation (Home page) ───────────────────
function triggerTypingReply(typingId, replyId, delay) {
  const typing = document.getElementById(typingId);
  const reply = document.getElementById(replyId);
  if (typing && reply) {
    typing.style.display = 'flex';
    reply.style.display = 'none';
    setTimeout(() => {
      typing.style.display = 'none';
      reply.style.display = 'block';
      reply.style.animation = 'fadeInUp 0.4s ease';
    }, delay);
  }
}

// Trigger AI demos on load
setTimeout(() => triggerTypingReply('typing1', 'reply1', 2200), 1200);
setTimeout(() => triggerTypingReply('typing2', 'reply2', 2800), 1200);

// ── Demo tab switching + auto-rotation ──────────────────
let nasTriggered = false;
const demoTabs = document.querySelectorAll('.demo-tab');
const tabOrder = ['ai', 'nas'];
let currentTabIndex = 0;
let autoRotateTimer = null;
let pauseTimeout = null;

function switchToTab(tabName) {
  // Update active tab
  demoTabs.forEach(t => {
    t.classList.remove('active');
    // Reset progress bar animation via reflow
    const bar = t.querySelector('.demo-tab-progress');
    if (bar) { bar.style.animation = 'none'; bar.offsetHeight; bar.style.animation = ''; }
  });
  
  const targetTab = document.querySelector('.demo-tab[data-tab="' + tabName + '"]');
  if (targetTab) targetTab.classList.add('active');

  // Show correct panel
  document.querySelectorAll('.demo-tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + tabName);
  if (panel) panel.classList.add('active');

  // Trigger NAS mockup animations on first visit
  if (tabName === 'nas' && !nasTriggered) {
    nasTriggered = true;
    runNasSearchDemo();
    runNasAiDemo();
  }

  // Update index
  currentTabIndex = tabOrder.indexOf(tabName);
  if (currentTabIndex === -1) currentTabIndex = 0;
}

function startAutoRotation() {
  stopAutoRotation();
  autoRotateTimer = setInterval(() => {
    currentTabIndex = (currentTabIndex + 1) % tabOrder.length;
    switchToTab(tabOrder[currentTabIndex]);
  }, 10000);
}

function stopAutoRotation() {
  if (autoRotateTimer) { clearInterval(autoRotateTimer); autoRotateTimer = null; }
}

// Manual tab click — switch + pause auto-rotation for 30s
demoTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    switchToTab(tab.dataset.tab);
    stopAutoRotation();
    if (pauseTimeout) clearTimeout(pauseTimeout);
    pauseTimeout = setTimeout(() => startAutoRotation(), 30000);
  });
});

// Start auto-rotation on page load
startAutoRotation();

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
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${(i % 6) * 0.08}s`;
  revealObserver.observe(el);
});




// ── Active nav link highlight ────────────────────────────
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a:not(.nav-cta)').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPage) {
    link.classList.add('active');
  } else {
    link.classList.remove('active');
  }
});

// ── Hero typewriter animation ────────────────────────────
const heroRotate = document.getElementById('heroRotate');
if (heroRotate) {
  const words = JSON.parse(heroRotate.dataset.words);
  const textEl = heroRotate.querySelector('.typewriter-text');
  let wordIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  
  const typeSpeed = 80;    // ms per character when typing
  const deleteSpeed = 40;  // ms per character when deleting
  const pauseAfterType = 1800; // pause after full word typed
  const pauseAfterDelete = 300; // pause before typing next word
  
  function tick() {
    const currentWordStr = words[wordIndex];
    
    if (!isDeleting) {
      // Typing
      charIndex++;
      textEl.textContent = currentWordStr.substring(0, charIndex);
      
      if (charIndex === currentWordStr.length) {
        // Full word typed — pause, then start deleting
        isDeleting = true;
        setTimeout(tick, pauseAfterType);
        return;
      }
      setTimeout(tick, typeSpeed);
    } else {
      // Deleting
      charIndex--;
      textEl.textContent = currentWordStr.substring(0, charIndex);
      
      if (charIndex === 0) {
        // Fully deleted — move to next word
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        setTimeout(tick, pauseAfterDelete);
        return;
      }
      setTimeout(tick, deleteSpeed);
    }
  }
  
  // Start typing the first word after a short delay
  setTimeout(tick, 500);
}

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
          const target = parseInt(entry.target.dataset.countTarget, 10);
          const suffix = entry.target.dataset.countSuffix || '';
          const duration = 1800;
          const startTime = performance.now();
          
          const animate = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * eased);
            numberEl.textContent = current + suffix;
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        } else if (type === 'pulse') {
          // Quick scale pulse effect
          numberEl.style.transition = 'transform 0.4s ease';
          numberEl.style.transform = 'scale(1.2)';
          setTimeout(() => {
            numberEl.style.transform = 'scale(1)';
          }, 400);
        }
        // 'static' type: no animation needed, just show label
      }
    });
  }, { threshold: 0.3 });
  
  statItems.forEach(item => statsObserver.observe(item));
}
