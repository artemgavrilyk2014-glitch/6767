--[[
    MTA Manager - HTTP API Resource
    Автор: MTA Manager
    Версія: 1.0.0
    
    Встановлення:
    1. Скопіюйте папку 'mta-manager-api' в /resources/
    2. Додайте в mtaserver.conf: <resource src="mta-manager-api" startup="1" protected="0"/>
    3. Відкрийте порт 22005 (або змініть нижче)
    4. Запустіть ресурс: /start mta-manager-api
]]

local API_PORT     = 22005          -- Порт HTTP API
local API_PASSWORD = "your_secret_password_here"  -- Змініть на свій пароль!
local MAX_BAN_DAYS = 365            -- Максимум днів бану

-- ─── Утиліти ────────────────────────────────────────────────────────────────

local function response(httpResponse, code, data)
    httpResponse["Status-Code"] = code
    httpResponse["Content-Type"] = "application/json"
    return tostring(outputHTTPResponse(json.encode(data)))
end

local function ok(httpResponse, data)
    return response(httpResponse, 200, {success=true, data=data})
end

local function err(httpResponse, msg, code)
    return response(httpResponse, code or 400, {success=false, error=msg})
end

local function checkAuth(httpRequest)
    local auth = httpRequest["Authorization"] or ""
    local pass = auth:match("Bearer%s+(.+)")
    return pass == API_PASSWORD
end

local function getPlayerInfo(player)
    return {
        serial  = getPlayerSerial(player),
        name    = getPlayerName(player),
        ping    = getPlayerPing(player),
        ip      = getPlayerIP(player),
        score   = getElementData(player, "score") or 0,
        time    = getElementData(player, "playtime") or "00:00:00",
        muted   = isPlayerMuted(player),
        account = isGuestAccount(getPlayerAccount(player)) and "Guest" or getAccountName(getPlayerAccount(player)),
        id      = getElementID(player) or "N/A",
    }
end

-- ─── Відстеження аптайму ────────────────────────────────────────────────────

local serverStartTime = getRealTime().timestamp

local function formatUptime()
    local diff = getRealTime().timestamp - serverStartTime
    local h = math.floor(diff / 3600)
    local m = math.floor((diff % 3600) / 60)
    local s = diff % 60
    return string.format("%02d:%02d:%02d", h, m, s)
end

-- ─── Роутер ─────────────────────────────────────────────────────────────────

local routes = {}

-- GET /api/ping — перевірка з'єднання
routes["GET /api/ping"] = function(req, res, body)
    return ok(res, {message="pong", version="1.0.0"})
end

-- POST /api/auth — авторизація
routes["POST /api/auth"] = function(req, res, body)
    if body.password == API_PASSWORD then
        return ok(res, {token=API_PASSWORD, message="Authorized"})
    end
    return err(res, "Invalid password", 401)
end

