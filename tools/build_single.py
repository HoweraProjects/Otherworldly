#!/usr/bin/env python3
"""把 index.html + js/*.js 打包成單一 HTML 檔（可直接雙擊開啟、離線遊玩）。
用法：python3 tools/build_single.py  →  輸出 dist/因為太怕死只好派分身去滅世.html
"""
import os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()

def inline(m):
    src = m.group(1)
    js = open(os.path.join(root, src), encoding='utf-8').read()
    return '<script>\n' + js.replace('</script>', '<\\/script>') + '\n</script>'

out = re.sub(r'<script src="([^"]+)"[^>]*></script>', inline, html)
assert '<script src=' not in out
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
dst = os.path.join(root, 'dist', '因為太怕死只好派分身去滅世.html')
open(dst, 'w', encoding='utf-8').write(out)
print('built', dst, f'{len(out.encode("utf-8")) // 1024} KB')
