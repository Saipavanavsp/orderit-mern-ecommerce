// Streams a remote JSONL file line by line using HTTP Range requests (official Hugging Face
// "resolve" download URLs). Range chunks are much faster than one long-lived stream on Windows and
// let us stop as soon as we have enough data, without downloading multi-GB files.
const CHUNK = 16 * 1024 * 1024;

export async function* streamJsonl(url, { maxBytes = Infinity, onProgress } = {}) {
  let rest = '';
  let fetched = 0;
  for (let start = 0; start < maxBytes; start += CHUNK) {
    const end = Math.min(start + CHUNK, maxBytes) - 1;
    let res;
    for (let attempt = 1; ; attempt += 1) {
      try {
        res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
        if (res.status === 416) return; // past end of file
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        break;
      } catch (err) {
        if (attempt >= 4) throw new Error(`Download failed for ${url}: ${err.message}`, { cause: err });
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    const text = await res.text();
    fetched += Buffer.byteLength(text);
    onProgress?.(fetched);
    const lines = (rest + text).split('\n');
    rest = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      try {
        yield JSON.parse(line);
      } catch {
        // malformed line - skip
      }
    }
    if (res.status === 200 || Buffer.byteLength(text) < end - start + 1) return; // whole file / last chunk
  }
}

export const mb = (bytes) => `${(bytes / 1e6).toFixed(0)} MB`;
