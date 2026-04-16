<?php
declare(strict_types=1);

header("Content-Type: application/json");

$allowedOrigins = ["127.0.0.1", "::1"];
$remoteAddress = $_SERVER["REMOTE_ADDR"] ?? "";

if (!in_array($remoteAddress, $allowedOrigins, true)) {
  http_response_code(403);
  echo json_encode(["error" => "This endpoint only works on localhost."]);
  exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["error" => "Method not allowed."]);
  exit;
}

$rawBody = file_get_contents("php://input");
$payload = json_decode($rawBody ?: "", true);

if (!is_array($payload)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid JSON payload."]);
  exit;
}

$categoryName = trim((string)($payload["category"] ?? ""));
$subcategoryName = trim((string)($payload["subcategory"] ?? ""));
$question = $payload["question"] ?? null;
$action = trim((string)($payload["action"] ?? "add"));
$questionIndex = isset($payload["questionIndex"]) ? (int)$payload["questionIndex"] : -1;

if ($categoryName === "" || $subcategoryName === "" || !is_array($question)) {
  http_response_code(400);
  echo json_encode(["error" => "Missing category/subcategory/question data."]);
  exit;
}

if (!in_array($action, ["add", "update"], true)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid action. Use add or update."]);
  exit;
}

$type = trim((string)($question["type"] ?? ""));
$text = trim((string)($question["question"] ?? ""));

if (!in_array($type, ["theory", "program"], true) || $text === "") {
  http_response_code(400);
  echo json_encode(["error" => "Question type and question text are required."]);
  exit;
}

$cleanQuestion = [
  "type" => $type,
  "question" => $text
];

if ($type === "theory") {
  $answer = trim((string)($question["answer"] ?? ""));
  if ($answer === "") {
    http_response_code(400);
    echo json_encode(["error" => "Answer is required for theory question."]);
    exit;
  }
  $cleanQuestion["answer"] = $answer;
} else {
  $code = trim((string)($question["code"] ?? ""));
  $output = trim((string)($question["output"] ?? ""));
  if ($code === "" || $output === "") {
    http_response_code(400);
    echo json_encode(["error" => "Code and output are required for program question."]);
    exit;
  }
  $cleanQuestion["code"] = $code;
  $cleanQuestion["output"] = $output;
}

$jsonPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . "data" . DIRECTORY_SEPARATOR . "questions.json";
$jsonContent = file_get_contents($jsonPath);

if ($jsonContent === false) {
  http_response_code(500);
  echo json_encode(["error" => "Unable to read questions.json"]);
  exit;
}

$data = json_decode($jsonContent, true);

if (!is_array($data) || !isset($data["categories"]) || !is_array($data["categories"])) {
  http_response_code(500);
  echo json_encode(["error" => "Invalid questions.json structure."]);
  exit;
}

$subcategoryFound = false;
foreach ($data["categories"] as &$category) {
  if (($category["name"] ?? "") !== $categoryName) {
    continue;
  }
  foreach ($category["subcategories"] as &$subcategory) {
    if (($subcategory["name"] ?? "") !== $subcategoryName) {
      continue;
    }
    if (!isset($subcategory["questions"]) || !is_array($subcategory["questions"])) {
      $subcategory["questions"] = [];
    }
    if ($action === "update") {
      if ($questionIndex < 0 || $questionIndex >= count($subcategory["questions"])) {
        http_response_code(404);
        echo json_encode(["error" => "Question index not found for update."]);
        exit;
      }
      $subcategory["questions"][$questionIndex] = $cleanQuestion;
    } else {
      $subcategory["questions"][] = $cleanQuestion;
    }
    $subcategoryFound = true;
    break 2;
  }
}
unset($category, $subcategory);

if (!$subcategoryFound) {
  http_response_code(404);
  echo json_encode(["error" => "Selected category/subcategory was not found."]);
  exit;
}

$encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
if ($encoded === false) {
  http_response_code(500);
  echo json_encode(["error" => "Failed to encode updated data."]);
  exit;
}

if (file_put_contents($jsonPath, $encoded . PHP_EOL, LOCK_EX) === false) {
  http_response_code(500);
  echo json_encode(["error" => "Failed to write questions.json"]);
  exit;
}

echo json_encode(["ok" => true]);
