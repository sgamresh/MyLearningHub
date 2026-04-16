<?php
declare(strict_types=1);

header("Content-Type: application/json");

function respond(int $status, array $payload): void {
  http_response_code($status);
  echo json_encode($payload);
  exit;
}

function slugify(string $value): string {
  $normalized = strtolower(trim($value));
  $normalized = preg_replace('/[^a-z0-9]+/', '-', $normalized) ?? "";
  $normalized = trim($normalized, '-');
  return $normalized !== "" ? $normalized : "item";
}

function writeJsonFile(string $path, array $data): void {
  $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
  if ($encoded === false) {
    respond(500, ["error" => "Failed to encode JSON data."]);
  }
  if (file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) === false) {
    respond(500, ["error" => "Failed to write file."]);
  }
}

function &findOrCreateModule(array &$indexData, string $moduleName): array {
  foreach ($indexData["modules"] as $moduleIndex => $module) {
    if (($module["name"] ?? "") === $moduleName) {
      return $indexData["modules"][$moduleIndex];
    }
  }

  $indexData["modules"][] = [
    "name" => $moduleName,
    "slug" => slugify($moduleName),
    "items" => []
  ];
  $lastIndex = count($indexData["modules"]) - 1;
  return $indexData["modules"][$lastIndex];
}

function findEntryLocation(array $indexData, string $categoryName, string $subcategoryName): ?array {
  foreach ($indexData["modules"] as $moduleIndex => $module) {
    $items = $module["items"] ?? [];
    foreach ($items as $itemIndex => $item) {
      if (($item["category"] ?? "") === $categoryName && ($item["subcategory"] ?? "") === $subcategoryName) {
        return [$moduleIndex, $itemIndex];
      }
    }
  }
  return null;
}

$allowedOrigins = ["127.0.0.1", "::1"];
$remoteAddress = $_SERVER["REMOTE_ADDR"] ?? "";

if (!in_array($remoteAddress, $allowedOrigins, true)) {
  respond(403, ["error" => "This endpoint only works on localhost."]);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(405, ["error" => "Method not allowed."]);
}

$rawBody = file_get_contents("php://input");
$payload = json_decode($rawBody ?: "", true);
if (!is_array($payload)) {
  respond(400, ["error" => "Invalid JSON payload."]);
}

$categoryName = trim((string)($payload["category"] ?? ""));
$subcategoryName = trim((string)($payload["subcategory"] ?? ""));
$question = $payload["question"] ?? null;
$action = trim((string)($payload["action"] ?? "add"));
$questionIndex = isset($payload["questionIndex"]) ? (int)$payload["questionIndex"] : -1;

if ($categoryName === "" || $subcategoryName === "") {
  respond(400, ["error" => "Missing category/subcategory data."]);
}
if (!in_array($action, ["add", "update", "delete"], true)) {
  respond(400, ["error" => "Invalid action. Use add, update, or delete."]);
}

$cleanQuestion = [];
if ($action !== "delete") {
  if (!is_array($question)) {
    respond(400, ["error" => "Missing question data."]);
  }

  $type = trim((string)($question["type"] ?? ""));
  $text = trim((string)($question["question"] ?? ""));
  if (!in_array($type, ["theory", "program"], true) || $text === "") {
    respond(400, ["error" => "Question type and question text are required."]);
  }

  $cleanQuestion = [
    "type" => $type,
    "question" => $text
  ];

  if ($type === "theory") {
    $answer = trim((string)($question["answer"] ?? ""));
    if ($answer === "") {
      respond(400, ["error" => "Answer is required for theory question."]);
    }
    $cleanQuestion["answer"] = $answer;
  } else {
    $code = trim((string)($question["code"] ?? ""));
    $output = trim((string)($question["output"] ?? ""));
    if ($code === "" || $output === "") {
      respond(400, ["error" => "Code and output are required for program question."]);
    }
    $cleanQuestion["code"] = $code;
    $cleanQuestion["output"] = $output;
  }
}

$dataDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . "data";
$indexPath = $dataDir . DIRECTORY_SEPARATOR . "questions.index.json";

if (!file_exists($indexPath)) {
  writeJsonFile($indexPath, ["modules" => []]);
}

$indexContent = file_get_contents($indexPath);
if ($indexContent === false) {
  respond(500, ["error" => "Unable to read questions.index.json"]);
}

