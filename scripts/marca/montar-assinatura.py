"""Monta a assinatura "Renovação Carismática Católica — Arquidiocese de Cuiabá" a partir dos VETORES OFICIAIS do
Manual de Identidade Visual da RCC (extraídos do PDF para docs/marca-referencia/ por scripts/marca-pdf2svg.py).

O que muda em relação à arte oficial: SOMENTE o nome da instância ("Brasil" → "Arquidiocese de Cuiabá"), seguindo
as regras do manual. Símbolo, logotipo, cores, proporção e posição são os do arquivo oficial, sem alteração.
  - p. 23 (horizontal): instância alinhada à esquerda com "Renovação Carismática Católica", em Lato Bold a 70%.
    Medido na arte oficial: logotipo = Lato Bold corpo 14,24; "Brasil" = corpo 10,0 (70,2%). Mantido corpo 10,0.
  - p. 24 (vertical): instância centralizada, Lato Bold a 60%, espaçamento normal. A arte "Brasil" usa ~80%;
    seguimos o TEXTO do manual (60% de 12,56 = 7,54) e registramos a divergência em docs/10-design-system.md.
  - p. 20: margem de proteção = largura da barra do "i" do logotipo (0,13 do corpo) em volta de toda a assinatura.
  - p. 22: fundo branco (não aplicar sobre fundo da mesma cor nem sobre grafismos).
Nome com 22 caracteres (< 45): não se aplica a exceção de 60% da p. 23.
Uso: python scripts/marca/montar-assinatura.py   (gera public/marca/assinatura-*.svg)
"""
import base64
import os
import re

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REF = os.path.join(RAIZ, "docs", "marca-referencia")
SAIDA = os.path.join(RAIZ, "public", "marca")
INSTANCIA = "Arquidiocese de Cuiabá"
FONTE = base64.b64encode(open(os.path.join(os.path.dirname(__file__), "lato-bold-latin.woff2"), "rb").read()).decode()
BARRA_I = 0.13  # largura da barra do "i" em Lato Bold, em fração do corpo (medida no navegador)

# Parâmetros medidos nas artes oficiais (unidades do viewBox de cada arquivo).
VERSOES = {
    "horizontal": dict(arquivo="linha-unica-horizontal-brasil.svg", corpo_logo=14.24, corpo=10.0,
                       x=74.8, base=45.1, ancora="start"),           # tinta do "A" em x=74,9 (como o "Brasil")
    "vertical": dict(arquivo="linha-unica-vertical-brasil.svg", corpo_logo=12.56, corpo=round(12.56 * 0.60, 2),
                     x=89.27, base=84.72, ancora="middle"),          # centro do logotipo; topo da instância = topo do "Brasil"
}


def montar(nome, p):
    s = open(os.path.join(REF, p["arquivo"]), encoding="utf-8").read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', s).group(1).split()]
    # remove o último <path> (o nome de instância "Brasil", cor #004058), logo antes do fechamento do grupo
    ult = s.rfind("<path ")
    fim = s.index("/>", ult) + 2
    trecho = s[ult:fim]
    assert 'fill="#004058"' in trecho, "o último elemento não é o nome de instância"
    corpo_svg = s[:ult] + s[fim:]
    m = round(BARRA_I * p["corpo_logo"], 2)  # margem de proteção
    x0, y0, w, h = vb[0] - m, vb[1] - m, vb[2] + 2 * m, vb[3] + 2 * m
    titulo = f"Renovação Carismática Católica — {INSTANCIA}"
    estilo = ("<style>@font-face{font-family:LatoBoldRCC;font-weight:700;"
              f"src:url(data:font/woff2;base64,{FONTE}) format('woff2')}}</style>")
    texto = (f'<text x="{p["x"]}" y="{p["base"]}" text-anchor="{p["ancora"]}" font-family="LatoBoldRCC, Lato, sans-serif" '
             f'font-weight="700" font-size="{p["corpo"]}" fill="#004058">{INSTANCIA}</text>')
    # abre com viewBox ampliado (margem), título acessível, fundo branco e a fonte; fecha com o nome da instância
    abertura = re.search(r"<svg[^>]*>", corpo_svg).group(0)
    nova = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.2f} {y0:.2f} {w:.2f} {h:.2f}" '
            f'width="{w:.2f}" height="{h:.2f}" role="img" aria-label="{titulo}">'
            f"<title>{titulo}</title>{estilo}"
            f'<rect x="{x0:.2f}" y="{y0:.2f}" width="{w:.2f}" height="{h:.2f}" fill="#ffffff"/>')
    corpo_svg = corpo_svg.replace(abertura, nova, 1).replace("</svg>", texto + "</svg>")
    destino = os.path.join(SAIDA, f"assinatura-{nome}.svg")
    open(destino, "w", encoding="utf-8").write(corpo_svg)
    print(f"{destino}: {w:.1f} x {h:.1f} (margem {m}), instância corpo {p['corpo']} = {p['corpo'] / p['corpo_logo']:.0%} do logotipo")


for nome, p in VERSOES.items():
    montar(nome, p)
