import type { PillarDetail } from "./pcbz/bazi";
import type { RelationConnection } from "./pcbz/fortune";

export type RelationType = "combine" | "clash" | "punish" | "harm" | "break" |
  "overcome" | "meeting" | "other";

export const RELATION_TYPE_LABELS: Readonly<Record<RelationType, string>> = {
  combine: "合／拱／暗合",
  clash: "冲",
  punish: "刑",
  harm: "害",
  break: "破",
  overcome: "克",
  meeting: "会",
  other: "其他",
};

export function relationType(label: string): RelationType {
  if (label.includes("冲")) return "clash";
  if (label.includes("刑")) return "punish";
  if (label.includes("害")) return "harm";
  if (label.includes("破")) return "break";
  if (label.includes("克")) return "overcome";
  if (label.includes("会")) return "meeting";
  if (label.includes("合")) return "combine";
  return "other";
}

export interface RelationDiagramRow {
  connection: RelationConnection;
  type: RelationType;
  y: number;
  left: number;
  right: number;
}

export interface RelationDiagramLayout {
  width: number;
  height: number;
  pillarTop: number;
  earthTop: number;
  x: number[];
  rows: RelationDiagramRow[];
}

export function layoutRelations(
  columns: PillarDetail[],
  connections: RelationConnection[],
): RelationDiagramLayout {
  const width = 440;
  const heaven = connections.filter((item) => item.kind === "heaven");
  const earth = connections.filter((item) => item.kind === "earth");
  const rowHeight = 28;
  const pillarHeight = 102;
  const pillarTop = Math.max(heaven.length, 1) * rowHeight + 10;
  const earthTop = pillarTop + pillarHeight;
  const height = earthTop + Math.max(earth.length, 1) * rowHeight + 18;
  const x = columns.map((_, index) => (index + 0.5) * width / columns.length);
  const makeRows = (items: RelationConnection[], top: number) => items.map(
    (connection, index): RelationDiagramRow => {
      const indices = [...connection.columnIndices].sort((a, b) => a - b);
      return {
        connection,
        type: relationType(connection.relation),
        y: top + index * rowHeight + 18,
        left: x[indices[0]!]!,
        right: x[indices.at(-1)!]!,
      };
    },
  );
  return {
    width,
    height,
    pillarTop,
    earthTop,
    x,
    rows: [...makeRows(heaven, 0), ...makeRows(earth, earthTop)],
  };
}
