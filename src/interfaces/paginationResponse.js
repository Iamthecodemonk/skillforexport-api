export function parsePagination(query = {}, defaultPerPage = 20) {
  const page = Math.max(parseInt(query.page || '1', 10) || 1, 1);
  const perPage = Math.max(parseInt(query.per_page || query.perPage || query.limit || String(defaultPerPage), 10) || defaultPerPage, 1);
  const explicitOffset = query.offset;
  const offset = typeof explicitOffset !== 'undefined'
    ? Math.max(parseInt(explicitOffset, 10) || 0, 0)
    : (page - 1) * perPage;
  const derivedPage = typeof explicitOffset !== 'undefined'
    ? Math.floor(offset / perPage) + 1
    : page;

  return {
    page: derivedPage,
    perPage,
    limit: perPage,
    offset
  };
}

export function buildPaginatedResponse(req, { data, page, perPage, total }) {
  const safeTotal = Math.max(parseInt(total, 10) || 0, 0);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safePerPage = Math.max(parseInt(perPage, 10) || 1, 1);
  const lastPage = Math.max(Math.ceil(safeTotal / safePerPage), 1);
  const currentPage = Math.min(safePage, lastPage);
  const from = safeTotal === 0 ? null : ((currentPage - 1) * safePerPage) + 1;
  const to = safeTotal === 0 ? null : Math.min((currentPage - 1) * safePerPage + data.length, safeTotal);
  const protocol = req.protocol || 'http';
  const host = req.headers && req.headers.host ? req.headers.host : 'localhost';
  const baseUrl = new URL(req.url, `${protocol}://${host}`);
  const path = `${protocol}://${host}${baseUrl.pathname}`;

  const pageUrl = (targetPage) => {
    if (targetPage < 1 || targetPage > lastPage) return null;
    const url = new URL(baseUrl.toString());
    url.searchParams.set('page', String(targetPage));
    url.searchParams.set('per_page', String(safePerPage));
    url.searchParams.delete('limit');
    url.searchParams.delete('offset');
    return url.toString();
  };

  return {
    current_page: currentPage,
    data,
    first_page_url: pageUrl(1),
    from,
    last_page: lastPage,
    last_page_url: pageUrl(lastPage),
    links: [],
    next_page_url: currentPage < lastPage ? pageUrl(currentPage + 1) : null,
    path,
    per_page: safePerPage,
    prev_page_url: currentPage > 1 ? pageUrl(currentPage - 1) : null,
    to,
    total: safeTotal
  };
}