-- GET /api/server — інфо про сервер
routes["GET /api/server"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    return ok(res, {
        name       = getServerName(),
        players    = #getElementsByType("player"),
        maxPlayers = getMaxPlayers(),
        ping       = 0,
        uptime     = formatUptime(),
        port       = getServerConfigSetting("serverport") or "22003",
        version    = getServerVersion(),
        gamemode   = (getResourceName(getResourceFromName("freeroam")) or "freeroam"),
    })
end

-- GET /api/players — список гравців
routes["GET /api/players"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    local list = {}
    for _, p in ipairs(getElementsByType("player")) do
        table.insert(list, getPlayerInfo(p))
    end
    return ok(res, list)
end

-- POST /api/players/kick — кік гравця
routes["POST /api/players/kick"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    if not body.name then return err(res, "Missing: name") end
    local player = getPlayerFromName(body.name)
    if not player then return err(res, "Player not found") end
    kickPlayer(player, body.reason or "Kicked by admin")
    outputChatBox("[ADMIN] " .. body.name .. " was kicked. Reason: " .. (body.reason or "No reason"), root, 255, 100, 0)
    return ok(res, {message="Player kicked: " .. body.name})
end

-- POST /api/players/ban — бан гравця
routes["POST /api/players/ban"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    if not body.name then return err(res, "Missing: name") end
    local player = getPlayerFromName(body.name)
    if not player then return err(res, "Player not found") end
    local days = tonumber(body.days) or 1
    days = math.min(days, MAX_BAN_DAYS)
    banPlayer(player, false, false, days, false, body.reason or "Banned by admin")
    outputChatBox("[ADMIN] " .. body.name .. " was banned for " .. days .. " days. Reason: " .. (body.reason or "No reason"), root, 255, 50, 50)
    return ok(res, {message="Player banned: " .. body.name})
end

-- POST /api/players/mute — мут/анмут гравця
routes["POST /api/players/mute"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    if not body.name then return err(res, "Missing: name") end
    local player = getPlayerFromName(body.name)
    if not player then return err(res, "Player not found") end
    local muted = not isPlayerMuted(player)
    setPlayerMuted(player, muted)
    return ok(res, {muted=muted, message=(muted and "Player muted" or "Player unmuted")})
end

-- POST /api/players/message — повідомлення гравцю
routes["POST /api/players/message"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    if not body.name or not body.message then return err(res, "Missing: name or message") end
    local player = getPlayerFromName(body.name)
    if not player then return err(res, "Player not found") end
    outputChatBox("[ADMIN PM] " .. body.message, player, 100, 200, 255)
    return ok(res, {message="Message sent"})
end

-- GET /api/resources — список ресурсів
routes["GET /api/resources"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    local list = {}
    for _, r in ipairs(getResources()) do
        table.insert(list, {
            name   = getResourceName(r),
            status = (getResourceState(r) == "running") and "running" or "stopped",
        })
    end
    return ok(res, list)
end

-- POST /api/resources/start — запуск ресурсу
routes["POST /api/resources/start"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    if not body.name then return err(res, "Missing: name") end
    local r = getResourceFromName(body.name)
    if not r then return err(res, "Resource not found") end
    if getResourceState(r) == "running" then return err(res, "Already running") end
    startResource(r)
    return ok(res, {message="Resource started: " .. body.name})
end

-- POST /api/resources/stop — зупинка ресурсу
routes["POST /api/resources/stop"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    if not body.name then return err(res, "Missing: name") end
    if body.name == "mta-manager-api" then return err(res, "Cannot stop self") end
    local r = getResourceFromName(body.name)
    if not r then return err(res, "Resource not found") end
    stopResource(r)
    return ok(res, {message="Resource stopped: " .. body.name})
end

-- POST /api/resources/restart — рестарт ресурсу
routes["POST /api/resources/restart"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    if not body.name then return err(res, "Missing: name") end
    if body.name == "mta-manager-api" then return err(res, "Cannot restart self") end
    local r = getResourceFromName(body.name)
    if not r then return err(res, "Resource not found") end
    restartResource(r)
    return ok(res, {message="Resource restarted: " .. body.name})
end

-- POST /api/console — виконання команди
routes["POST /api/console"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    if not body.command then return err(res, "Missing: command") end
    executeCommandHandler(body.command, root)
    return ok(res, {message="Command executed: " .. body.command})
end

-- POST /api/broadcast — повідомлення всім гравцям
routes["POST /api/broadcast"] = function(req, res, body)
    if not checkAuth(req) then return err(res, "Unauthorized", 401) end
    if not body.message then return err(res, "Missing: message") end
    outputChatBox("[BROADCAST] " .. body.message, root, 255, 215, 0)
    return ok(res, {message="Broadcast sent"})
end

-- ─── HTTP Handler ────────────────────────────────────────────────────────────

function onRequest(httpRequest, httpResponse)
    local method = httpRequest["Method"]:upper()
    local url    = httpRequest["URL"] or "/"
    -- Видаляємо query string
    local path   = url:match("^([^?]+)") or url
    
    local key = method .. " " .. path
    local handler = routes[key]
    
    -- CORS заголовки (для браузера/додатку)
    httpResponse["Access-Control-Allow-Origin"]  = "*"
    httpResponse["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    httpResponse["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    
    if method == "OPTIONS" then
        httpResponse["Status-Code"] = 204
        outputHTTPResponse("")
        return
    end
    
    if not handler then
        return err(httpResponse, "Route not found: " .. key, 404)
    end
    
    -- Парсимо JSON body
    local body = {}
    local raw  = httpRequest["Body"] or ""
    if raw ~= "" then
        local ok2, parsed = pcall(json.decode, raw)
        if ok2 and type(parsed) == "table" then
            body = parsed
        end
    end
    
    handler(httpRequest, httpResponse, body)
end

-- Реєструємо HTTP handler
addEvent("onHTTPRequest", true)
addEventHandler("onHTTPRequest", root, onRequest)

-- Стартове повідомлення
addEventHandler("onResourceStart", resourceRoot, function()
    outputServerLog("[MTA Manager API] Started on port " .. API_PORT)
    outputServerLog("[MTA Manager API] Change password in server.lua before use!")
end)

outputServerLog("[MTA Manager API] Resource loaded. API ready on :" .. API_PORT)
