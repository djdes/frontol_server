# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ВАЖНО: Git правила

- **После выполнения любой задачи ВСЕГДА делать commit и push в git автоматически.**
- **Сообщения коммитов ВСЕГДА писать на русском языке.**

## ВАЖНО: Деплой

- **Продакшн-сервер: CHINAMI-2PJMP22** — именно туда деплоится через GitHub Actions self-hosted runner.
- **Текущая машина (BSQL) — тестовая**, используется только для разработки и тестирования.
- **Не настраивать runner на BSQL**, автодеплой работает только на CHINAMI-2PJMP22.

## Project Overview

Frontol Server - Node.js/TypeScript service that bridges Frontol 6 POS system (Firebird database) with Magday backend. Runs on POS terminal as a PM2 service, continuously syncs offline orders to the web system.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTOL 6 POS SYSTEM                                            │
│ Database: Firebird (D:\FRONTOL_DB\MAIN.GDB)                             │
│ Tables: DOCUMENT (orders), TRANZT (items), TRAUTH (payments)    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ FRONTOL SERVER (this repo)   │
        │ Polls every 5 seconds        │
        │ PM2 managed service          │
        │ Location: C:\www\frontol_server │
        └──────────────┬──────────────┘
                       │ HTTP POST (batches of 50)
        ┌──────────────▼──────────────────────┐
        │ MAGDAY BACKEND                       │
        │ https://admin.magday.ru/frontol/     │
        │ order.php                            │
        │ Creates WooCommerce orders           │
        └─────────────────────────────────────┘
```

## Development Commands

```bash
npm run dev      # TypeScript watch mode (compile on change)
npm run build    # Compile TypeScript to build/
npm start        # Run build/index.js
```

## PM2 Process Management

```bash
pm2 start ecosystem.config.js   # Start service
pm2 restart frontol-server      # Restart
pm2 stop frontol-server         # Stop
pm2 logs frontol-server         # View logs
pm2 save                        # Save process list
```

Logs location:
- `C:\www\frontol_server\logs\output.log`
- `C:\www\frontol_server\logs\error.log`

## Configuration Files

### config.json (не трекается в git, шаблон в config.example.json)
```json
{
  "userId": 25,                    // WooCommerce user ID for orders
  "database": "D:\\FRONTOL_DB\\MAIN.GDB"   // Firebird database path
}
```

User IDs (разные машины):
- `24` = frontol2 (Выпечка)
- `25` = frontol3 (Мясо)

### state.json / stateBackup.json (не трекаются в git)
```json
{
  "lastId": 12345
}
```
Tracks last processed order ID for incremental sync.

## Firebird Database Connection

**Connection details** (src/tools.ts):
- Host: localhost
- Port: 3050
- User: SYSDBA
- Password: masterkey
- Database: from config.json or `D:\FRONTOL_DB\MAIN.GDB`

**Key tables**:
- `DOCUMENT` - Orders (STATE, ID, SUMM, SUMMWD, CHEQUENUMBER)
- `TRANZT` - Order items (DOCUMENTID, WARECODE, QUANTITY, SUMM)
- `TRAUTH` - Payment records (presence = card payment)

## Data Flow

### 1. Polling (every 5 seconds)
```typescript
// src/index.ts - eventListener()
setInterval(async () => {
  const orders = await checkOrdersUpdatesOnce();
  // Batch in groups of 50
  for (let i = 0; i < orders.length; i += 50) {
    await sendToSite(orders.slice(i, i + 50));
  }
}, 5000);
```

### 2. Query Orders
```sql
SELECT first 10000 * FROM DOCUMENT
WHERE STATE = 1 AND ID > ${lastId}
ORDER BY ID
```

### 3. Order Processing
- Fetch products from TRANZT table
- Check payment method via TRAUTH table
- Handle cancellations (negative prices = removal)
- Group same products, sum quantities

### 4. Send to Backend
```typescript
// POST https://admin.magday.ru/frontol/order.php
{
  "orders": [
    {
      "STATE": 1,                              // 1 = active, "cancelled" = cancelled
      "ID": 309202,                            // Frontol order ID
      "CHEQUENUMBER": 7528,                    // Receipt number
      "SUMM": 1500.50,                         // Base total
      "SUMMWD": 1450.00,                       // Card-adjusted total
      "products": [
        {
          "code": 12345,                       // Product SKU
          "quantity": 2,
          "price": 500.00,                     // SUMMWD
          "priceBase": 520.00                  // SUMM
        }
      ],
      "isCardPayment": true
    }
  ],
  "userId": 25
}
```

## TypeScript Interfaces

```typescript
// src/index.ts
interface Order {
  STATE: number | "cancelled";
  ID: number;
  CHEQUENUMBER: number;
  SUMM: number;
  SUMMWD: number;
  products: Product[];
  isCardPayment: boolean;
}

