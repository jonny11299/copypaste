export function colLabel(i) {
  if (i < 26) return String.fromCharCode(65 + i)
  return String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
}

export function colLabelToIndex(label) {
  let result = 0
  for (let i = 0; i < label.length; i++) {
    result = result * 26 + (label.charCodeAt(i) - 64)
  }
  return result - 1  // 0-based
}
