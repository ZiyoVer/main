# DTMMax Agent Room

Claude, Codex va Kimi o‘rtasidagi vositachilikni avtomatlashtiradigan lokal
koordinator. Agent Room DTMMax production backendiga ulanmaydi va uning
credentiallarini o‘qimaydi.

## V1 imkoniyatlari

- SQLite’da durable task queue va audit jurnal;
- agent inbox, savol-javob va dalil xabarlari;
- priority va preferred-agent routing;
- hierarchical fayl/papka lock;
- ikkinchi agent reviewi;
- human-only high-risk approval;
- har yozuvchi task uchun alohida Git worktree va `agent/<agent>/<task>` branch;
- SSE orqali realtime activity feed;
- Claude, Kimi va Codex CLI supervisor adapterlari;
- turn, vaqt va Claude budget limiti;
- child agentlarga parent process secretlarini bermaydigan environment allowlist;
- `main` va `reysh`ni kod darajasida bloklash;
- supervisor tomonidan push, merge yoki deploy yo‘qligi.

## Xavfsizlik darajalari

| Daraja | Avtomatik holat |
|---|---|
| `read_only` | Plan rejimida bajariladi va ikkinchi agent review qiladi |
| `low` / `medium` | Faqat `AGENT_ROOM_ALLOW_WRITES=true` va execute rejimida task worktree’da |
| `high` | Yuqoridagilarga qo‘shimcha `high_risk_work` human approval talab qiladi |
| `critical` | Supervisor avtomatik bajarmaydi |

Paylov/billing, Prisma schema/migration, `.env`, deploy va GitHub workflow
yo‘llari avtomatik ravishda high/critical tasniflanadi.

## Ishga tushirish

Node.js 22.5+ kerak (`node:sqlite` ishlatiladi).

```bash
cd agent-room
npm install
npm run check
```

Terminal 1:

```bash
cd agent-room
npm start
```

Terminal 2 — avval faqat read-only plan rejimi:

```bash
cd agent-room
npm run supervisor
```

Yoki server va supervisorni bitta terminalda:

```bash
npm run start:all
```

Health va realtime feed:

```bash
curl -fsS http://127.0.0.1:3101/health
curl -N http://127.0.0.1:3101/events
```

`.mcp.json` va `.kimi-code/mcp.json` ichiga Agent Room endpointi qo‘shilgan.
Claude/Kimi sessiyasini qayta ochgandan keyin `room_*` toollar ko‘rinadi.

## Birinchi xavfsiz sinov

```bash
cd agent-room
node build/cli.js demo
npm run supervisor
```

Demo task Claude’ga read-only audit beradi. Claude natijani `lead` inboxiga
yozadi, supervisor Kimi yoki boshqa sog‘lom agentdan review so‘raydi. Hech
qanday fayl o‘zgarmaydi.

Holat:

```bash
npm run status
node build/cli.js inbox lead
node build/cli.js summary
```

## Yozuvchi task

Yozuvchi task quyidagilarsiz yaratilmaydi:

- `riskLevel`: `low`, `medium` yoki `high`;
- `allowedPaths`: agent tegishi mumkin bo‘lgan aniq fayl/papkalar;
- acceptance criteria;
- `AGENT_ROOM_SUPERVISOR_MODE=execute`;
- `AGENT_ROOM_ALLOW_WRITES=true`.

Supervisor:

1. task branch va worktree yaratadi;
2. allowed pathlarni lock qiladi;
3. agentga faqat shu chegarani beradi;
4. natijadan keyin tashqaridagi diffni bloklaydi;
5. `git diff --check` qiladi;
6. task branchda lokal commit yaratadi;
7. boshqa agentga review yuboradi;
8. hech qayerga push yoki merge qilmaydi.

## Human approval

Agent high-risk task uchun:

```text
room_request_approval(taskId, "high_risk_work", ...)
```

deydi. Faqat lokal terminaldagi human CLI tasdiqlay oladi:

```bash
node build/cli.js approve <taskId> high_risk_work "Tasdiq sababi"
```

Agentning o‘zi approval bera olmaydi.

## 24/7 ishlash

Lokal supervisor faqat kompyuter uyg‘oq turganda ishlaydi. macOS’da vaqtincha:

```bash
npm run overnight
```

Bu buyruq server va supervisorni birga ishga tushiradi hamda macOS uyqu rejimini
process tugaguncha ushlab turadi. Keyingi bosqichda launchd yoki ajratilgan
Railway worker tayyorlanadi.

Railway varianti production DTMMax servisidan, bazasidan va secretlaridan
butunlay ajratilishi shart. Loopback tashqarisida `AGENT_ROOM_TOKEN` majburiy.

Agent CLI loginlari odatda `HOME` ichidagi o‘z keychain/configidan foydalanadi.
`AGENT_ROOM_FORWARD_AUTH_ENV=false` default holatda `DATABASE_URL`, Paylov,
JWT, S3 va boshqa app secretlari child agentga uzatilmaydi. Faqat CLI auth
keychain orqali ishlamasa, alohida agent credential bilan forwardingni ongli
ravishda yoqish mumkin.

### Codex va Node arxitekturasi

Agent Room defaultda `bin/codex-local` wrapperidan foydalanadi. Wrapper NVM
bilan o‘rnatilgan Codex launcheri yonidagi `node` binarysini tanlaydi; shu
sabab parent process boshqa Node arxitekturasida ishlasa ham Codex to‘g‘ri
ishga tushadi. Kerak bo‘lsa `AGENT_ROOM_CODEX_BIN` yoki
`AGENT_ROOM_CODEX_COMMAND` bilan aniq yo‘l berish mumkin.

## Hozirgi cheklovlar

- Codex CLI health ishlamasa supervisor uni `offline` qiladi; boshqa agentlar
  ishlashda davom etadi.
- Claude write tasklaridan oldin workspace trust dialogi interaktiv sessiyada
  bir marta tasdiqlangan bo‘lishi kerak.
- Agent Room task branchini integration branchga avtomatik merge qilmaydi.
- Brauzer UI hali yo‘q; holat MCP, CLI, JSON snapshot va SSE orqali ko‘rinadi.
- SQLite lokal V1 uchun; bir nechta server replika uchun PostgreSQL adapter
  kerak bo‘ladi.
