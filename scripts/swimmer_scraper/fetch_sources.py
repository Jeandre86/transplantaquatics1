"""Cache explicitly selected public source URLs; never writes to the database."""
import argparse
import hashlib
import time
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
import truststore
from bs4 import BeautifulSoup
truststore.inject_into_ssl()

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'data/swimming/sources'
CACHE.mkdir(parents=True, exist_ok=True)

def fetch(url):
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    meta_path = CACHE / (key + '.meta.json')
    if meta_path.exists():
        cached = json.loads(meta_path.read_text())
        if cached['status'] == 'downloaded':
            return cached
    meta = {'url': url, 'retrieved_at': datetime.now(timezone.utc).isoformat(), 'id': key}
    try:
        r = requests.get(url, timeout=45, headers={'User-Agent': 'TransplantSwimmingResultsResearch/1.0'}, stream=True)
        r.raise_for_status()
        content = bytearray()
        for chunk in r.iter_content(65536):
            content.extend(chunk)
            if len(content) > 60 * 1024 * 1024:
                raise ValueError('Source exceeds 60 MB')
        ext = '.pdf' if content[:4] == b'%PDF' else '.html'
        path = CACHE / (key + ext)
        path.write_bytes(content)
        meta.update(status='downloaded', final_url=r.url, file=str(path.relative_to(ROOT)), sha256=hashlib.sha256(content).hexdigest())
        if ext == '.html':
            soup = BeautifulSoup(bytes(content), 'html.parser')
            meta['title'] = soup.title.get_text(' ', strip=True) if soup.title else ''
            meta['links'] = [{'text': a.get_text(' ', strip=True), 'url': urljoin(r.url, a['href'])} for a in soup.select('a[href]')]
    except Exception as e:
        meta.update(status='unavailable', error=str(e))
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    return meta

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('urls',nargs='*',help='Explicit public result or archive URLs')
    parser.add_argument('--manifest',type=Path,help='Existing swimmers.json; fetch URLs from source_inventory')
    args=parser.parse_args()
    urls=args.urls
    if args.manifest:
        urls += [s['url'] for s in json.loads(args.manifest.read_text())['source_inventory']]
    if not urls:parser.error('Provide URLs or --manifest')
    for url in dict.fromkeys(urls):
        m=fetch(url)
        print(json.dumps({k:v for k,v in m.items() if k!='links'},ensure_ascii=False),flush=True)
        time.sleep(0.5)