interface Product {
  price: number;      // SUMMWD (card-adjusted)
  code: number;       // WARECODE (SKU)
  quantity: number;
  priceBase: number;  // SUMM (base price)
}
```

## Key Functions

### src/index.ts

| Function | Description |
|----------|-------------|
| `main()` | Entry point, starts polling |
| `eventListener()` | Sets up 5-second polling interval |
| `checkOrdersUpdatesOnce()` | Queries new orders since last ID |
| `prepareOrderData()` | Transforms raw data, handles cancellations |
| `sendToSite()` | POSTs orders to backend |
| `getState()` | Reads last ID from state.json, migrates old format |
| `getOrdersSinceId()` | Fetches orders with ID > lastId |
| `saveToFile()` | Persists state |

### src/tools.ts

| Function | Description |
|----------|-------------|
| `DbRequest(query)` | Executes Firebird SQL query |
| `getAllCols()` | Lists all database tables |
| `saveAllCols()` | Exports sample data for debugging |

### src/init.ts

Database health check — verifies Firebird connectivity on deploy.

## Debugging

Set `debug = true` in src/index.ts to enable:
- Saves intermediate data to `debug/` folder
- `debug/data` - Raw orders
- `debug/orders` - Processed orders
- `debug/clearRemovedProducts_*` - Product cleanup steps

Useful debug functions:
```typescript
getOrder(309202)                    // Fetch specific order
getOrdersSinceId(0)                 // Orders since ID
saveAllCols()                       // Export all table samples
```

## Deployment

### GitHub Actions (.github/workflows/deploy.yml)

Triggers on push to `master`:
1. git stash + git pull в C:\www\frontol_server
2. Setup Node.js 18
3. npm ci
4. npm run build
5. PM2 restart (or start if not running)
6. PM2 save

Self-hosted runner на CHINAMI-2PJMP22.

### Manual Deployment

```bash
cd C:\www\frontol_server
git pull
npm ci
npm run build
pm2 restart frontol-server
```

## Error Recovery

State backup system:
- `state.json` corrupted → falls back to `stateBackup.json`
- stateBackup updated with 10-second delay for atomicity
- On migration from old format: queries MAX(ID) to start from current point

Concurrent operation prevention:
- `innerState.eventListenerinProgress` flag
- `innerState.checkOrdersUpdatesInProgress` flag
- Prevents overlapping polling cycles

## Troubleshooting

### Service not starting
```bash
pm2 logs frontol-server --lines 50
# Check for Firebird connection errors
```

### Orders not syncing
1. Check state.json lastId
2. Verify Firebird database path in config.json
3. Test backend endpoint manually:
```bash
curl -X POST https://admin.magday.ru/frontol/order.php \
  -d '{"orders":[],"userId":25}'
```

### Firebird connection error
- Verify Firebird service running
- Check database path exists
- Default credentials: SYSDBA / masterkey

## File Structure

```
frontol_server/
├── src/
│   ├── index.ts          # Main logic, polling, data processing
│   ├── tools.ts          # Database utilities
│   ├── init.ts           # Database health check
│   └── types/
│       └── DOCUMENT.d.ts # Full DOCUMENT table schema
├── build/                # Compiled JavaScript
├── logs/                 # PM2 logs
├── debug/                # Debug output (when enabled)
├── config.json           # Database path, user ID (not in git)
├── config.example.json   # Config template (in git)
├── state.json            # Last sync ID (not in git)
├── stateBackup.json      # Backup ID (not in git)
├── ecosystem.config.js   # PM2 configuration
├── tsconfig.json         # TypeScript config
└── package.json
```

## Dependencies

- `node-firebird` - Firebird database client
- `node-fetch` - HTTP requests
- `nodemailer` - Email (unused)
- `typescript` - Build tool

## Related Repositories

- **Frontend**: https://github.com/djdes/managermagday
- **Backend**: https://github.com/djdes/magday-backend
  - Endpoint: `frontol/order.php` receives orders from this service
