export function artifactRequestAllowed(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  downloadsAllowed: boolean,
  strictOffline: boolean,
): boolean {
  const request = new Request(input, init);
  const url = new URL(request.url);
  return (
    downloadsAllowed &&
    !strictOffline &&
    request.method === 'GET' &&
    !request.body &&
    ((url.origin === 'https://huggingface.co' && url.pathname.startsWith('/mlc-ai/')) ||
      (url.origin === 'https://raw.githubusercontent.com' &&
        url.pathname.startsWith('/mlc-ai/binary-mlc-llm-libs/')))
  );
}
