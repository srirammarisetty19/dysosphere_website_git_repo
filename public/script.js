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

// ── Demo tab switching ──────────────────────────────────
let nasTriggered = false;
document.querySelectorAll('.demo-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Update active tab
    document.querySelectorAll('.demo-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Show correct panel
    const target = tab.dataset.tab;
    document.querySelectorAll('.demo-tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + target);
    if (panel) panel.classList.add('active');
    
    // Trigger NAS typing animations on first visit
    if (target === 'nas' && !nasTriggered) {
      nasTriggered = true;
      triggerTypingReply('typing3', 'reply3', 2000);
      triggerTypingReply('typing4', 'reply4', 2600);
    }
  });
});

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
