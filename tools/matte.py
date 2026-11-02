# 흰 배경 그림에서 캐릭터를 깨끗하게 오려 낸다.
# 1) 가장자리에서 이어진 밝은 영역을 배경으로 (넉넉한 기준)  2) 배경에 닿은 테두리 픽셀은 흰색을 빼내 반투명으로(color-to-alpha)
# 3) 알파를 1px 깎고 살짝 부드럽게
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

def matte(img, thresh=48, grow=3):
    a = np.asarray(img.convert("RGB")).astype(float)
    dist = 255 - a.min(axis=2)                       # 흰색에서 얼마나 먼지
    light = dist < thresh
    lab, _ = ndimage.label(light)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    near = ndimage.binary_dilation(bg, iterations=grow) & ~bg   # 배경 바로 옆 테두리
    alpha = np.ones(dist.shape)
    alpha[bg] = 0
    ca = np.clip(dist / 110.0, 0, 1)                 # 테두리는 흰색 섞인 정도만큼 투명
    alpha[near] = np.minimum(alpha[near], ca[near])
    # 흰색 빼내기: c = (c - (1-a)*255) / a
    out = a.copy()
    m = near & (alpha > 0.02)
    out[m] = (a[m] - (1 - alpha[m, None]) * 255) / alpha[m, None]
    out = np.clip(out, 0, 255)
    al = Image.fromarray((alpha * 255).astype("uint8")).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    res = Image.fromarray(out.astype("uint8")).convert("RGBA"); res.putalpha(al)
    return res
