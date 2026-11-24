# 生成 hitmask.js：主页各图层的透明度遮罩（给 main.js 的点击判断用），以及光束的遮罩图（给彩色流光用）。
# 双击打开 index.html（file://）时浏览器不让读图片像素，所以提前把遮罩算好写进 JS。
# 换了 assets/home2/ 里的图层后重新跑一次：python make_hitmask.py
import base64, io, json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
S = 2   # 遮罩按 1/2 尺寸存
# 入口图层：alpha > 40 算点中；静态布景：alpha > 160 才挡住后面的入口（半透明的光不挡）
HOT = ['board', 'clip', 'task-title', 'task-paper', 'task-line1', 'task-line2', 'task-icon', 'story-bg', 'story-last', 'story-btnbox', 'story-btn', 'story-prog', 'story-cg', 'story-arrow',
       'sub-main', 'sub-side', 'sub-map', 'c-label', 'c-text', 'c-avatar', 'c-coat', 'contact-pen', 'contact-avatar', 'backbar', 'back',
       'settings', 'codex-sign', 'codex-pen', 'statue-r', 'statue-l', 'reddot', 'tag-wiki', 'tag-xiang']
STATIC = ['notice', 'c-panel', 'c-light', 'c-pill1', 'c-pill2', 'c-pattern', 'wall-line', 'platform', 'codex-tri', 'fg', 'rug', 'sofa-shadow', 'menubar', 'menu', 'sofa', 'butler', 'plant', 'rays', 'shine', 'plant2']

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

r = Image.open(os.path.join(HERE, 'rays.png')).convert('RGBA')
r = r.resize((r.width // 2, r.height // 2), Image.LANCZOS)
buf = io.BytesIO(); r.save(buf, 'PNG', optimize=True)
rays = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

with open(os.path.join(HERE, 'hitmask.js'), 'w', encoding='utf-8') as f:
    f.write('/* 由 make_hitmask.py 生成，不要手改。HIT_MASK：主页图层的点击遮罩（1/2 尺寸，按位存）；RAYS_MASK：光束遮罩图 */\n')
    f.write('window.HIT_MASK = ' + json.dumps({'s': S, 'm': out}, separators=(',', ':')) + ';\n')
    f.write('window.RAYS_MASK = "' + rays + '";\n')
print('ok', len(out), os.path.getsize(os.path.join(HERE, 'hitmask.js')))
