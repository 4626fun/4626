(function () {
  var NAV_LINKS = [
    { href: '/', label: 'Home', page: 'home' },
    { href: 'https://docs.4626.fun', label: 'Docs', external: true },
    { href: '/faq', label: 'FAQ', page: 'faq' },
    { href: '/security', label: 'Security', page: 'security' },
    { href: '/about', label: 'About', page: 'about' },
    { href: '/terms', label: 'Terms', page: 'terms' },
    { href: '/privacy', label: 'Privacy', page: 'privacy' },
  ]

  var nav = document.querySelector('[data-trust-nav]')
  if (!nav) return

  var current = document.body.getAttribute('data-trust-page') || ''

  nav.innerHTML = NAV_LINKS.map(function (link) {
    var attrs = ['href="' + link.href + '"']
    if (link.page && link.page === current) attrs.push('aria-current="page"')
    if (link.external) attrs.push('target="_blank"', 'rel="noopener noreferrer"')
    return '<a ' + attrs.join(' ') + '>' + link.label + '</a>'
  }).join('')
})()
