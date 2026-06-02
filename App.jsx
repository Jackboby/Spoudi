import React, { useState, useRef, useEffect } from "react";

const VERSION = "BSB";

// Very simple mapping; extend as needed
const BOOK_MAP = {
  "Genesis": "Genesis",
  "Exodus": "Exodus",
  "Leviticus": "Leviticus",
  "Numbers": "Numbers",
  "Deuteronomy": "Deuteronomy",
  "Joshua": "Joshua",
  "Judges": "Judges",
  "Ruth": "Ruth",
  "1 Samuel": "1 Samuel",
  "2 Samuel": "2 Samuel",
  "1 Kings": "1 Kings",
  "2 Kings": "2 Kings",
  "1 Chronicles": "1 Chronicles",
  "2 Chronicles": "2 Chronicles",
  "Ezra": "Ezra",
  "Nehemiah": "Nehemiah",
  "Esther": "Esther",
  "Job": "Job",
  "Ps.": "Psalms",
  "Psalm": "Psalms",
  "Psalms": "Psalms",
  "Prov.": "Proverbs",
  "Proverbs": "Proverbs",
  "Ecclesiastes": "Ecclesiastes",
  "Song": "Song of Solomon",
  "Isaiah": "Isaiah",
  "Jeremiah": "Jeremiah",
  "Lamentations": "Lamentations",
  "Ezekiel": "Ezekiel",
  "Daniel": "Daniel",
  "Hosea": "Hosea",
  "Joel": "Joel",
  "Amos": "Amos",
  "Obadiah": "Obadiah",
  "Jonah": "Jonah",
  "Micah": "Micah",
  "Nahum": "Nahum",
  "Habakkuk": "Habakkuk",
  "Zephaniah": "Zephaniah",
  "Haggai": "Haggai",
  "Zechariah": "Zechariah",
  "Malachi": "Malachi",
  "Matt.": "Matthew",
  "Matthew": "Matthew",
  "Mark": "Mark",
  "Luke": "Luke",
  "John": "John",
  "Acts": "Acts",
  "Rom.": "Romans",
  "Romans": "Romans",
  "1 Cor.": "1 Corinthians",
  "2 Cor.": "2 Corinthians",
  "Gal.": "Galatians",
  "Eph.": "Ephesians",
  "Phil.": "Philippians",
  "Col.": "Colossians",
  "1 Thess.": "1 Thessalonians",
  "2 Thess.": "2 Thessalonians",
  "1 Tim.": "1 Timothy",
  "2 Tim.": "2 Timothy",
  "Titus": "Titus",
  "Philem.": "Philemon",
  "Heb.": "Hebrews",
  "James": "James",
  "1 Pet.": "1 Peter",
  "1 Peter": "1 Peter",
  "2 Pet.": "2 Peter",
  "1 John": "1 John",
  "2 John": "2 John",
  "3 John": "3 John",
  "Jude": "Jude",
  "Rev.": "Revelation",
  "Revelation": "Revelation",
};

const NODE_COLORS = [
  "#ffb3ba",
  "#ffdfba",
  "#ffffba",
  "#baffc9",
  "#bae1ff",
  "#e0baff",
];

function parseInput(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let passageLines = [];
  let crossLines = [];
  let inCross = false;

  for (const line of lines) {
    if (/^Cross references/i.test(line)) {
      inCross = true;
      continue;
    }
    if (!inCross) {
      passageLines.push(line);
    } else {
      if (line.startsWith("*")) {
        crossLines.push(line.replace(/^\*\s*/, ""));
      }
    }
  }

  const passageText = passageLines.join(" ");

  const crossRefs = crossLines.map((line, idx) => {
    // Example: "1 Peter 5:6 : [See ver. 5 above]; See James 4:6, 10"
    const [anchorPart, refsPartRaw] = line.split(" : ");
    const anchor = anchorPart.trim();

    const refsPart = refsPartRaw || "";
    // Remove brackets and split by ; and ,
    const cleaned = refsPart.replace(/

\[|\]

/g, "");
    const pieces = cleaned
      .split(/;|\uFF1B/)
      .map((p) => p.trim())
      .filter(Boolean);

    const refs = [];
    for (const piece of pieces) {
      // Try to find patterns like "James 4:6" or "Ps. 37:5"
      const match = piece.match(
        /([1-3]?\s?[A-Za-z\.]+)\s+(\d+):(\d+)/
      );
      if (match) {
        const bookAbbrev = match[1].trim();
        const chapter = match[2];
        const verse = match[3];
        refs.push({
          raw: `${bookAbbrev} ${chapter}:${verse}`,
          bookAbbrev,
          chapter,
          verse,
        });
      }
    }

    return {
      id: idx,
      anchor,
      refs,
    };
  });

  return { passageText, crossRefs };
}

