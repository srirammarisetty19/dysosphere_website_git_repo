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
const typing1 = document.getElementById('typing1');
const reply1 = document.getElementById('reply1');
if (typing1 && reply1) {
  setTimeout(() => {
    setTimeout(() => {
      typing1.style.display = 'none';
      reply1.style.display = 'block';
      reply1.style.animation = 'fadeInUp 0.4s ease';
    }, 2200);
  }, 1200);
}

const typing2 = document.getElementById('typing2');
const reply2 = document.getElementById('reply2');
if (typing2 && reply2) {
  setTimeout(() => {
    setTimeout(() => {
      typing2.style.display = 'none';
      reply2.style.display = 'block';
      reply2.style.animation = 'fadeInUp 0.4s ease';
    }, 2800);
  }, 1200);
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

// ── Hero rotating word animation ─────────────────────────
const heroRotate = document.getElementById('heroRotate');
if (heroRotate) {
  const words = heroRotate.querySelectorAll('.rotate-text');
  let currentWord = 0;
  
  // Measure the widest word and set container width
  let maxWidth = 0;
  words.forEach(w => {
    w.style.position = 'relative';
    w.style.opacity = '1';
    const rect = w.getBoundingClientRect();
    if (rect.width > maxWidth) maxWidth = rect.width;
    w.style.position = '';
    w.style.opacity = '';
  });
  heroRotate.style.width = maxWidth + 'px';
  heroRotate.style.display = 'inline-block';
  
  setInterval(() => {
    const prev = currentWord;
    currentWord = (currentWord + 1) % words.length;
    
    words[prev].classList.remove('active');
    words[prev].classList.add('exit');
    
    setTimeout(() => {
      words[prev].classList.remove('exit');
    }, 450);
    
    words[currentWord].classList.add('active');
  }, 2500);
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
