# Stellarium EPH 星表格式

本项目使用 `data-src/stellarium-stars/{stars,stars-base}` 中的 2020-02-05 版本。
文件和整数均为小端序。

- 文件头是 ASCII `EPHE`，随后为 `uint32 version`（本数据为 2）。
- 余下内容是 8 字节对齐的块：四字节 ASCII 类型、`uint32` 负载长度和负载。
- 首块为 `JSON`，内容含 `children_mask`；其后为一个 `STAR` 块。
- `STAR` 负载开头依次为版本、头尺寸、标志、表数、记录尺寸、列数和记录数，均为
  `uint32`。本数据每条记录 340 字节、14 列。
- 每个 20 字节列描述符含四字节列名、单字节类型、三字节编码参数、记录内偏移和列宽。
  已确认列为 `gaia, hip, types, vmag, ra, de, pra, pde, plx, epoc, rv, bv, ids, specs`。
- 列描述符后为未压缩尺寸、压缩尺寸和 RFC 1950 zlib 数据。解压后的表按声明的记录尺寸
  还原；`ra/de` 为 ICRS 弧度方向，`plx` 为毫角秒。编码参数分别控制量化字段的还原。

第三期构建只提取原 Gaia DR3-best 缺少的 38 个 HIP。正视差转为 `1000 / plx` pc，零或
无效视差记为 `unknown`，在三维宣夜层按 1000 pc 示意；其方向仍可用于浑天和盖天投影。

## DSO HiPS

`data-src/stellarium-dso/` 使用同样的 `EPHE` 容器，数据块标记为 `DSO `、版本为 3。
表头声明每条逻辑记录为 320 字节，10 列；解压后的数据按字节平面转置存放，即某字段第
`b` 字节、第 `i` 行位于 `(fieldOffset + b) * rowCount + i`，而不是逐行连续排列。

| 列 | 类型 | 含义 |
|---|---|---|
| `type` | 4 字节文本 | Stellarium DSO 类型，如 G、OpC、GlC、HII |
| `vmag` / `bmag` | float32 | V/B 视星等；0 表示未载 |
| `ra` / `de` | float32 | J2000 赤经、赤纬，弧度 |
| `smax` / `smin` | float32 | 视长轴、短轴，弧度 |
| `angl` | float32 | 主轴位置角，弧度 |
| `morp` | 32 字节文本 | 形态分类 |
| `ids` | 256 字节文本 | 以 `|` 分隔的名称和目录编号 |

第九期从 Norder0 的 12 个完整基像素解出 9,032 条记录；Norder1 是其中有子节点区域的细分，
不与 Norder0 重复叠加。浏览器使用精简后的坐标、类型、星等、形态和常用编号，不运行 zlib。
