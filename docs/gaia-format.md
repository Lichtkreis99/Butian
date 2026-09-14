# Gaia Sky `particles_000000.bin` v3 format

The file is big-endian. Its 12-byte header is three signed 32-bit integers: marker `-1`,
format version `3`, and record count `646400`. It is followed immediately by variable-length
records. Each record has an 80-byte fixed part followed by `nameLength` UTF-16BE code units.
Walking records with this layout ends at byte `54,012,094`, exactly the file size.

| Relative byte | Type | Meaning |
|---:|---|---|
| 0 | `float64[3]` | Gaia Sky Cartesian position `(x, y, z)` |
| 24 | `float32[3]` | Cartesian space velocity `(vx, vy, vz)` |
| 36 | `float32` | proper motion in right ascension |
| 40 | `float32` | proper motion in declination |
| 44 | `float32` | radial velocity; frequently NaN in Hipparcos records |
| 48 | `float32` | apparent magnitude |
| 52 | `float32` | absolute magnitude |
| 56 | `uint32` | packed ABGR colour (`R` is the least-significant byte) |
| 60 | `uint64` | internal/catalog identifier |
| 68 | `uint64` | source identifier; for untouched Hipparcos rows it may equal HIP |
| 76 | `int32` | number of UTF-16BE code units in the following name string |
| 80 | `uint16[]` | pipe-separated names, including `HIP n` when a HIP ID exists |

The position unit is Gaia Sky's `1 u = 10^9 m`; velocity uses the same unit per Julian year.
The Cartesian axes are `x = r cos(dec) sin(ra)`, `y = r sin(dec)`, and
`z = r cos(dec) cos(ra)`. Thus conventional J2000 equatorial `(X, Y, Z)` is Gaia
`(z, x, y)`. The build rotates that vector with astronomy-engine's `Rotation_EQJ_ECL()` and
stores positions in parsecs and velocities in parsecs/year. The application maps astronomical
ecliptic `(x, y, z)` to three.js `(x, z, -y)`, so three.js `+y` is ecliptic north. All such
axis changes live in `src/lib/coordinates.ts`.

The source is epoch 2016.0 but its orientation is the inertial ICRS/J2000 frame. The five
acceptance stars reproduce their expected ICRS coordinates and distances after applying the
axis convention above. HIP is parsed from the name field, not blindly read from either 64-bit
identifier: Gaia-source rows use those slots for large catalog IDs.

The Phase 1 selection contains every source record tagged with a HIP name plus every record at
apparent magnitude 8.5 or brighter. The input binary contains no record for 38 HIP vertices used
by Stellarium's Chinese asterism lines. The generator records those IDs in the skyculture payload
and removes only those unavailable vertices; every HIP referenced by generated linework therefore
has a corresponding real catalog record.
