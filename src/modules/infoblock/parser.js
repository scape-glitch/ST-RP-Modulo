import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'scene_state', null);
  if (!data) return null;
  return {
    dateTime: data.dateTime || data.date_time || '',
    location: data.location || '',
    globalConflict: data.globalConflict || data.global_conflict || '',
    characters: Array.isArray(data.characters) ? data.characters : [],
    keyDetail: data.keyDetail || data.key_detail || '',
    plotSummary: data.plotSummary || data.plot_summary || '',
    futurePlot: data.futurePlot || data.future_plot || '',
  };
}