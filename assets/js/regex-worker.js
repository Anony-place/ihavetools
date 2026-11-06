import { findMatches } from './regex-engine.js';
self.onmessage = ({ data }) => {
  self.postMessage(findMatches(data.pattern, data.flags, data.text));
};
