"""Estilos visuais compartilhados pelas pautas: página A4 preto e branco,
uma única página, sem elementos decorativos — conforme padrão fixo da
Casa Timoni para reuniões de equipe.
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Flowable, TableStyle

PAGE_SIZE = A4
MARGEM_TOPO = 1.6 * cm
MARGEM_BASE = 1.6 * cm
MARGEM_LATERAL = 2.2 * cm

TITULO_DOCUMENTO = ParagraphStyle(
    name='TituloDocumento',
    fontName='Helvetica-Bold',
    fontSize=18,
    leading=22,
    spaceAfter=4,
    alignment=1,  # centralizado
)

SUBTITULO_DOCUMENTO = ParagraphStyle(
    name='SubtituloDocumento',
    fontName='Helvetica',
    fontSize=12,
    leading=16,
    spaceAfter=18,
    alignment=1,
    textColor=colors.HexColor('#333333'),
)

TITULO_SECAO = ParagraphStyle(
    name='TituloSecao',
    fontName='Helvetica-Bold',
    fontSize=14,
    leading=17,
    spaceBefore=26,
    spaceAfter=10,
)

CORPO = ParagraphStyle(
    name='Corpo',
    fontName='Helvetica',
    fontSize=12,
    leading=19,
    spaceAfter=10,
)

ABERTURA = ParagraphStyle(
    name='Abertura',
    fontName='Helvetica-Bold',
    fontSize=12,
    leading=19,
    spaceAfter=10,
)

BULLET = ParagraphStyle(
    name='Bullet',
    parent=CORPO,
    leftIndent=14,
    bulletIndent=0,
    spaceAfter=6,
)


class CenterWrapper(Flowable):
    """Centraliza horizontalmente um flowable (ex: tabela) que é mais
    estreito que a largura útil da página."""

    def __init__(self, flowable):
        Flowable.__init__(self)
        self._flowable = flowable
        self._inner_width = 0
        self.width = 0
        self.height = 0

    def wrap(self, avail_width, avail_height):
        inner_width, inner_height = self._flowable.wrap(avail_width, avail_height)
        self._inner_width = inner_width
        self.width = avail_width
        self.height = inner_height
        return self.width, self.height

    def draw(self):
        x = max(0, (self.width - self._inner_width) / 2.0)
        self.canv.saveState()
        self.canv.translate(x, 0)
        self._flowable.drawOn(self.canv, 0, 0)
        self.canv.restoreState()


def tabela_style(num_linhas):
    """TableStyle padrão: cabeçalho preto/texto branco, linhas alternadas
    em cinza claro, grade fina — tudo em tons de cinza (documento P&B)."""
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.black),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, num_linhas):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f0f0f0')))
    return TableStyle(style)
