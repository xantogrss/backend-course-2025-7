require('dotenv').config(); // Підключаємо секрети з файлу .env
const { program } = require('commander');
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mysql = require('mysql2'); // Додали пакет для бази даних

// 1. Налаштовуємо аргументи командного рядка
program
  .option('-h, --host <type>', 'адреса сервера', '0.0.0.0')
  .option('-p, --port <number>', 'порт сервера', process.env.PORT || 3000)
  .option('-c, --cache <path>', 'шлях до директорії з кешем', './my_cache');

program.parse(process.argv);
const options = program.opts();

// 2. Налаштування підключення до MySQL (беремо дані з .env)
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'inventory_db'
});

// Перевірка з'єднання з БД
db.connect(err => {
    if (err) {
        console.error('Помилка підключення до БД:', err.message);
    } else {
        console.log('Успішно підключено до бази даних MySQL');
    }
});

// Створюємо папку для кешу, якщо її немає
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

// Маршрути (Routes)
app.get('/', (req, res) => {
    res.send('Сервіс інвентаризації (Лабораторна 7) працює!');
});

app.get('/register', (req, res) => {
    res.sendFile(path.resolve('RegisterForm.html'));
});

app.post('/register', upload.single('photo'), (req, res) => {
    const { name, serial, description } = req.body;
    
    if (!name || !serial || !req.file) {
        return res.status(400).send('Помилка: дані неповні!');
    }

    // 1. Зберігаємо в базу даних
    const sql = "INSERT INTO inventory (name, serial, description, image) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, serial, description, req.file.filename], (err, result) => {
        if (err) {
            console.error('Помилка запису в БД:', err);
            // Не зупиняємо програму, просто логуємо помилку
        }
    });

    // 2. Зберігаємо в JSON файл (як було в лабі 6)
    const itemData = { name, serial, description, image: req.file.filename, timestamp: new Date() };
    fs.writeFileSync(path.join(options.cache, `${serial}.json`), JSON.stringify(itemData, null, 2));

    res.send(`Пристрій "${name}" успішно зареєстровано в БД та файлі!`);
});

app.get('/search', (req, res) => {
    res.sendFile(path.resolve('SearchForm.html'));
});

app.get('/inventory', (req, res) => {
    const serial = req.query.serial;

    if (!serial) {
        return res.status(400).send('Вкажіть серійний номер!');
    }

    const filePath = path.join(options.cache, `${serial}.json`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Пристрій не знайдено!');
    }

    const rawData = fs.readFileSync(filePath);
    const item = JSON.parse(rawData);

    res.send(`
        <h1>Дані про пристрій (з файлу)</h1>
        <p><b>Назва:</b> ${item.name}</p>
        <p><b>Серійний номер:</b> ${item.serial}</p>
        <p><b>Опис:</b> ${item.description}</p>
        <p><b>Файл фото:</b> ${item.image}</p>
        <br><a href="/search">Шукати інший</a>
    `);
});

// Запуск сервера
const PORT = options.port;
const HOST = options.host;

app.listen(PORT, HOST, () => {
    console.log(`Сервер працює на http://${HOST}:${PORT}`);
    console.log(`Кеш зберігається у: ${path.resolve(options.cache)}`);
});