(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.matchMedia("(max-width: 900px), (hover: none)").matches;

  /* ============ CANVAS RAIN ============ */
  const rainWrap = document.getElementById("rain");
  if (rainWrap && !prefersReduced) {
    const canvas = document.createElement("canvas");
    rainWrap.appendChild(canvas);
    const ctx = canvas.getContext("2d", { alpha: true });
    let W = 0, H = 0, dpr = 1;
    let drops = [];
    let ripples = [];
    const isSmall = () => window.innerWidth < 700;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = rainWrap.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = isSmall() ? 70 : 180;
      drops = new Array(count).fill(0).map(() => makeDrop(true));
    };

    const makeDrop = (anyY) => ({
      x: Math.random() * W,
      y: anyY ? Math.random() * H : -20 - Math.random() * 200,
      len: 8 + Math.random() * 18,
      speed: 3 + Math.random() * 9,
      xDrift: (Math.random() - 0.5) * 0.6,
      opacity: 0.25 + Math.random() * 0.55,
      hue: 195 + Math.random() * 20,
    });

    const addRipple = (x, y) => {
      ripples.push({ x, y, r: 0, life: 1 });
      if (ripples.length > 20) ripples.shift();
    };

    const tick = () => {
      ctx.clearRect(0, 0, W, H);

      // Rain lines
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        const grad = ctx.createLinearGradient(d.x, d.y, d.x + d.xDrift * d.len, d.y + d.len);
        grad.addColorStop(0, `hsla(${d.hue}, 100%, 72%, 0)`);
        grad.addColorStop(1, `hsla(${d.hue}, 100%, 70%, ${d.opacity})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.xDrift * d.len, d.y + d.len);
        ctx.stroke();

        d.x += d.xDrift;
        d.y += d.speed;
        if (d.y > H) {
          // splash: tiny ripple at ground
          if (Math.random() < 0.2) addRipple(d.x, H - 2);
          Object.assign(d, makeDrop(false));
        }
      }

      // Ripples (click + rain splash)
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += 1.4;
        r.life -= 0.025;
        if (r.life <= 0) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(78, 195, 255, ${r.life * 0.55})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (!document.hidden) raf = requestAnimationFrame(tick);
    };

    let raf = null;
    resize();
    tick();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) tick();
    });

    // Click ripples inside hero
    rainWrap.parentElement.addEventListener("pointermove", (e) => {
      if (Math.random() > 0.9) {
        const r = rainWrap.getBoundingClientRect();
        addRipple(e.clientX - r.left, e.clientY - r.top);
      }
    });
  }

  /* Page-level click ripples */
  if (!prefersReduced) {
    document.addEventListener("pointerdown", (e) => {
      if (e.target.closest("input, textarea, select")) return;
      const el = document.createElement("div");
      el.className = "ripple";
      el.style.left = e.clientX + "px";
      el.style.top = e.clientY + "px";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 750);
    });
  }

  /* ============ HERO TITLE REVEAL (letter stagger) ============ */
  const heroTitle = document.querySelector(".hero__title");
  if (heroTitle && !prefersReduced) {
    const txt = heroTitle.textContent;
    heroTitle.textContent = "";
    txt.split("").forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = ch === " " ? "\u00A0" : ch;
      span.style.opacity = "0";
      span.style.transform = "translateY(24px)";
      span.style.display = "inline-block";
      span.style.transition = `opacity 0.6s cubic-bezier(0.22,1,0.36,1) ${0.1 + i * 0.04}s, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${0.1 + i * 0.04}s`;
      heroTitle.appendChild(span);
    });
    requestAnimationFrame(() => {
      heroTitle.querySelectorAll(".char").forEach(s => { s.style.opacity = "1"; s.style.transform = "translateY(0)"; });
    });
  }

  /* ============ NAV: scroll state ============ */
  const nav = document.getElementById("nav");
  if (nav) {
    const setNav = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
    setNav();
    window.addEventListener("scroll", setNav, { passive: true });
  }

  /* ============ Mobile menu ============ */
  const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu-overlay");
  const menuClose = document.getElementById("menuClose");
  if (menuBtn && menu) {
    const open = () => {
      menu.classList.add("is-open");
      menu.removeAttribute("inert");
      menuBtn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      menu.classList.remove("is-open");
      menu.setAttribute("inert", "");
      menuBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };
    menuBtn.addEventListener("click", open);
    menuClose && menuClose.addEventListener("click", close);
    menu.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  }

  /* ============ Lenis (desktop only) ============ */
  let lenis = null;
  const initLenis = () => {
    if (prefersReduced || isMobile || typeof Lenis === "undefined") return;
    lenis = new Lenis({
      duration: 1.15,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  };

  /* ============ Reveal ============ */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(el => io.observe(el));
  }

  /* ============ GSAP ============ */
  const initGsap = () => {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined" || prefersReduced) return;
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    // Hero meta + sub + actions + divider
    const order = [".hero__meta", ".hero__sub", ".hero__actions", ".hero__divider"];
    order.forEach((sel, i) => {
      const el = document.querySelector(sel);
      if (el) gsap.from(el, { opacity: 0, y: 20, duration: 0.8, ease: "power2.out", delay: 0.5 + i * 0.1 });
    });

    // Sections
    gsap.utils.toArray(".cuts__head, .shop__body, .book__wrap, .visit__body").forEach(el => {
      gsap.from(el, { y: 26, opacity: 0, duration: 0.8, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 84%" } });
    });

    // Cut list stagger
    const cuts = gsap.utils.toArray(".cut");
    if (cuts.length) {
      gsap.from(cuts, { x: -24, opacity: 0, duration: 0.65, stagger: 0.08, ease: "power2.out", scrollTrigger: { trigger: ".cuts__list", start: "top 84%" } });
    }

    // Channels
    const channels = gsap.utils.toArray(".channel");
    if (channels.length) {
      gsap.from(channels, { y: 24, opacity: 0, duration: 0.6, stagger: 0.08, ease: "power2.out", scrollTrigger: { trigger: ".book__channels", start: "top 88%" } });
    }

    // Footer big type pinned animate
    const footerBig = document.querySelector(".footer__big");
    if (footerBig) {
      gsap.from(footerBig, { y: 40, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: footerBig, start: "top 90%" } });
    }

    ScrollTrigger.refresh();
  };

  window.addEventListener("load", () => {
    initLenis();
    initGsap();
  });
})();
