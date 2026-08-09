(() => {
  const root = document.documentElement;
  const body = document.body;

  const setTheme = (theme, persist = true) => {
    root.dataset.theme = theme;
    if (persist) {
      try {
        localStorage.setItem('theme', theme);
      } catch (_) {}
    }
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-label', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    });
  };

  setTheme(root.dataset.theme || 'light', false);

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  });

  const menuButton = document.querySelector('[data-menu-toggle]');
  const closeMenu = () => {
    body.classList.remove('nav-open');
    if (menuButton) {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', '打开导航');
    }
  };

  if (menuButton) {
    menuButton.addEventListener('click', () => {
      const isOpen = body.classList.toggle('nav-open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
      menuButton.setAttribute('aria-label', isOpen ? '关闭导航' : '打开导航');
    });
    document.querySelectorAll('[data-primary-nav] a').forEach((link) => link.addEventListener('click', closeMenu));
    window.addEventListener('resize', () => {
      if (window.innerWidth > 720) closeMenu();
    });
  }

  const searchDialog = document.querySelector('[data-search-dialog]');
  const openSearch = () => {
    if (!searchDialog) return;
    if (typeof searchDialog.showModal === 'function') searchDialog.showModal();
    else searchDialog.setAttribute('open', '');
    body.classList.add('dialog-open');
    window.setTimeout(() => searchDialog.querySelector('[data-search-input]')?.focus(), 30);
  };
  const closeSearch = () => {
    if (!searchDialog) return;
    if (typeof searchDialog.close === 'function') searchDialog.close();
    else searchDialog.removeAttribute('open');
    body.classList.remove('dialog-open');
  };

  document.querySelectorAll('[data-open-search]').forEach((button) => button.addEventListener('click', openSearch));
  document.querySelectorAll('[data-close-search]').forEach((button) => button.addEventListener('click', closeSearch));

  if (searchDialog) {
    searchDialog.addEventListener('close', () => body.classList.remove('dialog-open'));
    searchDialog.addEventListener('click', (event) => {
      if (event.target === searchDialog) closeSearch();
    });
  }

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    if (event.key === 'Escape' && body.classList.contains('nav-open')) {
      closeMenu();
      menuButton?.focus();
      return;
    }
    if ((event.key === '/' && !isTyping) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
      event.preventDefault();
      openSearch();
    }
  });

  const indexCache = new Map();
  const normalize = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN');
  const loadIndex = async (url) => {
    if (!indexCache.has(url)) {
      const request = fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Search index returned ${response.status}`);
        return response.json();
      }).catch((error) => {
        indexCache.delete(url);
        throw error;
      });
      indexCache.set(url, request);
    }
    return indexCache.get(url);
  };

  const createResult = (item) => {
    const row = document.createElement('li');
    row.className = 'search-result';

    const link = document.createElement('a');
    link.href = item.url;
    link.textContent = item.title;
    row.append(link);

    if (item.summary) {
      const summary = document.createElement('p');
      summary.textContent = item.summary.length > 120 ? `${item.summary.slice(0, 120)}…` : item.summary;
      row.append(summary);
    }

    const meta = document.createElement('div');
    meta.className = 'search-result-meta';
    const date = document.createElement('span');
    date.textContent = item.date || '';
    meta.append(date);
    if (Array.isArray(item.tags) && item.tags.length) {
      const tags = document.createElement('span');
      tags.textContent = item.tags.slice(0, 3).map((tag) => `#${tag}`).join('  ');
      meta.append(tags);
    }
    row.append(meta);
    return row;
  };

  document.querySelectorAll('[data-search-root]').forEach((searchRoot) => {
    const input = searchRoot.querySelector('[data-search-input]');
    const results = searchRoot.querySelector('[data-search-results]');
    const status = searchRoot.querySelector('[data-search-status]');
    const indexUrl = searchRoot.dataset.indexUrl;
    if (!input || !results || !status || !indexUrl) return;

    let requestNumber = 0;
    const search = async () => {
      const currentRequest = ++requestNumber;
      const query = input.value.trim();
      results.replaceChildren();
      if (!query) {
        status.textContent = '';
        return;
      }

      status.textContent = '正在查找…';
      try {
        const items = await loadIndex(indexUrl);
        if (currentRequest !== requestNumber) return;
        const tokens = normalize(query).split(/\s+/).filter(Boolean);
        const allMatches = items.filter((item) => {
          const haystack = normalize([item.title, item.summary, item.content, ...(item.tags || [])].join(' '));
          return tokens.every((token) => haystack.includes(token));
        });
        const matches = allMatches.slice(0, 12);

        matches.forEach((item) => results.append(createResult(item)));
        if (allMatches.length > matches.length) {
          status.textContent = `共找到 ${allMatches.length} 篇，显示前 ${matches.length} 篇`;
        } else {
          status.textContent = matches.length ? `找到 ${matches.length} 篇相关记录` : '没有找到相关记录';
        }
      } catch (_) {
        status.textContent = '搜索索引暂时不可用';
      }
    };

    input.addEventListener('input', search);
  });

  const progress = document.querySelector('[data-reading-progress]');
  const article = document.querySelector('[data-article-content]');
  if (progress && article) {
    const updateProgress = () => {
      const start = article.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(article.offsetHeight - window.innerHeight * 0.45, 1);
      const value = Math.min(1, Math.max(0, (window.scrollY - start + window.innerHeight * 0.25) / distance));
      progress.style.width = `${value * 100}%`;
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
  }

  const iconMarkup = {
    copy: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5"></path></svg>'
  };

  const copyText = async (text) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  };

  document.querySelectorAll('.prose pre').forEach((pre) => {
    const code = pre.querySelector('code');
    if (!code) return;
    const button = document.createElement('button');
    button.className = 'copy-code';
    button.type = 'button';
    button.title = '复制代码';
    button.setAttribute('aria-label', '复制代码');
    button.innerHTML = iconMarkup.copy;
    button.addEventListener('click', async () => {
      try {
        await copyText(code.textContent);
        button.innerHTML = iconMarkup.check;
        button.setAttribute('aria-label', '已复制');
        window.setTimeout(() => {
          button.innerHTML = iconMarkup.copy;
          button.setAttribute('aria-label', '复制代码');
        }, 1600);
      } catch (_) {}
    });
    pre.append(button);
  });

  const canvas = document.querySelector('[data-signal-canvas]');
  if (canvas) {
    const context = canvas.getContext('2d', { alpha: false });
    const field = document.createElement('canvas');
    const fieldContext = field.getContext('2d', { alpha: false });
    if (!context || !fieldContext) return;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionPreference.matches;
    let width = 0;
    let height = 0;
    let inViewport = true;
    let animationFrame = null;
    let previousTimestamp = null;
    let lastPaintTimestamp = -Infinity;
    let animationElapsed = reducedMotion ? 8.4 / 0.00018 : 0;

    const palette = [
      [0.00, [5, 13, 16]],
      [0.24, [13, 55, 61]],
      [0.43, [13, 125, 125]],
      [0.61, [173, 178, 55]],
      [0.78, [231, 91, 38]],
      [1.00, [246, 233, 218]]
    ];

    const colorAt = (value) => {
      const bounded = Math.max(0, Math.min(1, value));
      for (let i = 1; i < palette.length; i += 1) {
        if (bounded <= palette[i][0]) {
          const [leftStop, leftColor] = palette[i - 1];
          const [rightStop, rightColor] = palette[i];
          const amount = (bounded - leftStop) / (rightStop - leftStop);
          return leftColor.map((channel, index) => Math.round(channel + (rightColor[index] - channel) * amount));
        }
      }
      return palette[palette.length - 1][1];
    };

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(1, Math.round(bounds.width * ratio));
      const nextHeight = Math.max(1, Math.round(bounds.height * ratio));
      if (nextWidth === width && nextHeight === height) return false;

      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      field.width = 180;
      field.height = Math.max(80, Math.round(180 * height / width));
      return true;
    };

    const draw = (t) => {
      const image = fieldContext.createImageData(field.width, field.height);

      for (let y = 0; y < field.height; y += 1) {
        for (let x = 0; x < field.width; x += 1) {
          const nx = x / field.width;
          const ny = y / field.height;
          const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const noise = (grain - Math.floor(grain) - 0.5) * 0.07;
          const roadCenter = 0.61 + Math.sin(ny * 5.2 + t * 0.5) * 0.025;
          const road = Math.exp(-Math.pow((nx - roadCenter) / 0.065, 2)) * 0.32;
          const bands = Math.sin(nx * 9.5 + t) * Math.cos(ny * 6.2 - t * 0.7) * 0.14;
          const structure = Math.sin((nx + ny) * 18 - t * 0.9) * 0.08;
          const horizon = Math.cos(ny * 13 + Math.sin(nx * 5)) * 0.06;
          const value = 0.37 + bands + structure + horizon + road + noise;
          const color = colorAt(value);
          const index = (y * field.width + x) * 4;
          image.data[index] = color[0];
          image.data[index + 1] = color[1];
          image.data[index + 2] = color[2];
          image.data[index + 3] = 255;
        }
      }

      fieldContext.putImageData(image, 0, 0);
      context.imageSmoothingEnabled = true;
      context.drawImage(field, 0, 0, width, height);

      context.save();
      context.globalAlpha = 0.22;
      context.strokeStyle = '#ffffff';
      context.lineWidth = 1;
      const gridX = width / 12;
      const gridY = height / 7;
      context.beginPath();
      for (let x = gridX; x < width; x += gridX) {
        context.moveTo(x, 0);
        context.lineTo(x, height);
      }
      for (let y = gridY; y < height; y += gridY) {
        context.moveTo(0, y);
        context.lineTo(width, y);
      }
      context.stroke();

      const scanY = ((t * 0.16) % 1) * height;
      context.globalAlpha = 0.55;
      context.strokeStyle = '#ffb563';
      context.beginPath();
      context.moveTo(0, scanY);
      context.lineTo(width, scanY);
      context.stroke();

      context.globalAlpha = 0.52;
      context.strokeStyle = '#d9ff77';
      context.lineWidth = 1.5;
      context.beginPath();
      for (let x = 0; x <= width; x += 8) {
        const y = height * 0.82 + Math.sin(x / width * 25 + t * 4) * height * 0.018;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      context.restore();
    };

    const drawCurrentFrame = () => draw(animationElapsed * 0.00018);
    const canAnimate = () => !reducedMotion && inViewport && !document.hidden;

    const stopAnimation = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      previousTimestamp = null;
    };

    const scheduleAnimation = () => {
      if (animationFrame === null && canAnimate()) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    function animate(timestamp) {
      animationFrame = null;
      if (!canAnimate()) {
        previousTimestamp = null;
        return;
      }

      if (previousTimestamp !== null) {
        const delta = Math.max(0, Math.min(timestamp - previousTimestamp, 100));
        animationElapsed += delta;
      }
      previousTimestamp = timestamp;

      if (timestamp - lastPaintTimestamp >= 48) {
        drawCurrentFrame();
        lastPaintTimestamp = timestamp;
      }
      scheduleAnimation();
    }

    const syncAnimation = () => {
      if (canAnimate()) {
        scheduleAnimation();
        return;
      }

      stopAnimation();
      if (reducedMotion && inViewport && !document.hidden) {
        drawCurrentFrame();
      }
    };

    const isCanvasInViewport = () => {
      const bounds = canvas.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.right > 0 &&
        bounds.top < window.innerHeight && bounds.left < window.innerWidth;
    };

    const handleResize = () => {
      if (!resizeCanvas() || !inViewport || document.hidden) return;
      drawCurrentFrame();
      lastPaintTimestamp = performance.now();
    };

    resizeCanvas();
    inViewport = isCanvasInViewport();
    if (inViewport && !document.hidden) {
      drawCurrentFrame();
      lastPaintTimestamp = performance.now();
    }
    scheduleAnimation();

    document.addEventListener('visibilitychange', syncAnimation);

    if (typeof motionPreference.addEventListener === 'function') {
      motionPreference.addEventListener('change', (event) => {
        reducedMotion = event.matches;
        syncAnimation();
      });
    } else {
      motionPreference.addListener((event) => {
        reducedMotion = event.matches;
        syncAnimation();
      });
    }

    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', handleResize);
    }

    if ('IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        inViewport = entry.isIntersecting;
        syncAnimation();
      });
      visibilityObserver.observe(canvas);
    } else {
      let viewportCheckFrame = null;
      const queueViewportCheck = () => {
        if (viewportCheckFrame !== null) return;
        viewportCheckFrame = requestAnimationFrame(() => {
          viewportCheckFrame = null;
          const nextInViewport = isCanvasInViewport();
          if (nextInViewport === inViewport) return;
          inViewport = nextInViewport;
          syncAnimation();
        });
      };

      window.addEventListener('scroll', queueViewportCheck, { passive: true });
      window.addEventListener('resize', queueViewportCheck);
    }
  }

})();
