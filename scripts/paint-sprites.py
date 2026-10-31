"""Crisp 8-bit room sprites. Limited warm palette, adult proportions, real alpha."""

from pathlib import Path
from PIL import Image

OUT = Path("/workspace/public/assets")
ROOM = OUT / "room"
ROOM.mkdir(parents=True, exist_ok=True)

# Muted, grown-up, still warm.
C = {
    ".": None,
    "K": (46, 40, 36),
    "A": (92, 62, 44),
    "a": (122, 86, 62),
    "T": (224, 190, 162),
    "t": (186, 146, 116),
    "H": (232, 222, 206),
    "h": (196, 176, 156),
    "F": (92, 68, 50),
    "f": (68, 48, 36),
    "W": (58, 42, 32),
    "B": (122, 72, 64),
    "P": (255, 250, 244),
    "G": (176, 140, 78),
    "g": (122, 90, 48),
    "S": (104, 132, 108),
    "s": (70, 96, 74),
    "R": (154, 92, 86),
    "r": (120, 68, 64),
    "N": (62, 66, 74),
    "n": (40, 42, 48),
    "Y": (236, 226, 210),
    "Z": (196, 176, 148),
    "D": (168, 86, 74),
}


def blank(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def px(im, x, y, color):
    if color is None:
        return
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), (*color, 255))


def fill(im, x, y, w, h, color):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            px(im, xx, yy, color)


def stamp(rows, palette=None):
    palette = palette or C
    w = max(len(row) for row in rows)
    im = blank(w, len(rows))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            px(im, x, y, palette.get(ch, C.get(ch)))
    return im


def scale(im, n):
    return im.resize((im.width * n, im.height * n), Image.Resampling.NEAREST)


def save(im, path, n=4):
    scale(im, n).save(path)
    print(path.name, im.size)


def reader(sweater, shadow, book):
    im = blank(36, 68)
    skin = (224, 190, 162)
    shade = (186, 146, 116)
    hair = (84, 56, 40)
    hair_l = (118, 82, 58)
    pants = (78, 58, 44)
    shoe = (52, 38, 30)
    page = (255, 250, 244)
    ink = (46, 40, 36)
    # hair mass, jaw-length, not a balloon
    fill(im, 10, 2, 16, 18, hair)
    fill(im, 12, 4, 12, 12, skin)
    fill(im, 10, 2, 16, 5, hair)
    fill(im, 10, 7, 3, 6, hair)
    fill(im, 23, 7, 3, 5, hair)
    fill(im, 14, 3, 4, 2, hair_l)
    # ear
    fill(im, 23, 11, 2, 3, shade)
    # eyes, small
    fill(im, 14, 10, 2, 2, ink)
    fill(im, 20, 10, 2, 2, ink)
    px(im, 14, 10, (244, 236, 220))
    px(im, 20, 10, (244, 236, 220))
    px(im, 17, 13, shade)
    fill(im, 16, 15, 3, 1, (154, 100, 92))
    # neck
    fill(im, 15, 18, 6, 3, skin)
    # sweater
    fill(im, 9, 21, 18, 16, sweater)
    fill(im, 9, 21, 18, 2, shadow)
    fill(im, 9, 35, 18, 2, shadow)
    # sleeves
    fill(im, 5, 22, 5, 13, sweater)
    fill(im, 26, 22, 5, 13, sweater)
    fill(im, 5, 22, 5, 2, shadow)
    fill(im, 26, 22, 5, 2, shadow)
    # hands
    fill(im, 5, 34, 4, 3, skin)
    fill(im, 27, 34, 4, 3, skin)
    # book in the right hand, beside the hip
    fill(im, 28, 30, 7, 10, book)
    fill(im, 29, 31, 2, 8, page)
    fill(im, 29, 33, 2, 1, ink)
    fill(im, 29, 36, 2, 1, ink)
    # collar notch
    fill(im, 16, 21, 4, 2, skin)
    # legs
    fill(im, 11, 37, 6, 20, pants)
    fill(im, 19, 37, 6, 20, pants)
    fill(im, 11, 37, 1, 20, (62, 46, 34))
    # shoes
    fill(im, 10, 56, 8, 4, shoe)
    fill(im, 18, 56, 8, 4, shoe)
    fill(im, 10, 59, 8, 2, (36, 28, 22))
    fill(im, 18, 59, 8, 2, (36, 28, 22))
    return im


