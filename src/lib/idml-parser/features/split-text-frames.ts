const getAttr = (el: Element, attr: string): string | null =>
  el.getAttribute(attr);

/** Orders text frames based on linking. Returns null on critical failure. */
export function orderTextFrames(textFrames: Element[]): Element[] | null {
  const frameMap = new Map(textFrames.map((tf) => [getAttr(tf, "Self")!, tf]));
  let currentFrame = textFrames.find(
    (tf) => getAttr(tf, "PreviousTextFrame") === "n"
  );
  if (!currentFrame) return null; // Cannot start

  const ordered: Element[] = [];
  const visited = new Set<string>();
  while (currentFrame) {
    const currentId = getAttr(currentFrame, "Self")!;
    if (visited.has(currentId)) {
      console.warn("! Loop detected");
      break;
    } // Loop
    visited.add(currentId);
    ordered.push(currentFrame);
    const nextId = getAttr(currentFrame, "NextTextFrame");
    currentFrame = nextId && nextId !== "n" ? frameMap.get(nextId) : undefined;
  }
  // Basic check if ordering seems plausible
  if (ordered.length === 0 && textFrames.length > 0) return null;
  if (ordered.length !== textFrames.length)
    console.warn(
      `! Frame order mismatch (${ordered.length}/${textFrames.length})`
    );
  return ordered;
}

/** Gets block IDs for frames. Filters out frames where block retrieval fails. */
export function getTextFramesWithBlocks(
  orderedFrames: Element[],
  getBlockFn: (id: string) => number | null | undefined
): { tf: Element; block: number; id: string }[] {
  return orderedFrames
    .map((tf) => {
      const id = getAttr(tf, "Self")!;
      const block = getBlockFn(id) as number;
      return block != null ? { tf, block, id } : null;
    })
    .filter(
      (fb): fb is { tf: Element; block: number; id: string } => fb !== null
    );
}

/** Calculates split indices based on text length and desired frame count. */
export function calculateSplitIndices(
  fullText: string,
  numFrames: number
): number[] {
  const textLen = fullText.length;
  if (numFrames <= 1 || textLen === 0) return [];
  const idealChars = textLen / numFrames;
  const nlIndices = Array.from(fullText.matchAll(/\r\n|\r|\n|\u2028/g)).map(
    (m) => m.index!
  );
  const splits: number[] = [];
  let lastSplit = 0;
  for (let i = 0; i < numFrames - 1; i++) {
    const target = Math.round((i + 1) * idealChars);
    const winRadius = Math.max(Math.round(idealChars * 0.2), 20);
    const nls = nlIndices.filter(
      (idx) =>
        idx >= Math.max(lastSplit, target - winRadius) &&
        idx < Math.min(textLen, target + winRadius) &&
        idx > lastSplit
    );
    let bestSplit = target; // Default split point
    if (nls.length > 0) {
      nls.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
      const nlMatch = fullText.substring(nls[0]).match(/^(\r\n|\r|\n|\u2028)/);
      bestSplit = nls[0] + (nlMatch ? nlMatch[0].length : 1); // Split after newline
    }
    bestSplit = Math.min(textLen, Math.max(lastSplit, bestSplit));
    splits.push(bestSplit);
    lastSplit = bestSplit;
  }
  return splits;
}

/** Updates engine block contents using provided text segments. */
export function updateFrameContents(
  framesWithBlocks: { block: number; id: string }[],
  fullText: string,
  splitIndices: number[],
  updateString: (blockId: number, startIndex: number, endIndex: number) => void
): void {
  let startIdx = 0;
  framesWithBlocks.forEach(({ block, id }, idx) => {
    const endIdx =
      idx === framesWithBlocks.length - 1 ? fullText.length : splitIndices[idx];
    try {
      updateString(block, startIdx, endIdx);
    } catch (e) {
      console.error(`! Set string failed for block ${block} (${id}): ${e}`);
    }
    startIdx = endIdx;
  });
}
