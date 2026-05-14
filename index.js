const { program } = require('commander');
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 1. Налаштовуємо аргументи командного рядка
program
  .requiredOption('-h, --host <type>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії з кешем');

program.parse(process.argv);
const options = program.opts();

// 2. Створюємо папку для кешу, якщо її немає
if (!fs.existsSync(options.cache)) {
    fs.mkdirSync(options.cache, { recursive: true });
}

const app = express();

// Налаштування Multer для збереження фото
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, options.cache);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Головна сторінка
app.get('/', (req, res) => {
    res.send('Сервіс інвентаризації працює!');
});

// Маршрут для отримання форми реєстрації
app.get('/register', (req, res) => {
    res.sendFile(path.resolve('RegisterForm.html'));
});

// ОБРОБКА РЕЄСТРАЦІЇ (виправлено під твою форму)
app.post('/register', upload.single('photo'), (req, res) => {
    const { name, serial, description } = req.body;
    
    if (!name || !serial || !req.file) {
        return res.status(400).send('Помилка: назва, серійний номер та фото обов’язкові!');
    }

    const itemData = {
        name,
        serial,
        description: description || '',
        image: req.file.filename,
        timestamp: new Date()
    };

    // Зберігаємо JSON файл у папку кешу
    const filePath = path.join(options.cache, `${serial}.json`);
    fs.writeFileSync(filePath, JSON.stringify(itemData, null, 2));

    res.send(`Пристрій "${name}" успішно зареєстровано! Перевірте папку кешу.`);
});

// 3. Запускаємо сервер
app.listen(options.port, options.host, () => {
    console.log(`Сервер запущено на http://${options.host}:${options.port}`);
    console.log(`Папка для кешу: ${path.resolve(options.cache)}`);
});
// Маршрут для форми пошуку
app.get('/search', (req, res) => {
    res.sendFile(path.resolve('SearchForm.html'));
});

// ОБРОБКА ПОШУКУ
app.get('/inventory', (req, res) => {
    const serial = req.query.serial; // Отримуємо серійник з URL (наприклад, ?serial=SN123)

    if (!serial) {
        return res.status(400).send('Вкажіть серійний номер!');
    }

    const filePath = path.join(options.cache, `${serial}.json`);

    // Перевіряємо, чи існує такий файл
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Пристрій не знайдено в базі!');
    }

    // Читаємо дані з файлу
    const rawData = fs.readFileSync(filePath);
    const item = JSON.parse(rawData);

    // Відправляємо дані користувачу
    res.send(`
        <h1>Дані про пристрій</h1>
        <p><b>Назва:</b> ${item.name}</p>
        <p><b>Серійний номер:</b> ${item.serial}</p>
        <p><b>Опис:</b> ${item.description}</p>
        <p><b>Дата реєстрації:</b> ${item.timestamp}</p>
        <p><b>Файл фото:</b> ${item.image}</p>
        <br>
        <a href="/search">Шукати інший</a>
    `);
});