def chair(cloth, cloth_dk, wood):
    im = blank(52, 48)
    fill(im, 18, 4, 4, 22, wood)
    fill(im, 36, 4, 4, 22, wood)
    fill(im, 22, 6, 14, 18, cloth)
    fill(im, 22, 6, 14, 3, cloth_dk)
    fill(im, 14, 22, 30, 8, cloth)
    fill(im, 14, 28, 30, 2, cloth_dk)
    fill(im, 8, 18, 10, 3, cloth)
    fill(im, 8, 21, 10, 3, wood)
    fill(im, 16, 30, 4, 12, wood)
    fill(im, 38, 30, 4, 12, wood)
    fill(im, 14, 41, 8, 3, wood)
    fill(im, 36, 41, 8, 3, wood)
    return im


def clock_round(bezel, face, tick):
    im = blank(32, 32)
    cx = cy = 15
    for y in range(32):
        for x in range(32):
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d <= 15 * 15:
                im.putpixel((x, y), (*bezel, 255))
            if d <= 12 * 12:
                im.putpixel((x, y), (*face, 255))
    for x, y in ((15, 4), (15, 26), (4, 15), (26, 15), (8, 8), (22, 8), (8, 22), (22, 22)):
        px(im, x, y, tick)
        px(im, x, y + (1 if y < 16 else -1) if x == 15 else y, tick)
    return im


def clock_square(bezel, face, tick):
    im = blank(32, 32)
    fill(im, 1, 1, 30, 30, bezel)
    fill(im, 4, 4, 24, 24, face)
    for x, y in ((15, 6), (15, 24), (6, 15), (24, 15)):
        px(im, x, y, tick)
        px(im, x + 1, y, tick)
    return im


def clock_mantel(bezel, face, tick):
    im = clock_square(bezel, face, tick)
    fill(im, 6, 28, 20, 3, bezel)
    fill(im, 4, 30, 24, 2, bezel)
    return im


def lamp_brass():
    im = blank(28, 36)
    shade = (236, 224, 196)
    brass = (176, 140, 78)
    dark = (122, 90, 48)
    fill(im, 4, 4, 20, 10, shade)
    fill(im, 4, 4, 20, 2, (214, 196, 160))
    fill(im, 12, 0, 4, 4, brass)
    fill(im, 13, 14, 2, 14, dark)
    fill(im, 10, 18, 8, 2, brass)
    fill(im, 6, 28, 16, 3, brass)
    fill(im, 4, 31, 20, 3, dark)
    return im


def lamp_lantern():
    im = blank(28, 40)
    paper = (226, 186, 146)
    rim = (160, 112, 74)
    wood = (90, 62, 42)
    fill(im, 13, 0, 2, 5, wood)
    fill(im, 8, 5, 12, 3, rim)
    fill(im, 6, 8, 16, 16, paper)
    fill(im, 8, 12, 12, 1, (244, 220, 186))
    fill(im, 8, 18, 12, 1, (244, 220, 186))
    fill(im, 8, 24, 12, 3, rim)
    fill(im, 12, 27, 4, 8, wood)
    return im


def lamp_green():
    im = blank(28, 36)
    shade = (70, 96, 74)
    brass = (90, 78, 58)
    fill(im, 2, 2, 24, 8, shade)
    fill(im, 2, 8, 24, 3, (48, 70, 52))
    fill(im, 13, 11, 2, 16, brass)
    fill(im, 8, 27, 12, 3, brass)
    fill(im, 6, 30, 16, 3, (58, 48, 36))
    return im


def wand():
    im = blank(24, 48)
    wood = (132, 96, 62)
    dark = (78, 54, 36)
    brass = (176, 140, 78)
    for i in range(32):
        x = 8 + i // 12
        fill(im, x, 8 + i, 3, 1, wood if i % 5 else dark)
    fill(im, 7, 4, 5, 4, brass)
    fill(im, 8, 2, 3, 2, (210, 180, 110))
    fill(im, 9, 38, 4, 3, dark)
    return im


def boat():
    im = blank(40, 32)
    paper = (244, 236, 220)
    line = (90, 68, 48)
    fill(im, 8, 18, 24, 6, paper)
    fill(im, 4, 22, 32, 4, line)
    fill(im, 10, 18, 20, 2, (220, 206, 184))
    fill(im, 18, 6, 2, 14, line)
    for i in range(10):
        fill(im, 20, 7 + i, 10 - i, 1, paper)
    fill(im, 20, 7, 10, 1, line)
    return im


