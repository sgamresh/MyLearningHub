const SUPPORTED_EXTENSIONS = [".json", ".csv", ".txt"];

function parseCsvToData(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const rows = lines.slice(1).map((line) => line.split(",").map((item) => item.trim().replace(/^"|"$/g, "")));
  const categoriesMap = new Map();

  rows.forEach(([categoryName, subcategoryName, , type, question, answer, code, output]) => {
    if (!categoriesMap.has(categoryName)) categoriesMap.set(categoryName, { name: categoryName, subcategories: [] });
    const category = categoriesMap.get(categoryName);
    let subcategory = category.subcategories.find((sub) => sub.name === subcategoryName);
    if (!subcategory) {
      subcategory = { name: subcategoryName, questions: [] };
      category.subcategories.push(subcategory);
    }
    subcategory.questions.push({ type, question, answer: answer || "", code: code || "", output: output || "" });
  });
  return { categories: [...categoriesMap.values()] };
}

function parseTextToData(text) {
  return {
    categories: [
      {
        name: "Imported Text",
        subcategories: [
          {
            name: "General",
            questions: text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => ({ type: "theory", question: line, answer: "Answer not provided." }))
          }
        ]
      }
    ]
  };
}

function detectFormat(path) {
  return SUPPORTED_EXTENSIONS.find((ext) => path.endsWith(ext));
}

export async function loadQuestions(path = "./data/questions.json") {
  const format = detectFormat(path);
  if (!format) throw new Error("Unsupported data format. Use JSON, CSV, or TXT.");
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to load data file: ${path}`);
  if (format === ".json") return response.json();
  if (format === ".csv") return parseCsvToData(await response.text());
  return parseTextToData(await response.text());
}
