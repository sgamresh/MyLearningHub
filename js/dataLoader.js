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

function normalizeQuestionsArray(questions = []) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((q) => ({
      type: q?.type === "program" ? "program" : "theory",
      question: String(q?.question || "").trim(),
      answer: String(q?.answer || ""),
      code: String(q?.code || ""),
      output: String(q?.output || "")
    }))
    .filter((q) => q.question);
}

async function loadModularJson(indexPath, indexData) {
  const modules = Array.isArray(indexData?.modules) ? indexData.modules : [];
  const categoriesMap = new Map();

  const itemFetches = [];
  modules.forEach((moduleItem) => {
    const items = Array.isArray(moduleItem?.items) ? moduleItem.items : [];
    items.forEach((entry) => {
      const categoryName = String(entry?.category || "").trim();
      const subcategoryName = String(entry?.subcategory || "").trim();
      const file = String(entry?.file || "").trim();
      if (!categoryName || !subcategoryName || !file) return;
      const fileUrl = new URL(file, new URL(indexPath, window.location.href)).toString();
      itemFetches.push(
        fetch(fileUrl).then(async (res) => {
          if (!res.ok) throw new Error(`Unable to load modular data file: ${file}`);
          const fileData = await res.json();
          return { categoryName, subcategoryName, questions: normalizeQuestionsArray(fileData?.questions) };
        })
      );
    });
  });

  const resolvedItems = await Promise.all(itemFetches);
  resolvedItems.forEach(({ categoryName, subcategoryName, questions }) => {
    if (!categoriesMap.has(categoryName)) categoriesMap.set(categoryName, { name: categoryName, subcategories: [] });
    const category = categoriesMap.get(categoryName);
    category.subcategories.push({ name: subcategoryName, questions });
  });

  return { categories: [...categoriesMap.values()] };
}

export async function loadQuestions(path = "./data/questions.index.json") {
  const format = detectFormat(path);
  if (!format) throw new Error("Unsupported data format. Use JSON, CSV, or TXT.");
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to load data file: ${path}`);
  if (format === ".json") {
    const jsonData = await response.json();
    if (Array.isArray(jsonData?.modules)) return loadModularJson(path, jsonData);
    return jsonData;
  }
  if (format === ".csv") return parseCsvToData(await response.text());
  return parseTextToData(await response.text());
}