def knife():
    im = blank(44, 18)
    blade = (214, 210, 202)
    edge = (140, 138, 132)
    handle = (74, 50, 36)
    brass = (160, 124, 70)
    fill(im, 2, 6, 24, 4, blade)
    fill(im, 2, 9, 24, 1, edge)
    px(im, 1, 7, blade)
    px(im, 0, 8, blade)
    fill(im, 24, 5, 3, 6, brass)
    fill(im, 27, 6, 14, 5, handle)
    fill(im, 29, 8, 8, 1, (122, 90, 58))
    px(im, 4, 5, (140, 72, 66))
    return im


def rye():
    im = blank(40, 28)
    loaf = (186, 140, 78)
    crust = (132, 92, 48)
    net = (74, 56, 40)
    for y in range(28):
        for x in range(40):
            nx = (x - 20) / 15
            ny = (y - 15) / 8
            if nx * nx + ny * ny <= 1:
                im.putpixel((x, y), (*(crust if ny < -0.45 or ny > 0.55 else loaf), 255))
    for i in range(-12, 13, 6):
        for y in range(8, 23):
            px(im, 20 + i, y, net)
    for y in (12, 16, 20):
        for x in range(8, 33):
            px(im, x, y, net)
    return im


def key():
    im = blank(36, 20)
    gold = (186, 150, 78)
    dark = (122, 90, 48)
    for y in range(20):
        for x in range(20):
            d = (x - 7) ** 2 + (y - 7) ** 2
            if 12 <= d <= 28:
                px(im, x, y, gold)
    fill(im, 14, 6, 16, 3, gold)
    fill(im, 26, 9, 3, 4, dark)
    fill(im, 30, 9, 3, 6, gold)
    return im


def window():
    im = blank(48, 64)
    frame = (110, 78, 52)
    glass = (186, 206, 196)
    sky = (214, 196, 170)
    leaf = (90, 120, 86)
    fill(im, 4, 4, 40, 52, frame)
    fill(im, 8, 8, 32, 44, sky)
    fill(im, 8, 28, 32, 24, leaf)
    fill(im, 8, 8, 32, 14, glass)
    fill(im, 22, 8, 3, 44, frame)
    fill(im, 8, 28, 32, 3, frame)
    fill(im, 2, 52, 44, 4, frame)
    return im


def tile_floor(kind):
    im = blank(32, 16)
    if kind == "oak":
        fill(im, 0, 0, 32, 16, (196, 164, 116))
        fill(im, 0, 0, 1, 16, (150, 116, 74))
        fill(im, 16, 0, 1, 16, (168, 132, 88))
    elif kind == "tile":
        fill(im, 0, 0, 32, 16, (214, 186, 156))
        fill(im, 0, 0, 32, 1, (168, 140, 112))
        fill(im, 0, 0, 1, 16, (168, 140, 112))
    elif kind == "herring":
        fill(im, 0, 0, 32, 16, (188, 152, 104))
        for i in range(0, 32, 8):
            fill(im, i, 0, 1, 8, (140, 104, 66))
            fill(im, i + 4, 8, 1, 8, (140, 104, 66))
    elif kind == "stone":
        fill(im, 0, 0, 32, 16, (186, 180, 170))
        fill(im, 0, 0, 32, 1, (150, 144, 136))
        fill(im, 0, 0, 1, 16, (150, 144, 136))
    else:
        fill(im, 0, 0, 32, 16, (214, 196, 160))
        fill(im, 0, 7, 32, 1, (176, 140, 78))
        fill(im, 0, 0, 1, 16, (150, 116, 74))
    return im


def tile_wall(kind):
    im = blank(32, 32)
    if kind == "plaster":
        fill(im, 0, 0, 32, 32, (236, 226, 210))
        for x, y in ((4, 6), (18, 14), (10, 22), (26, 8)):
            px(im, x, y, (220, 206, 186))
    elif kind == "sage":
        fill(im, 0, 0, 32, 32, (196, 206, 190))
        for x, y in ((6, 8), (20, 18), (12, 26)):
            px(im, x, y, (176, 190, 172))
    elif kind == "stripe":
        fill(im, 0, 0, 32, 32, (234, 224, 208))
        fill(im, 0, 0, 2, 32, (176, 122, 100))
    elif kind == "brick":
        fill(im, 0, 0, 32, 32, (176, 140, 112))
        fill(im, 0, 0, 32, 2, (150, 116, 96))
        fill(im, 0, 16, 32, 2, (150, 116, 96))
        fill(im, 0, 0, 2, 16, (150, 116, 96))
        fill(im, 16, 16, 2, 16, (150, 116, 96))
    else:
        fill(im, 0, 0, 32, 32, (232, 220, 196))
        fill(im, 14, 14, 4, 4, (186, 150, 78))
    return im


