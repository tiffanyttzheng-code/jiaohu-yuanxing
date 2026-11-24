# 生成 hitmask.js：主页各图层的透明度遮罩（给 main.js 的点击判断用）。
# 双击打开 index.html（file://）时浏览器不让读图片像素，所以提前把遮罩算好写进 JS。
# 换了 assets/home3/ 里的图层后重新跑一次：python make_hitmask.py
import base64, json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
S = 2   # 遮罩按 1/2 尺寸存
# 入口图层：alpha > 40 算点中；静态布景：alpha > 160 才挡住后面的入口
HOT = ['task-title', 'sub-main', 'sub-side', 'sub-map', 'close', 'story-bg', 'story-prog', 'story-last', 'story-bar', 'story-ch', 'story-sub', 'story-btn', 'story-cg', 'story-pen',
       'c-label', 'c-pill1', 'c-pill2', 'avatar', 'avatar-a', 'avatar-1', 'avatar-2', 'avatar-c', 'c-coat', 'c-text', 'settings-gear', 'codex-sign', 'statue-l', 'statue-r', 'tag-wiki', 'tag-xiang']
STATIC = ['settings-base', 'rug', 'search', 'c-panel', 'c-desc', 'c-tri', 'line-r', 'tick-r', 'tick-r2', 'line-tr', 'mark-tr', 'codex-tri', 'platform',
          'frame-l', 'head', 'sofa', 'btn-pen', 'btn-star', 'title', 'shade-r', 'fg', 'plant']

out = {}
for names, th in ((HOT, 40), (STATIC, 160)):
    for n in names:
        a = Image.open(os.path.join(HERE, n + '.png')).convert('RGBA').getchannel('A')
        w, h = (a.width + S - 1) // S, (a.height + S - 1) // S
        a = a.resize((w, h), Image.BOX)
        px = a.load()
        bits = bytearray((w * h + 7) // 8)
        for y in range(h):
            for x in range(w):
                if px[x, y] > th:
                    i = y * w + x
                    bits[i >> 3] |= 1 << (i & 7)
        out[n] = {'w': w, 'h': h, 'd': base64.b64encode(bytes(bits)).decode()}

with open(os.path.join(HERE, 'hitmask.js'), 'w', encoding='utf-8') as f:
    f.write('/* 由 make_hitmask.py 生成，不要手改。HIT_MASK：主页图层的点击遮罩（1/2 尺寸，按位存） */\n')
    f.write('window.HIT_MASK = ' + json.dumps({'s': S, 'm': out}, separators=(',', ':')) + ';\n')
print('ok', len(out), os.path.getsize(os.path.join(HERE, 'hitmask.js')))