async function fetchVerse({ bookAbbrev, chapter, verse }) {
  const book = BOOK_MAP[bookAbbrev] || bookAbbrev;
  const url = `https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/${VERSION}/books/${encodeURIComponent(
    book
  )}/chapters/${chapter}/verses/${verse}.json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch verse");
  }
  const data = await res.json();
  // Assuming data has a "text" field; adjust if structure differs
  return data.text || JSON.stringify(data);
}

function App() {
  const [rawInput, setRawInput] = useState("");
  const [passageText, setPassageText] = useState("");
  const [crossRefs, setCrossRefs] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [verseText, setVerseText] = useState("");
  const [loadingVerse, setLoadingVerse] = useState(false);
  const [error, setError] = useState("");

  // Whiteboard transform
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Drawing
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState(true);

  const handleParse = () => {
    try {
      const { passageText, crossRefs } = parseInput(rawInput);
      setPassageText(passageText);
      setCrossRefs(crossRefs);
      setSelectedNode(null);
      setVerseText("");
      setError("");
    } catch (e) {
      setError("Failed to parse input. Try checking the format.");
    }
  };

  const handleNodeClick = async (node, ref) => {
    setSelectedNode({ node, ref });
    setVerseText("");
    setError("");
    setLoadingVerse(true);
    try {
      const text = await fetchVerse(ref);
      setVerseText(text);
    } catch (e) {
      setError("Could not fetch verse text.");
    } finally {
      setLoadingVerse(false);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const zoomFactor = 0.001;
    setScale((prev) => {
      let next = prev + delta * zoomFactor;
      if (next < 0.2) next = 0.2;
      if (next > 3) next = 3;
      return next;
    });
  };

  const handleMouseDownPan = (e) => {
    if (!drawMode) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    }
  };

  const handleMouseMovePan = (e) => {
    if (isPanning && !drawMode) {
      setOffset({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
  };

  const handleMouseUpPan = () => {
    setIsPanning(false);
  };

  // Drawing on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
  }, []);

  const getCanvasPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;
    return { x, y };
  };

  const handleCanvasMouseDown = (e) => {
    if (!drawMode) return;
    setIsDrawing(true);
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing || !drawMode) return;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getCanvasPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Layout nodes in a circle around the passage
  const center = { x: 600, y: 350 };
  const radius = 220;

  const nodesWithPositions = crossRefs.flatMap((cr, idx) => {
    const angleBase = (idx / Math.max(crossRefs.length, 1)) * Math.PI * 2;
    return cr.refs.map((ref, j) => {
      const angle = angleBase + (j * 0.3);
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);
      return {
        nodeId: `${cr.id}-${j}`,
        anchor: cr.anchor,
        ref,
        x,
        y,
        color: NODE_COLORS[(idx + j) % NODE_COLORS.length],
      };
    });
  });

  return (
    <div className="app">
      <header className="app-header">
        <h1>Bible Cross-Reference Whiteboard</h1>
        <p className="subtitle">
          Paste a BibleGateway passage with cross references, then explore and annotate visually.
        </p>
      </header>

      <div className="top-panel">
        <div className="input-panel">
          <label className="label">Paste passage + cross references</label>
          <textarea
            className="input-textarea"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Paste from BibleGateway here..."
          />
          <button className="btn" onClick={handleParse}>
            Parse &amp; Render
          </button>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="info-panel">
          <div className="passage-box">
            <h2>Passage</h2>
            <p>{passageText || "Parsed passage will appear here."}</p>
          </div>

          <div className="controls">
            <h2>Whiteboard controls</h2>
            <div className="control-row">
              <button
                className={`btn small ${drawMode ? "active" : ""}`}
                onClick={() => setDrawMode(true)}
              >
                Draw
              </button>
              <button
                className={`btn small ${!drawMode ? "active" : ""}`}
                onClick={() => setDrawMode(false)}
              >
                Pan
              </button>
              <button className="btn small" onClick={clearCanvas}>
                Clear drawings
              </button>
            </div>
            <p className="hint">
              Scroll to zoom. In Draw mode, drag on the board to annotate. In Pan mode, drag to move.
            </p>
          </div>

          <div className="verse-panel">
            <h2>Selected cross reference</h2>
            {selectedNode ? (
              <>
                <p className="verse-ref">
                  {selectedNode.ref.raw} (anchor: {selectedNode.node.anchor})
                </p>
                {loadingVerse ? (
                  <p>Loading verse text...</p>
                ) : verseText ? (
                  <p className="verse-text">{verseText}</p>
                ) : (
                  <p>No verse text loaded yet.</p>
                )}
              </>
            ) : (
              <p>Click a node on the whiteboard to view its verse.</p>
            )}
          </div>
        </div>
      </div>

      <div
        className="whiteboard-container"
        onWheel={handleWheel}
        onMouseDown={handleMouseDownPan}
        onMouseMove={handleMouseMovePan}
        onMouseUp={handleMouseUpPan}
        onMouseLeave={handleMouseUpPan}
      >
        <div
          className="whiteboard-inner"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          {/* Passage node */}
          <div
            className="passage-node"
            style={{
              left: center.x,
              top: center.y,
            }}
          >
            <div className="passage-node-inner">
              {passageText || "Passage"}
            </div>
          </div>

          {/* SVG lines */}
          <svg className="whiteboard-svg">
            {nodesWithPositions.map((n) => (
              <line
                key={`line-${n.nodeId}`}
                x1={center.x}
                y1={center.y}
                x2={n.x}
                y2={n.y}
                stroke={n.color}
                strokeWidth="1.5"
                opacity="0.7"
              />
            ))}
          </svg>

          {/* Nodes */}
          {nodesWithPositions.map((n) => (
            <div
              key={n.nodeId}
              className="ref-node"
              style={{
                left: n.x,
                top: n.y,
                backgroundColor: n.color,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleNodeClick(
                  { anchor: n.anchor },
                  n.ref
                );
              }}
            >
              <span className="ref-node-label">{n.ref.raw}</span>
            </div>
          ))}

          {/* Drawing canvas */}
          <canvas
            ref={canvasRef}
            className="draw-canvas"
            width={1200}
            height={700}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
