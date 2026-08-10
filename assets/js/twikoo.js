(() => {
  'use strict'

  const section = document.querySelector('[data-twikoo-section]')
  const root = section?.querySelector('[data-twikoo-root]')
  if (!section || !root) return

  const toPositiveInt = (value, fallback) => {
    const number = Number.parseInt(value, 10)
    return Number.isFinite(number) && number > 0 ? number : fallback
  }

  const limits = {
    comments: toPositiveInt(section.dataset.twikooMaxComments, 100),
    replies: toPositiveInt(section.dataset.twikooMaxReplies, 50),
    length: toPositiveInt(section.dataset.twikooMaxLength, 1000)
  }

  const status = section.querySelector('[data-twikoo-status]')
  const setStatus = (message) => {
    if (status) status.textContent = message
  }

  const getCommentsContainer = () => root.querySelector('.tk-comments-container')

  const getMainComments = (container) => Array.from(container?.children || [])
    .filter((element) => element.classList.contains('tk-comment'))

  const getReplyOwner = (comment) => {
    let owner = comment
    while (owner.parentElement?.closest('.tk-comment')) {
      owner = owner.parentElement.closest('.tk-comment')
    }
    return owner
  }

  const getDirectReplies = (comment) => {
    const replies = comment.querySelector(':scope > .tk-main > .tk-replies')
    return Array.from(replies?.children || [])
      .filter((element) => element.classList.contains('tk-comment'))
  }

  const applyLimits = () => {
    const container = getCommentsContainer()
    if (!container) return

    const mainComments = getMainComments(container)
    mainComments.slice(limits.comments).forEach((comment) => {
      comment.hidden = true
    })

    const expand = Array.from(container.children)
      .find((element) => element.classList.contains('tk-expand-wrap'))
    if (expand && mainComments.length >= limits.comments) {
      expand.hidden = true
    }

    mainComments.forEach((comment) => {
      const replies = getDirectReplies(comment)
      replies.slice(limits.replies).forEach((reply) => {
        reply.hidden = true
      })

      const action = comment.querySelector(':scope > .tk-main > .tk-row .tk-action')
      const replyButton = action?.querySelector('.tk-action-link:last-child')
      if (replyButton && replies.length >= limits.replies) {
        replyButton.classList.add('twikoo-reply-limit-reached')
        replyButton.setAttribute('aria-disabled', 'true')
        replyButton.title = `该评论最多保留 ${limits.replies} 条回复`
      }
    })

    root.querySelectorAll('textarea').forEach((textarea) => {
      textarea.maxLength = limits.length
      textarea.setAttribute('data-comment-maxlength', String(limits.length))
    })
  }

  root.addEventListener('click', (event) => {
    const replyButton = event.target.closest('.tk-action-link')
    if (!replyButton) return

    const action = replyButton.closest('.tk-action')
    const actionLinks = action ? Array.from(action.querySelectorAll('.tk-action-link')) : []
    if (!action || actionLinks[actionLinks.length - 1] !== replyButton) return

    const comment = replyButton.closest('.tk-comment')
    const owner = comment && getReplyOwner(comment)
    if (!owner || getDirectReplies(owner).length < limits.replies) return

    event.preventDefault()
    event.stopImmediatePropagation()
    setStatus(`这条评论已达到 ${limits.replies} 条回复上限。`)
  }, true)

  const scriptUrl = `https://cdn.jsdelivr.net/npm/twikoo@${encodeURIComponent(section.dataset.twikooVersion)}/dist/${section.dataset.twikooScript}`
  const script = document.createElement('script')
  script.src = scriptUrl
  script.crossOrigin = 'anonymous'
  if (section.dataset.twikooIntegrity) script.integrity = section.dataset.twikooIntegrity
  script.onload = () => {
    if (!window.twikoo?.init) {
      setStatus('评论脚本加载失败，请稍后重试。')
      return
    }

    window.twikoo.init({
      envId: section.dataset.twikooEnvId,
      el: '#twikoo-comments',
      path: window.location.pathname,
      lang: 'zh-CN',
      onCommentLoaded: applyLimits
    })

    const observer = new MutationObserver(applyLimits)
    observer.observe(root, { childList: true, subtree: true })
    window.setTimeout(applyLimits, 0)
  }
  script.onerror = () => setStatus('评论脚本加载失败，请检查 CDN 或网络连接。')
  document.head.appendChild(script)
})()
