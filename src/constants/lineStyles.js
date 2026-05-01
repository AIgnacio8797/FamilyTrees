const lineStyleDasharrays = {
  dashed: '12 8',
  'semi-dashed': '18 6 4 6',
  dotted: '2 8',
};

export function getLineDasharray(lineStyle) {
  return lineStyleDasharrays[lineStyle];
}
