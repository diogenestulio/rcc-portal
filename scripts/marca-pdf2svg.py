"""Extrai um Form XObject vetorial do Manual de Identidade Visual da RCC e grava como SVG.
Suporta o necessário para o símbolo: m l c v y h re, f f* (cores CMYK), W W* n (recorte), q Q cm, sh (axial/radial
com Function tipo 3 de subfunções tipo 2) e Do (formulários aninhados).
Cores: CMYK convertido pelos valores RGB que o PRÓPRIO MANUAL indica (pág. 12–14), não por fórmula ingênua."""
import sys
from pypdf import PdfReader
from pypdf.generic import ContentStream

PDF = r"C:\Users\Diógenes Túlio\Documents\RCC - RENOVAÇÃO CARISMÁTICA CATÓLICA\85bec5_0b564e9753de49cabfe8377355a67a94.pdf"

def lerp(a, b, t): return tuple(round(x + (y - x) * t) for x, y in zip(a, b))
def hx(c): return "#%02x%02x%02x" % c
VERDE0, VERDE40 = (0, 144, 73), (0, 96, 54)      # 100/0/100/0 = #009049 ; 100/0/100/40 = #006036
PETROLEO, PRATA, BRANCO = (0, 64, 88), (184, 208, 220), (255, 255, 255)
AM_LARANJA, AM_LIMAO = (253, 200, 0), (253, 250, 0)  # 0/20/100/0 = #fdc800 ; 0/0/100/0 = #fdfa00

def cmyk(c, m, y, k):
    c, m, y, k = (round(float(v), 3) for v in (c, m, y, k))
    if (c, m, y) == (1, 0, 1): return hx(lerp(VERDE0, VERDE40, k / 0.4))
    if (c, m, y, k) == (0, 0.2, 1, 0): return hx(AM_LARANJA)
    if (c, m, y, k) == (0, 0, 1, 0): return hx(AM_LIMAO)
    if m == 0 and y == 0 and c == k and c > 0.5: return hx(lerp(PRATA, PETROLEO, (c - 0.15) / 0.65))  # 80/0/0/80 = petróleo
    if m == 0 and y == 0 and c == k: return hx(lerp(BRANCO, PRATA, c / 0.15))                       # 15/0/0/15 = prata
    r = (1 - c) * (1 - k); g = (1 - m) * (1 - k); b = (1 - y) * (1 - k)
    return hx((round(255 * r), round(255 * g), round(255 * b)))

def stops(fn):
    """Function tipo 3 (subfunções tipo 2, N=1) -> lista de (offset, cor)."""
    f = fn.get_object()
    if f["/FunctionType"] == 2:
        return [(0.0, cmyk(*f["/C0"])), (1.0, cmyk(*f["/C1"]))]
    bounds = [0.0] + [float(b) for b in f["/Bounds"]] + [1.0]
    enc = [float(e) for e in f["/Encode"]]
    out = []
    for i, sub in enumerate(f["/Functions"]):
        s = sub.get_object(); c0, c1 = cmyk(*s["/C0"]), cmyk(*s["/C1"])
        e0, e1 = enc[2 * i], enc[2 * i + 1]
        a, b = (c0 if e0 == 0 else c1), (c1 if e1 == 1 else c0)
        out += [(bounds[i], a), (bounds[i + 1], b)]
    return out

def fmt(v): return ("%.3f" % float(v)).rstrip("0").rstrip(".")

