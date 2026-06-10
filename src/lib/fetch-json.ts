export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();

  if (!response.ok) {
    let message = "요청에 실패했습니다.";
    if (text) {
      try {
        const data = JSON.parse(text) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  if (!text) {
    throw new Error("서버 응답이 비어 있습니다.");
  }

  return JSON.parse(text) as T;
}
