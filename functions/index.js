const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

// Инициализация Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

/**
 * Функция для парсинга данных с сайта Skyeng
 * @returns {Promise<Array>} Массив слов с их определениями
 */
async function parseSkyengWords() {
  try {
    // Загрузка HTML-страницы
    const response = await axios.get(
      "https://skyeng.ru/articles/samye-populyarnye-slova-v-anglijskom-yazyke/"
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

/**
 * Функция для обновления словаря в Firestore (по расписанию)
 */
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
  }
);

/**
 * HTTP-функция для ручного вызова
 */
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

/**
 * Функция для выборки 10 уникальных слов
 */
exports.dailyWordSelection = onSchedule(
  { schedule: "every day 00:00", timeZone: "UTC" }, // Запуск каждый день в полночь
  async (event) => {
    try {
      // Получаем все слова из коллекции dictionary
      const dictionarySnapshot = await db.collection("dictionary").get();

      // Преобразуем документы в массив слов
      const allWords = dictionarySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Удаляем все документы из коллекции dailyWords
      const dailyWordsSnapshot = await db.collection("dailyWords").get();
      const deletePromises = dailyWordsSnapshot.docs.map((doc) =>
        doc.ref.delete()
      );
      await Promise.all(deletePromises);

      logger.log("Все старые слова удалены из dailyWords.");

      // Выбираем 10 случайных слов
      const selectedWords = getRandomWords(allWords, 10);

      // Сохраняем выбранные слова в коллекцию dailyWords
      await db.collection("dailyWords").add({
        words: selectedWords,
        date: new Date().toISOString().split("T")[0], // Сегодняшняя дата в формате YYYY-MM-DD
      });

      logger.log("10 новых слов успешно выбраны и сохранены.");
    } catch (error) {
      logger.error("Ошибка при выборе слов:", error);
    }
  }
);

/**
 * Функция для выбора случайных слов
 * @param {Array} words - Список слов
 * @param {number} count - Количество слов для выбора
 * @returns {Array} - Массив случайных слов
 */
function getRandomWords(words, count) {
  const shuffled = words.sort(() => 0.5 - Math.random()); // Перемешиваем массив
  return shuffled.slice(0, count); // Выбираем первые `count` слов
}