def convert(form, reader):
    defs, body = [], []
    path = []; pending_clip = None
    stack = [{"clip": None, "cm": None, "fill": "#000"}]
    n_id = [0]
    def nid(p): n_id[0] += 1; return f"{p}{n_id[0]}"
    res = form.get("/Resources", {})
    for args, op in ContentStream(form, reader).operations:
        st = stack[-1]
        o = op.decode()
        if o == "q": stack.append(dict(st))
        elif o == "Q": stack.pop()
        elif o == "cm": st["cm"] = [float(a) for a in args]
        elif o == "m": path.append("M" + " ".join(fmt(a) for a in args))
        elif o == "l": path.append("L" + " ".join(fmt(a) for a in args))
        elif o == "c": path.append("C" + " ".join(fmt(a) for a in args))
        elif o == "v": path.append("S" + " ".join(fmt(a) for a in args))  # aproximação (não aparece no símbolo)
        elif o == "y": a = args; path.append("C" + " ".join(fmt(x) for x in (a[0], a[1], a[2], a[3], a[2], a[3])))
        elif o == "h": path.append("Z")
        elif o == "re":
            x, y, w, h = (float(a) for a in args); path.append(f"M{fmt(x)} {fmt(y)}h{fmt(w)}v{fmt(h)}h{fmt(-w)}Z")
        elif o in ("W", "W*"): pending_clip = "evenodd" if o == "W*" else "nonzero"
        elif o in ("n", "f", "f*", "F"):
            d = "".join(path)
            if o != "n":
                attrs = f' fill="{st["fill"]}"' + (' fill-rule="evenodd"' if o == "f*" else "")
                clip = f' clip-path="url(#{st["clip"]})"' if st["clip"] else ""
                body.append(f'<path d="{d}"{attrs}{clip}/>')
            if pending_clip:
                cid = nid("c"); defs.append(f'<clipPath id="{cid}"><path d="{d}" clip-rule="{pending_clip}"/></clipPath>'); st["clip"] = cid
                pending_clip = None
            path = []
        elif o in ("sc", "scn", "k"): st["fill"] = cmyk(*args) if len(args) == 4 else "#000"
        elif o == "rg": st["fill"] = hx(tuple(round(255 * float(a)) for a in args))
        elif o == "g": st["fill"] = hx((round(255 * float(args[0])),) * 3)
        elif o == "sh":
            s = res["/Shading"][args[0]].get_object(); co = [float(c) for c in s["/Coords"]]
            gid = nid("g"); m = st["cm"] or [1, 0, 0, 1, 0, 0]
            tr = f'gradientTransform="matrix({" ".join(fmt(x) for x in m)})"'
            st_xml = "".join(f'<stop offset="{fmt(o2)}" stop-color="{c}"/>' for o2, c in stops(s["/Function"]))
            if s["/ShadingType"] == 2:
                defs.append(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{fmt(co[0])}" y1="{fmt(co[1])}" x2="{fmt(co[2])}" y2="{fmt(co[3])}" {tr}>{st_xml}</linearGradient>')
            else:
                defs.append(f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" fx="{fmt(co[0])}" fy="{fmt(co[1])}" cx="{fmt(co[3])}" cy="{fmt(co[4])}" r="{fmt(co[5])}" {tr}>{st_xml}</radialGradient>')
            bb = [float(b) for b in form["/BBox"]]
            clip = f' clip-path="url(#{st["clip"]})"' if st["clip"] else ""
            body.append(f'<rect x="{fmt(bb[0])}" y="{fmt(bb[1])}" width="{fmt(bb[2]-bb[0])}" height="{fmt(bb[3]-bb[1])}" fill="url(#{gid})"{clip}/>')
        elif o == "Do":
            sub = res["/XObject"][args[0]].get_object(); d2, b2 = convert(sub, reader)
            m = st["cm"] or [1, 0, 0, 1, 0, 0]
            defs += d2; body.append(f'<g transform="matrix({" ".join(fmt(x) for x in m)})">' + "".join(b2) + "</g>")
    return defs, body

def main(page, chain, out):
    r = PdfReader(PDF)
    obj = r.pages[page - 1]
    for name in chain:
        obj = obj["/Resources"]["/XObject"][name].get_object()
    bb = [float(b) for b in obj["/BBox"]]
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    defs, body = convert(obj, r)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w)} {fmt(h)}" width="{fmt(w)}" height="{fmt(h)}">'
           f'<defs>{"".join(defs)}</defs><g transform="matrix(1 0 0 -1 {fmt(-bb[0])} {fmt(bb[3])})">{"".join(body)}</g></svg>')
    open(out, "w", encoding="utf-8").write(svg)
    print(out, len(svg), "bytes", f"{w:.1f}x{h:.1f}")

if __name__ == "__main__":
    page = int(sys.argv[1]); out = sys.argv[-1]; chain = sys.argv[2:-1]
    main(page, chain, out)
