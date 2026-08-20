# Sales Agent API

Node + Express API service for Sales Agent Database (MSSQL).

## Quick Start

### 1. Install Dependencies
```bash
cd api
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Start Server
```bash
npm start          # Production mode
npm run dev        # Development with nodemon
```

**Server runs at**: `http://localhost:3000`

## API Endpoints

### Health Check
- `GET /health` — API status

### Core Tables
- `GET /api/doctors` — List doctors
- `GET /api/doctors/:id` — Get specific doctor
- `GET /api/sales-reps` — List sales reps
- `GET /api/products` — List products
- `GET /api/pharmacies` — List pharmacies

### Transactions
- `GET /api/call-planning` — Call records
- `GET /api/secondary-sales` — Sales transactions

### Business Views
- `GET /api/rep-performance` — Monthly rep metrics
- `GET /api/product-trends` — Product sales trends
- `GET /api/call-effectiveness` — Call success metrics
- `GET /api/inactive-doctors` — Doctors not called in 30+ days
- `GET /api/at-risk-territories` — At-risk regions/reps
- `GET /api/territory-coverage` — Territory summary

### Stats
- `GET /api/stats` — Total record counts

## Postman Collection

**Import**: `Sales-Agent-API.postman_collection.json` into Postman

**Setup**:
1. Open Postman
2. File → Import → Select `Sales-Agent-API.postman_collection.json`
3. Set `base_url` variable to `http://localhost:3000`
4. Test endpoints

## Environment Variables

```
NODE_ENV=development        # development or production
API_PORT=3000              # Server port
API_HOST=localhost         # Server host
DB_HOST=34.88.207.18       # MSSQL server IP
DB_PORT=1433               # MSSQL port
DB_NAME=sales_agent_demo   # Database name
DB_USER=sales@dmin         # Database username
DB_PASSWORD=***            # Database password
CORS_ORIGIN=*              # CORS allowed origins
```

## Response Format

All endpoints return JSON:
```json
{
  "success": true,
  "count": 50,
  "data": [...]
}
```

## Error Handling

```json
{
  "success": false,
  "error": "Error message"
}
```

## Next Steps

1. ✅ API running locally
2. ⏭️ Test with Postman collection
3. ⏭️ Deploy to Token Bazaar server
4. ⏭️ Expose via Vertx platform
5. ⏭️ Host on nginx with Vertx domain
