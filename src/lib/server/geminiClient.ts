export async function callGeminiJsonWithFallback<T = Record<string, unknown>>(
  apiKey: string,
  promptText: string
): Promise<T> {
  const cleanKey = encodeURIComponent(apiKey.trim());
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cleanKey}`,
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${cleanKey}`,
  ];

  let lastErrorMsg = '';
  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        lastErrorMsg = errData?.error?.message || response.statusText;
        continue;
      }

      const resData = await response.json();
      let parsedText: string = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!parsedText) {
        lastErrorMsg = 'Empty response from Gemini API';
        continue;
      }

      parsedText = parsedText.trim();
      if (parsedText.startsWith('```json')) {
        parsedText = parsedText.replace(/^```json/i, '').replace(/```$/i, '').trim();
      } else if (parsedText.startsWith('```')) {
        parsedText = parsedText.replace(/^```/i, '').replace(/```$/i, '').trim();
      }

      return JSON.parse(parsedText) as T;
    } catch (err: unknown) {
      lastErrorMsg = err instanceof Error ? err.message : 'Gemini request error';
    }
  }

  throw new Error(`Gemini API Error: ${lastErrorMsg || 'All Gemini model endpoints failed'}`);
}
