# Aizhanxing offline natal-chart engine

`calculateNatalChart(input)` calculates the site's default tropical, geocentric,
apparent natal wheel without network access. `input.timeZone` accepts either an
IANA zone name or a conventional fixed UTC offset in hours: positive values are
east of Greenwich, so the API's `birth_zone: -8` is passed here as `timeZone: 8`.
For fixed offsets, `summer: 1` adds one civil hour. IANA zones use `Intl` historical
rules (including China's 1986-1991 DST); the flag only chooses the DST or standard
occurrence when a clock time is repeated, avoiding double application of DST.

The engine implements all 15 site house-system codes: Placidus (`P`), Koch (`K`),
whole sign (`W`), equal Ascendant (`A`), Alcabitius (`B`), Regiomontanus (`R`),
equal MC (`D`), Morinus (`M`), Porphyry (`O`), Sripati (`S`), topocentric (`T`),
Meridian (`X`), Campanus (`C`), Neo-Porphyry (`L`), and Krusinski-Pisa (`U`). At
latitudes where Placidus or Koch is undefined, the cusps fall back to Porphyry and
the result exposes `houseFallback: "Porphyry"`.

The optional second argument selects the house system, tropical or sidereal zodiac,
ayanamsa, mean or true node, and aspect behavior. Sidereal mode supports Swiss IDs
0-8 and 29 plus custom mode 255. Planets, angles, cusps, signs, and house assignments
all use the selected zodiac, and the result exposes the applied ayanamsa.

The default node is the mean lunar node (`node_true: false`), matching the site's
`settingsBasicCalcs` default. Aspect types and base orbs are the site's modern
defaults: 7° for conjunction; 6° for opposition, trine, square, and sextile;
3° for semisextile, quincunx, semisquare, sesquisquare, and quintile. The
legacy calculation also applies the site's `orbsLight` values as a pair cap (the
mean of the two values): Sun 15°, Moon 12°, Mercury/Venus 7°, Mars 8°,
Jupiter/Saturn 9°, and outer planets/node/angles 5°. The captured backend-default
sample shows the type orb expanded by 1° when the Sun or Moon participates; this
is the only backend behavior not represented as an explicit front-end constant.

When aspect options are supplied, calculation type `0` uses the supplied per-aspect
orbs and type `1` uses the mean of the two supplied planetary light orbs.
`visibleAspectTypes` filters the returned types. Omitting every aspect option
preserves the engine's previous default output exactly.
