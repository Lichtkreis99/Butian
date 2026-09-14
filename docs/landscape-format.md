# Guéreins HiPS landscape format

The packaged landscape uses nested HEALPix tiles with 512 px WebP images. XuanYe ships
`Norder1` and uses `Norder0` as the decode fallback; `Norder2` is intentionally excluded.

Stellarium landscape HiPS is interpreted in the horizontal frame: the HEALPix north pole is
the zenith, longitude zero points south, and positive longitude proceeds toward west. Thus the
local HEALPix axes are +X=south, +Y=west, +Z=zenith. At render time this basis is transformed
to the observer's current J2000 ecliptic frame before applying the active planetarium projection.

Tile surfaces are tessellated before projection, preserving the non-linear shape under
stereographic, perspective, and equidistant-fisheye views. Source alpha remains transparent.
