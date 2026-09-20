# -*- coding: utf-8 -*-
"""baseline JPEG の DC 係数だけを取り出して 1/8 の PNG にする。

**依存パッケージを足さない。**この作業環境には画像の道具が一つも無い。
8x8 ブロックの DC は、そのブロックの平均そのものである。だから
DC だけ拾えば 1/8 の縮小になる —— djpeg -scale 1/8 と同じ考えである。

AC は捨てるが、**読み飛ばすには復号が要る**。Huffman は可変長なので、
飛ばすと次のブロックの頭が分からなくなる。
"""
import io, struct, sys, zlib

ZIG = None

def build_huff(bits, vals):
    code, k, table = 0, 0, {}
    for l in range(1, 17):
        for _ in range(bits[l - 1]):
            table[(l, code)] = vals[k]; k += 1; code += 1
        code <<= 1
    return table

class Bits:
    def __init__(self, d, i):
        self.d, self.i, self.b, self.n = d, i, 0, 0
    def bit(self):
        if self.n == 0:
            c = self.d[self.i]; self.i += 1
            if c == 0xFF:
                nxt = self.d[self.i]
                if nxt == 0x00: self.i += 1
                else: return None            # marker
            self.b, self.n = c, 8
        self.n -= 1
        return (self.b >> self.n) & 1
    def recv(self, s):
        v = 0
        for _ in range(s):
            bit = self.bit()
            if bit is None: return v
            v = (v << 1) | bit
        return v
    def decode(self, tbl):
        code, l = 0, 0
        while l < 16:
            bit = self.bit()
            if bit is None: return 0
            code = (code << 1) | bit; l += 1
            if (l, code) in tbl: return tbl[(l, code)]
        return 0
    def align(self):
        self.n = 0

def extend(v, s):
    return v - (1 << s) + 1 if s and v < (1 << (s - 1)) else v

def dc_planes(path):
    d = io.open(path, 'rb').read()
    qt, hts, comps, W, H, ri = {}, {}, [], 0, 0, 0
    i = 2
    while i < len(d) - 1:
        if d[i] != 0xFF: i += 1; continue
        m = d[i + 1]
        if m in (0xD8, 0xD9): i += 2; continue
        ln = struct.unpack('>H', d[i + 2:i + 4])[0]
        seg = d[i + 4:i + 2 + ln]
        if m == 0xDB:
            p = 0
            while p < len(seg):
                pq, tq = seg[p] >> 4, seg[p] & 15; p += 1
                n = 128 if pq else 64
                qt[tq] = list(struct.unpack('>64H', seg[p:p + 128])) if pq else list(seg[p:p + 64])
                p += n
        elif m == 0xC0 or m == 0xC1:
            H, W = struct.unpack('>HH', seg[1:5])
            n = seg[5]
            comps = [{'id': seg[6 + j * 3], 'h': seg[7 + j * 3] >> 4,
                      'v': seg[7 + j * 3] & 15, 'tq': seg[8 + j * 3]} for j in range(n)]
        elif m == 0xC2:
            raise SystemExit('progressive JPEG —— この縮小器では扱えない')
        elif m == 0xC4:
            p = 0
            while p < len(seg):
                tc, th = seg[p] >> 4, seg[p] & 15; p += 1
                bits = list(seg[p:p + 16]); p += 16
                cnt = sum(bits); vals = list(seg[p:p + cnt]); p += cnt
                hts[(tc, th)] = build_huff(bits, vals)
        elif m == 0xDD:
            ri = struct.unpack('>H', seg[0:2])[0]
        elif m == 0xDA:
            ns = seg[0]
            for j in range(ns):
                cid, t = seg[1 + j * 2], seg[2 + j * 2]
                for c in comps:
                    if c['id'] == cid: c['dc'], c['ac'] = t >> 4, t & 15
            return scan(d, i + 2 + ln, comps, qt, hts, W, H, ri)
        i += 2 + ln
    raise SystemExit('SOS が無い')

