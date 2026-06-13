# 🎮 MTA Server Manager — Повна інструкція

## Структура проекту
```
mta-manager/
├── lua-resource/        ← Ставиш на MTA сервер
│   ├── meta.xml
│   └── server.lua
├── electron/            ← EXE для Windows/Mac/Linux
│   ├── main.js
│   ├── preload.js
│   ├── package.json
│   └── src/
│       ├── index.html
│       └── app.js
└── capacitor-app/       ← APK для Android
    ├── capacitor.config.json
    ├── package.json
    └── src/
        └── index.html
```

---

## 🔧 КРОК 1: Налаштування Lua ресурсу на MTA сервері

### Встановлення:
1. Скопіюй папку `lua-resource` на сервер як `/resources/mta-manager-api/`
2. В файлі `server.lua` знайди рядок:
   ```lua
   local API_PASSWORD = "your_secret_password_here"
   ```
   Змін на свій пароль!

3. В `mtaserver.conf` додай:
   ```xml
   <resource src="mta-manager-api" startup="1" protected="0"/>
   ```

4. Переконайся що порт **22005** відкритий у firewall:
   ```bash
   # Linux (UFW)
   ufw allow 22005/tcp
   # або Windows Firewall — дозволь порт 22005 TCP
   ```

5. Запусти ресурс в консолі сервера:
   ```
   /start mta-manager-api
   ```

6. Перевір що API працює, відкривши в браузері:
   ```
   http://IP_СЕРВЕРА:22005/api/ping
   ```
   Має відповісти: `{"success":true,"data":{"message":"pong"}}`

---

## 💻 КРОК 2: Збірка EXE (Windows)

### Вимоги:
- Node.js 18+ (https://nodejs.org)

### Команди:
```bash
cd electron
npm install
npm run build
```

Готовий `.exe` буде в папці `electron/dist/`

### Для запуску без збірки (тест):
```bash
npm start
```

---

## 📱 КРОК 3: Збірка APK (Android)

### Вимоги:
- Node.js 18+
- Android Studio (https://developer.android.com/studio)
- Java JDK 17+

### Команди:
```bash
cd capacitor-app

# Встановити залежності
npm install

# Ініціалізувати Capacitor та додати Android
npx cap add android

# Синхронізувати файли
npx cap sync android

# Відкрити в Android Studio для збірки APK
npx cap open android
```

### В Android Studio:
1. Зачекай поки синхронізується Gradle (1-5 хв)
2. `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
3. APK буде в `android/app/build/outputs/apk/debug/`

### Швидка збірка через командний рядок:
```bash
cd capacitor-app/android
./gradlew assembleDebug
# Windows:
gradlew.bat assembleDebug
```

---

## 🔌 Підключення в додатку

| Поле | Значення |
|------|----------|
| IP сервера | IP вашого MTA сервера |
| Порт API | 22005 (або змінений в server.lua) |
| Пароль API | Той що вказав в server.lua |

---

## 📋 API Endpoints

| Метод | URL | Опис |
|-------|-----|------|
| GET | /api/ping | Перевірка з'єднання |
| POST | /api/auth | Авторизація |
| GET | /api/server | Інфо про сервер |
| GET | /api/players | Список гравців |
| POST | /api/players/kick | Кік гравця |
| POST | /api/players/ban | Бан гравця |
| POST | /api/players/mute | Мут/анмут |
| POST | /api/players/message | PM гравцю |
| GET | /api/resources | Список ресурсів |
| POST | /api/resources/start | Запуск ресурсу |
| POST | /api/resources/stop | Зупинка ресурсу |
| POST | /api/resources/restart | Рестарт ресурсу |
| POST | /api/console | Виконати команду |
| POST | /api/broadcast | Повідомлення всім |

---

## ❗ Важливо

- Зміни пароль в `server.lua` перед використанням!
- Якщо сервер за NAT — потрібен port forwarding порту 22005
- Для HTTPS потрібен SSL сертифікат (необов'язково для локальної мережі)
- APK встановлюється через "Встановити з невідомих джерел" в налаштуваннях Android
