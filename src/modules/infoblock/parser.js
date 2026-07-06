import { parseTaggedJSON } from '../../core/jsonRepair.js';

export function parse(messageText) {
  const data = parseTaggedJSON(messageText, 'scene_state', null);
  if (!data) return null;
  const current = data.current || data.scene || data.update || data.state || data;
  return {
    date: current.date || '',
    time: current.time || '',
    dateTime: current.dateTime || current.date_time || '',
    location: current.location || '',
    global_conflict: current.global_conflict || current.globalConflict || '',
    globalConflict: current.globalConflict || current.global_conflict || '',
    characters: Array.isArray(current.characters) ? current.characters : [],
    key_detail: current.key_detail || current.keyDetail || '',
    keyDetail: current.keyDetail || current.key_detail || '',
    plot_summary: current.plot_summary || current.plotSummary || '',
    plotSummary: current.plotSummary || current.plot_summary || '',
    future_plot: current.future_plot || current.futurePlot || '',
    futurePlot: current.futurePlot || current.future_plot || '',
  };
}