def scan(d, i, comps, qt, hts, W, H, ri):
    hmax = max(c['h'] for c in comps); vmax = max(c['v'] for c in comps)
    mcux = (W + 8 * hmax - 1) // (8 * hmax)
    mcuy = (H + 8 * vmax - 1) // (8 * vmax)
    for c in comps:
        c['w'] = mcux * c['h']; c['hgt'] = mcuy * c['v']
        c['p'] = [0] * (c['w'] * c['hgt']); c['pred'] = 0
    br = Bits(d, i); n = 0
    for my in range(mcuy):
        for mx in range(mcux):
            if ri and n and n % ri == 0:
                br.align()
                while br.i < len(d) - 1 and not (d[br.i] == 0xFF and 0xD0 <= d[br.i + 1] <= 0xD7):
                    br.i += 1
                br.i += 2
                for c in comps: c['pred'] = 0
            n += 1
            for c in comps:
                for by in range(c['v']):
                    for bx in range(c['h']):
                        s = br.decode(hts[(0, c['dc'])])
                        c['pred'] += extend(br.recv(s), s) if s else 0
                        k = 1
                        while k < 64:                      # AC は捨てるが復号は要る
                            rs = br.decode(hts[(1, c['ac'])])
                            r, s2 = rs >> 4, rs & 15
                            if s2 == 0:
                                if r == 15: k += 16; continue
                                break
                            k += r; br.recv(s2); k += 1
                        x, y = mx * c['h'] + bx, my * c['v'] + by
                        val = c['pred'] * qt[c['tq']][0] / 8.0 + 128.0
                        c['p'][y * c['w'] + x] = 0 if val < 0 else (255 if val > 255 else int(val))
    return comps, (W + 7) // 8, (H + 7) // 8, hmax, vmax

def png(path, w, h, rgb):
    raw = bytearray()
    for y in range(h):
        row = rgb[y * w * 3:(y + 1) * w * 3]
        best, bf = None, 0
        for f in (0, 1, 2):
            if f == 0: cand = bytes(row)
            elif f == 1:
                cand = bytes((row[k] - (row[k - 3] if k >= 3 else 0)) & 255 for k in range(len(row)))
            else:
                prev = rgb[(y - 1) * w * 3:y * w * 3] if y else bytes(len(row))
                cand = bytes((row[k] - prev[k]) & 255 for k in range(len(row)))
            if best is None or sum(min(b, 256 - b) for b in cand) < sum(min(b, 256 - b) for b in best):
                best, bf = cand, f
        raw.append(bf); raw += best
    def chunk(t, b):
        return struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xFFFFFFFF)
    out = b'\x89PNG\r\n\x1a\n'
    out += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    out += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    out += chunk(b'IEND', b'')
    io.open(path, 'wb').write(out)

src, dst = sys.argv[1], sys.argv[2]
comps, w, h, hmax, vmax = dc_planes(src)
Y, Cb, Cr = comps[0], comps[1], comps[2]
rgb = bytearray(w * h * 3)
for y in range(h):
    for x in range(w):
        yy = Y['p'][min(y, Y['hgt'] - 1) * Y['w'] + min(x, Y['w'] - 1)]
        cx, cy = x * Cb['h'] // hmax, y * Cb['v'] // vmax
        cb = Cb['p'][min(cy, Cb['hgt'] - 1) * Cb['w'] + min(cx, Cb['w'] - 1)] - 128
        cr = Cr['p'][min(cy, Cr['hgt'] - 1) * Cr['w'] + min(cx, Cr['w'] - 1)] - 128
        r = yy + 1.402 * cr; g = yy - 0.344136 * cb - 0.714136 * cr; b = yy + 1.772 * cb
        o = (y * w + x) * 3
        for k, v in enumerate((r, g, b)):
            rgb[o + k] = 0 if v < 0 else (255 if v > 255 else int(v))
png(dst, w, h, rgb)
print('%s -> %s  %dx%d' % (src, dst, w, h))
