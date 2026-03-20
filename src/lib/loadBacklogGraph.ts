export {
  BACKLOG_GRAPH_COLUMNS,
  parseBacklogGraphCsv,
  type BacklogGraphData,
  type BacklogGraphDetail,
  type BacklogGraphEdge,
  type BacklogGraphNode,
  type BacklogGraphWarning,
  type BacklogGraphWarningCode,
} from '../features/backlogGraph/backlogGraphData';

import {
  loadBacklogGraphFromCsvUrl,
  type BacklogGraphData,
} from '../features/backlogGraph/backlogGraphData';

export async function loadBacklogGraph(): Promise<BacklogGraphData> {
  return loadBacklogGraphFromCsvUrl('/planning/backlog.csv');
}
