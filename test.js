import readManyFiles from './src/engine/tools/readManyFiles.js';

async function main() {
  console.log("=== Testing readManyFiles ===");
  try {
    const result = await readManyFiles({
      include: ["src/configs/*.txt", "src/utils/h*.js"]
    });
    console.log("--- RESULT START ---");
    console.log(result);
    console.log("--- RESULT END ---");
  } catch (err) {
    console.error("Error running test:", err);
  }
}

main();