$indexData = json_decode($indexContent, true);
if (!is_array($indexData) || !isset($indexData["modules"]) || !is_array($indexData["modules"])) {
  respond(500, ["error" => "Invalid questions.index.json structure."]);
}

$entryLocation = findEntryLocation($indexData, $categoryName, $subcategoryName);

if ($entryLocation === null) {
  if ($action !== "add") {
    respond(404, ["error" => "Selected category/subcategory was not found."]);
  }

  $moduleName = $categoryName;
  foreach ($indexData["modules"] as $module) {
    foreach (($module["items"] ?? []) as $item) {
      if (($item["category"] ?? "") === $categoryName) {
        $moduleName = (string)($module["name"] ?? $categoryName);
        break 2;
      }
    }
  }

  $module = &findOrCreateModule($indexData, $moduleName);
  $moduleSlug = slugify((string)($module["slug"] ?? $moduleName));
  $module["slug"] = $moduleSlug;

  $categorySlug = slugify($categoryName);
  $subcategorySlug = slugify($subcategoryName);
  $relativeDir = "modules/" . $moduleSlug;
  $absoluteDir = $dataDir . DIRECTORY_SEPARATOR . "modules" . DIRECTORY_SEPARATOR . $moduleSlug;

  if (!is_dir($absoluteDir) && !mkdir($absoluteDir, 0777, true) && !is_dir($absoluteDir)) {
    respond(500, ["error" => "Failed to create module directory."]);
  }

  $baseFile = $categorySlug . "--" . $subcategorySlug . ".json";
  $relativeFile = $relativeDir . "/" . $baseFile;
  $absoluteFile = $absoluteDir . DIRECTORY_SEPARATOR . $baseFile;
  $suffix = 2;
  while (file_exists($absoluteFile)) {
    $baseFile = $categorySlug . "--" . $subcategorySlug . "-" . $suffix . ".json";
    $relativeFile = $relativeDir . "/" . $baseFile;
    $absoluteFile = $absoluteDir . DIRECTORY_SEPARATOR . $baseFile;
    $suffix += 1;
  }

  $module["items"][] = [
    "category" => $categoryName,
    "subcategory" => $subcategoryName,
    "file" => $relativeFile
  ];
  writeJsonFile($absoluteFile, [
    "module" => $moduleName,
    "category" => $categoryName,
    "subcategory" => $subcategoryName,
    "questions" => []
  ]);
  unset($module);
  $entryLocation = findEntryLocation($indexData, $categoryName, $subcategoryName);
}

if ($entryLocation === null) {
  respond(500, ["error" => "Failed to resolve target data file."]);
}

[$moduleIndex, $itemIndex] = $entryLocation;
$relativeFile = (string)($indexData["modules"][$moduleIndex]["items"][$itemIndex]["file"] ?? "");
if ($relativeFile === "") {
  respond(500, ["error" => "Invalid file mapping in questions.index.json"]);
}

$normalizedRelative = str_replace(["\\", ".."], ["/", ""], $relativeFile);
$absoluteFile = $dataDir . DIRECTORY_SEPARATOR . str_replace("/", DIRECTORY_SEPARATOR, $normalizedRelative);
if (!file_exists($absoluteFile)) {
  respond(500, ["error" => "Mapped data file was not found."]);
}

$fileContent = file_get_contents($absoluteFile);
if ($fileContent === false) {
  respond(500, ["error" => "Unable to read mapped data file."]);
}

$subData = json_decode($fileContent, true);
if (!is_array($subData)) {
  respond(500, ["error" => "Invalid subcategory JSON structure."]);
}
if (!isset($subData["questions"]) || !is_array($subData["questions"])) {
  $subData["questions"] = [];
}

if ($action === "update") {
  if ($questionIndex < 0 || $questionIndex >= count($subData["questions"])) {
    respond(404, ["error" => "Question index not found for update."]);
  }
  $subData["questions"][$questionIndex] = $cleanQuestion;
} elseif ($action === "delete") {
  if ($questionIndex < 0 || $questionIndex >= count($subData["questions"])) {
    respond(404, ["error" => "Question index not found for delete."]);
  }
  array_splice($subData["questions"], $questionIndex, 1);
} else {
  $subData["questions"][] = $cleanQuestion;
}

writeJsonFile($absoluteFile, $subData);
writeJsonFile($indexPath, $indexData);
respond(200, ["ok" => true]);
