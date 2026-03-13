const fs = require("fs");

let file = fs.readFileSync(
  "src/components/flashcard/PracticeCanvas.tsx",
  "utf8",
);

file = file.replace(
  /const neighbors = \[\];/g,
  "const neighbors: number[] = [];",
);
file = file.replace(/\s*activeStrokeRegionIdRef\.current = null;/g, "");

fs.writeFileSync("src/components/flashcard/PracticeCanvas.tsx", file);
console.log("OK");
