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
    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-site-header]')) closeMenu();
    });
    document.addEventListener('focusin', (event) => {
      if (!event.target.closest('[data-site-header]')) closeMenu();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 720) closeMenu();
    });
  }

  const searchDialog = document.querySelector('[data-search-dialog]');
  const openSearch = () => {
    if (!searchDialog) return;
    closeMenu();
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
    if (item.kind) {
      const kind = document.createElement('span');
      kind.textContent = item.kind;
      meta.append(kind);
    }
    if (item.date) {
      const date = document.createElement('span');
      date.textContent = item.date;
      meta.append(date);
    }
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
          const haystack = normalize([item.title, item.summary, item.content, item.kind, ...(item.tags || [])].join(' '));
          return tokens.every((token) => haystack.includes(token));
        });
        const matches = allMatches.slice(0, 12);

        matches.forEach((item) => results.append(createResult(item)));
        if (allMatches.length > matches.length) {
          status.textContent = `共找到 ${allMatches.length} 条，显示前 ${matches.length} 条`;
        } else {
          status.textContent = matches.length ? `找到 ${matches.length} 条相关记录` : '没有找到相关记录';
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
      progress.style.transform = `scaleX(${value})`;
    };
    let framePending = false;
    const scheduleProgress = () => {
      if (framePending) return;
      framePending = true;
      requestAnimationFrame(() => {
        updateProgress();
        framePending = false;
      });
    };
    updateProgress();
    window.addEventListener('scroll', scheduleProgress, { passive: true });
    window.addEventListener('resize', scheduleProgress);
    if ('ResizeObserver' in window) new ResizeObserver(scheduleProgress).observe(article);
  }

  const tocLinks = [...document.querySelectorAll('.post-toc a')];
  const tocSections = tocLinks.map((link) => ({
    link, heading: document.getElementById(decodeURIComponent(link.hash.slice(1)))
  })).filter((item) => item.heading);
  if (tocSections.length && 'IntersectionObserver' in window) {
    const updateToc = () => {
      const active = tocSections.filter((item) => item.heading.getBoundingClientRect().top <= window.innerHeight * 0.35).at(-1) || tocSections[0];
      tocSections.forEach(({ link }) => {
        if (link === active.link) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const observer = new IntersectionObserver(updateToc, { rootMargin: '-10% 0px -65% 0px' });
    tocSections.forEach(({ heading }) => observer.observe(heading));
    updateToc();
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

  // Pause decorative motion while the page is hidden or the hero is offscreen.
  const art = document.querySelector('.hero-art');
  if (art) {
    let visible = true;
    const sync = () => { art.style.animationPlayState = visible && !document.hidden ? 'running' : 'paused'; };
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }).observe(art);
    sync();
  }
})();