def rug(field, border):
    im = blank(64, 28)
    fill(im, 2, 2, 60, 24, border)
    fill(im, 6, 5, 52, 18, field)
    fill(im, 10, 8, 44, 12, border)
    fill(im, 14, 11, 36, 6, field)
    return im


def shelf_thumb(board, edge, panel):
    im = blank(48, 36)
    fill(im, 0, 0, 48, 36, edge)
    fill(im, 4, 4, 40, 28, panel)
    fill(im, 4, 14, 40, 3, board)
    fill(im, 4, 26, 40, 3, board)
    fill(im, 8, 6, 8, 8, (122, 72, 64))
    fill(im, 18, 7, 7, 7, (70, 96, 74))
    fill(im, 8, 18, 8, 8, (90, 70, 52))
    return im


def main():
    save(reader((232, 222, 206), (196, 176, 156), (122, 72, 64)), OUT / "reader-oatmeal.png")
    save(reader((176, 132, 128), (140, 96, 96), (90, 62, 58)), OUT / "reader-berry.png")
    save(reader((120, 148, 118), (78, 108, 82), (70, 86, 110)), OUT / "reader-sage.png")

    save(chair((214, 198, 176), (176, 156, 134), (110, 78, 52)), ROOM / "chair-oatmeal.png")
    save(chair((176, 132, 128), (140, 96, 96), (90, 62, 48)), ROOM / "chair-berry.png")
    save(chair((120, 148, 118), (78, 108, 82), (70, 58, 42)), ROOM / "chair-sage.png")
    save(chair((62, 58, 54), (40, 38, 36), (32, 28, 26)), ROOM / "chair-ink.png")
    save(chair((236, 226, 204), (196, 176, 140), (176, 140, 78)), ROOM / "chair-gilt.png")

    paper = (244, 236, 220)
    ink = (46, 40, 36)
    save(clock_round((150, 116, 78), paper, ink), ROOM / "clock-round.png")
    save(clock_square((110, 78, 52), paper, ink), ROOM / "clock-school.png")
    save(clock_mantel((90, 62, 42), paper, ink), ROOM / "clock-mantel.png")
    save(clock_round((40, 42, 48), (62, 66, 74), (220, 210, 196)), ROOM / "clock-night.png")
    save(clock_round((186, 150, 78), (255, 248, 230), (90, 62, 36)), ROOM / "clock-gilt.png")

    save(lamp_brass(), ROOM / "lamp-brass.png")
    save(lamp_lantern(), ROOM / "lamp-lantern.png")
    save(lamp_green(), ROOM / "lamp-green.png")

    save(wand(), ROOM / "souvenir-wand.png")
    save(boat(), ROOM / "souvenir-boat.png")
    save(knife(), ROOM / "souvenir-knife.png")
    save(rye(), ROOM / "souvenir-rye.png")
    save(key(), ROOM / "souvenir-key.png")
    save(window(), ROOM / "window.png", 3)

    for name in ("oak", "tile", "herring", "stone", "gilt"):
        save(tile_floor(name), ROOM / f"floor-{name}.png", 2)
    for name in ("plaster", "sage", "stripe", "brick", "gilt"):
        save(tile_wall(name), ROOM / f"wall-{name}.png", 2)
    save(rug((230, 220, 204), (176, 140, 110)), ROOM / "rug-cream.png", 2)
    save(rug((140, 164, 140), (70, 96, 74)), ROOM / "rug-sage.png", 2)
    save(rug((196, 156, 148), (140, 84, 76)), ROOM / "rug-berry.png", 2)
    save(rug((62, 58, 54), (220, 210, 196)), ROOM / "rug-ink.png", 2)
    save(rug((236, 226, 204), (176, 140, 78)), ROOM / "rug-gilt.png", 2)

    save(shelf_thumb((196, 150, 96), (110, 72, 42), (244, 228, 204)), ROOM / "shelf-honey.png", 2)
    save(shelf_thumb((110, 72, 42), (62, 40, 24), (226, 204, 176)), ROOM / "shelf-walnut.png", 2)
    save(shelf_thumb((120, 148, 118), (62, 90, 68), (236, 226, 204)), ROOM / "shelf-sage.png", 2)
    save(shelf_thumb((58, 52, 46), (32, 28, 26), (226, 216, 200)), ROOM / "shelf-ink.png", 2)
    save(shelf_thumb((196, 160, 90), (122, 90, 40), (255, 246, 226)), ROOM / "shelf-gilt.png", 2)


if __name__ == "__main__":
    main()
