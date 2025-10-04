// یک wrapper سبک برای fetch با پشتیبانی از session cookie و امکان بازگرداندن Response خام
export async function fetchApi(
  url: string,
  options: RequestInit = {},
  raw: boolean = false
): Promise<any> {
  const resp = await fetch(url, {
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    ...options,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });

  if (!resp.ok) {
    let errPayload: any = await resp.text().catch(() => '');
    try { errPayload = JSON.parse(errPayload); } catch { /* ignore */ }
    const msg = typeof errPayload === 'string' ? errPayload : (errPayload?.error || errPayload?.message || 'REQUEST_FAILED');
    throw new Error(msg);
  }

  if (raw) return resp;
  const data = await resp.json().catch(() => ({}));
  return data;
}
