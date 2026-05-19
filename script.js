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

// ── Hero particles canvas (Home page) ────────────────────
const pEl = document.getElementById('particles');
if (pEl) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  pEl.appendChild(c);
  c.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0';

  const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
  resize();
  window.addEventListener('resize', resize);

  const pts = Array.from({ length: 50 }, () => ({
    x: Math.random() * c.width,
    y: Math.random() * c.height,
    r: Math.random() * 1.5 + 0.4,
    dx: (Math.random() - 0.5) * 0.25,
    dy: (Math.random() - 0.5) * 0.25,
    o: Math.random() * 0.35 + 0.08,
  }));

  (function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(52,118,252,${p.o})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0 || p.x > c.width) p.dx *= -1;
      if (p.y < 0 || p.y > c.height) p.dy *= -1;
    });
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(52,118,252,${0.05 * (1 - d / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  })();
}

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
