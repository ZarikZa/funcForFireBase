const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

// Инициализация Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Функция для парсинга данных
async function parseSkyengWords() {
  try {
    // Загрузка HTML-страницы
    const response = await axios.get(
        "https://skyeng.ru/articles/samye-populyarnye-slova-v-anglijskom-yazyke/",
    );

    // Загрузка HTML в cheerio
    const $ = cheerio.load(response.data);

    // Массив для хранения слов
    const words = [];

    // Парсинг данных
    $("table tbody tr").each((index, element) => {
      const columns = $(element).find("td");
      if (columns.length >= 2) {
        const word = $(columns[1]).text().trim();
        const definition = $(columns[3]).text().trim();
        words.push({ word, definition });
      }
    });

    return words;
  } catch (error) {
    logger.error("Error parsing data:", error);
    throw new Error("Failed to parse data");
  }
}

// Функция для обновления словаря в Firestore (по расписанию)
exports.updateDictionary = onSchedule(
    { schedule: "every day 00:00", timeZone: "UTC" }, // Расписание
    async (event) => {
      try {
        // Парсинг данных с сайта
        const words = await parseSkyengWords();

        // Сохранение данных в Firestore
        const promises = words.map((wordData) => {
          return db.collection("dictionary").add(wordData);
        });

        await Promise.all(promises);

        logger.log("Dictionary updated successfully!");
      } catch (error) {
        logger.error("Error updating dictionary:", error);
      }
    });

// HTTP-функция для ручного вызова
exports.parseSkyengWords = onRequest(async (request, response) => {
  try {
    // Парсинг данных с сайта
    const words = await parseSkyengWords();

    // Сохранение данных в Firestore
    const promises = words.map((wordData) => {
      return db.collection("dictionary").add(wordData);
    });

    await Promise.all(promises);

    response.send("Dictionary updated successfully!");
  } catch (error) {
    logger.error("Error:", error);
    response.status(500).send("Internal Server Error");
  }
});