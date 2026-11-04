"""Optional icon regeneration. Requires Pillow; not used by npm install/build."""
from pathlib import Path
import math
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
scale = 3
size = 512 * scale
base = Image.new('RGBA', (size, size), '#f2f3eb')
for rx, ry, angle, opacity in [(174,132,-24,150),(150,168,22,105),(118,136,-12,160)]:
    layer = Image.new('RGBA', (size, size))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(((256-rx)*scale,(256-ry)*scale,(256+rx)*scale,(256+ry)*scale),outline=(132,157,121,opacity),width=2*scale)
    base.alpha_composite(layer.rotate(-angle,resample=Image.Resampling.BICUBIC))
draw = ImageDraw.Draw(base)
points=[]
for i in range(180):
    angle=i/180*math.tau
    radius=87+5*math.sin(3*angle)+4*math.cos(2*angle)
    points.append(((256+radius*math.cos(angle))*scale,(256+radius*math.sin(angle))*scale))
draw.polygon(points,fill='#a2b593')
draw.ellipse((370*scale,160*scale,386*scale,176*scale),fill='#849d79')
for target in (192,512):
    base.convert('RGB').resize((target,target),Image.Resampling.LANCZOS).save(root/'public'/f'icon-{target}.png',optimize=True)
print('PWA icons generated.')
