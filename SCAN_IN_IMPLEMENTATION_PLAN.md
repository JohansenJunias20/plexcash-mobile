# Scan In Feature - Complete Implementation Plan
**Plex Cash E-commerce System**

**Date:** 2026-02-21  
**Feature:** Scan In - Returned Package Tracking System  
**Target Platforms:** Web Application + Mobile Application  
**Reference Implementation:** Scan Out Feature

---

## 1. Executive Summary

This document provides a comprehensive implementation plan for the **Scan In** feature, which tracks returned/incoming packages by scanning barcodes. This feature mirrors the existing **Scan Out** functionality but uses a separate `scan_in` database table to maintain independent tracking of returns.

### 1.1 Business Purpose
- **Track returned packages** from customers/marketplaces
- **Separate database** from Scan Out to maintain data integrity
- **Audit trail** for return processing and inventory management
- **Real-time visibility** into incoming returns across web and mobile

### 1.2 Scope Inclusions
✅ Separate `scan_in` database table with identical structure to `scan_out`  
✅ Backend API endpoints: `/scanin/scan`, `/scanin/search`, `/scanin/order-details`  
✅ Web frontend component: `Server/view/Components/core/Ecommerce/Scan In/Scan In.tsx`  
✅ Mobile frontend screen: `screens/scanin/ScanInScreen.tsx`  
✅ Barcode scanning (camera + Bluetooth scanner support)  
✅ Search and view historical scans with pagination  
✅ Order details lookup by tracking number  
✅ Duplicate scan prevention  
✅ Authentication and authorization  

### 1.3 Scope Exclusions
❌ Integration with inventory adjustment (future enhancement)  
❌ Return reason tracking (future enhancement)  
❌ Automatic refund processing (future enhancement)  

### 1.4 Key Differences from Scan Out
| Aspect | Scan Out | Scan In |
|--------|----------|---------|
| **Purpose** | Track outgoing shipments | Track incoming returns |
| **Database Table** | `scanout` | `scan_in` |
| **API Endpoints** | `/scanout/*` | `/scanin/*` |
| **UI Label** | "Scan Out" | "Scan In" |
| **Business Logic** | Same validation, different table | Same validation, different table |

---

## 2. Database Schema

### 2.1 Table Structure: `scan_in`

```sql
CREATE TABLE IF NOT EXISTS scan_in (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resi VARCHAR(300) NOT NULL UNIQUE COMMENT 'Tracking number from returnUntuk create tabel,  shipping label barcode',
    time_scan DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when return barcode was scanned',
    INDEX idx_resi (resi),
    INDEX idx_time_scan (time_scan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks scanned return shipping labels for incoming packages';
```

### 2.2 Column Specifications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for each scan record |
| `resi` | VARCHAR(300) | NOT NULL, UNIQUE | Tracking number from shipping label (unique constraint prevents duplicate scans) |
| `time_scan` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Timestamp when barcode was scanned (Indonesia timezone GMT+7) |

### 2.3 Indexes

1. **Primary Key Index**: `id` (automatic)
2. **Unique Index**: `resi` (prevents duplicate scans)
3. **Performance Index**: `idx_resi` (fast lookup by tracking number)
4. **Performance Index**: `idx_time_scan` (fast date range queries)

### 2.4 Database Migration Script

**File:** `create-scanin-table.js`

```javascript
/**
 * Create scan_in table in all tenant databases
 *
 * This script creates the scan_in table in all tenant databases
 * to track scanned return shipping labels for incoming packages.
 *
 * Usage: node create-scanin-table.js
 */

const { pool } = require('./Server/Connection');
const util = require('util');

async function createScanInTable() {
    let connection;

    try {
        console.log('🔌 Getting connection from pool...');
        connection = await new Promise((resolve, reject) => {
            pool.getConnection((err, conn) => {
                if (err) reject(err);
                else resolve(conn);
            });
        });

        // Promisify query function
        const query = util.promisify(connection.query).bind(connection);

        console.log('✅ Connected to MySQL successfully\n');

        // Get all tenant databases from user_mapping.roles
        console.log('📋 Fetching all tenant databases...');
        const databases = await query(`
            SELECT DISTINCT database_name
            FROM user_mapping.roles
            WHERE database_name IS NOT NULL
            AND database_name != ''
            ORDER BY database_name
        `);

        console.log(`Found ${databases.length} tenant databases\n`);

        if (databases.length === 0) {
            console.log('⚠️  No tenant databases found. Exiting.');
            return;
        }

        // Create scan_in table in each tenant database
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS scan_in (
                id INT AUTO_INCREMENT PRIMARY KEY,
                resi VARCHAR(300) NOT NULL UNIQUE COMMENT 'Tracking number from return shipping label barcode',
                time_scan DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when return barcode was scanned',
                INDEX idx_resi (resi),
                INDEX idx_time_scan (time_scan)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Tracks scanned return shipping labels for incoming packages'
        `;

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const db of databases) {
            const dbName = db.database_name;

            try {
                console.log(`📦 Processing database: ${dbName}`);

                // Use the database
                await query(`USE \`${dbName}\``);

                // Check if table already exists
                const tables = await query(`
                    SELECT TABLE_NAME
                    FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = ?
                    AND TABLE_NAME = 'scan_in'
                `, [dbName]);

                if (tables.length > 0) {
                    console.log(`   ℹ️  Table 'scan_in' already exists in ${dbName}`);
                } else {
                    // Create the table
                    await query(createTableQuery);
                    console.log(`   ✅ Created 'scan_in' table in ${dbName}`);
                }

                successCount++;

            } catch (error) {
                errorCount++;
                const errorMsg = `Error in database ${dbName}: ${error.message}`;
                errors.push(errorMsg);
                console.error(`   ❌ ${errorMsg}`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successful: ${successCount} databases`);
        console.log(`❌ Failed: ${errorCount} databases`);

        if (errors.length > 0) {
            console.log('\n❌ ERRORS:');
            errors.forEach(err => console.log(`   - ${err}`));
        }

        console.log('\n✅ Migration completed!');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            connection.release();
            console.log('🔌 Connection released');
        }
        pool.end();
    }
}

// Run migration
createScanInTable();
```

### 2.5 Prisma Schema Update

**File:** `Server/Model/prisma/schema.prisma`

Add after the `scanout` model (around line 1555):

```prisma
/// This model or at least one of its fields has comments in the database, and requires an additional setup for migrations: Read more: https://pris.ly/d/database-comments
model scan_in {
  id        Int      @id @default(autoincrement())
  resi      String   @unique(map: "resi") @db.VarChar(300)
  time_scan DateTime @default(now()) @db.DateTime(0)

  @@index([resi], map: "idx_resi")
  @@index([time_scan], map: "idx_time_scan")
}
```

---

## 3. Backend API Specification

### 3.1 API Endpoints Overview

| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|----------------|
| `/scanin/scan` | POST | Record a new scan | Required |
| `/scanin/search` | GET | Search scan history | Required |
| `/scanin/order-details` | GET | Get order details by resi | Required |

### 3.2 Endpoint: POST `/scanin/scan`

**Purpose:** Record a scanned return tracking number

**Request:**
```json
{
  "resi": "JNE123456789"
}
```

**Validation Rules:**
1. `resi` is required (non-empty string)
2. `resi` must exist in `penjualan_online.no_resi` (validates ownership)
3. `resi` must not already exist in `scan_in` table (prevents duplicates)

**Success Response (200):**
```json
{
  "status": true,
  "message": "Resi scanned successfully",
  "data": {
    "id": 123,
    "resi": "JNE123456789",
    "time_scan": "2026-02-21 14:30:45"
  }
}
```

**Error Responses:**

**Missing/Invalid Input (200):**
```json
{
  "status": false,
  "reason": "Resi (tracking number) is required"
}
```

**Resi Not Found (200):**
```json
{
  "status": false,
  "reason": "Resi not found, maybe owned by different store"
}
```

**Duplicate Scan (200):**
```json
{
  "status": false,
  "reason": "Resi already scanned",
  "data": {
    "resi": "JNE123456789",
    "time_scan": "2026-02-21 10:15:30",
    "message": "This tracking number was already scanned on 21/02/2026, 10:15:30"
  }
}
```

**Server Error (200):**
```json
{
  "status": false,
  "reason": "Error scanning resi"
}
```

### 3.3 Endpoint: GET `/scanin/search`

**Purpose:** Search and paginate scan history

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resi` | string | No | Partial match search on tracking number |
| `date_from` | string (YYYY-MM-DD) | No | Start date filter |
| `date_to` | string (YYYY-MM-DD) | No | End date filter |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 25) |

**Example Request:**
```
GET /scanin/search?date_from=2026-02-15&date_to=2026-02-21&page=1&limit=10
```

**Success Response (200):**
```json
{
  "status": true,
  "data": [
    {
      "id": 123,
      "resi": "JNE123456789",
      "time_scan": "2026-02-21 14:30:45",
      "order_id": 456,
      "id_online": "SHOPEE-ORDER-123",
      "id_penjualan": "PJ-2026-001",
      "tanggal_order": "2026-02-15 10:00:00",
      "total_barang": 25000.00,
      "status": "COMPLETED",
      "buyer_username": "customer123",
      "shop_name": "My Store",
      "platform": "SHOPEE"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "total_pages": 5
  }
}
```

**Error Response (200):**
```json
{
  "status": false,
  "reason": "Error searching scan_in records"
}
```

### 3.4 Endpoint: GET `/scanin/order-details`

**Purpose:** Get detailed order information by tracking number

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resi` | string | Yes | Tracking number |

**Example Request:**
```
GET /scanin/order-details?resi=JNE123456789
```

**Success Response (200):**
```json
{
  "status": true,
  "data": {
    "id": 456,
    "id_order": "SHOPEE-ORDER-123",
    "id_penjualan": "PJ-2026-001",
    "shop_name": "My Store",
    "platform": "SHOPEE",
    "no_resi": "JNE123456789",
    "tanggal": "2026-02-15 10:00:00",
    "status": "COMPLETED",
    "total_barang": 25000.00,
    "buyer_username": "customer123",
    "buyer_city": "Jakarta",
    "scan_timestamp": "2026-02-21 14:30:45",
    "scanned": true,
    "items": [
      {
        "id": 789,
        "id_masterbarang": 101,
        "nama": "Product A",
        "sku": "SKU-001",
        "merk": "Brand X",
        "kategori": "Electronics",
        "satuan": "pcs",
        "qty": 2,
        "harga": 10000.00,
        "subtotal": 20000.00
      }
    ],
    "total": 25000.00
  }
}
```

**Error Responses:**

**Missing Resi (200):**
```json
{
  "status": false,
  "reason": "Resi (tracking number) is required"
}
```

**Order Not Found (200):**
```json
{
  "status": false,
  "reason": "Order not found for this resi"
}
```

---

## 4. Backend Implementation

### 4.1 Route Registration

**File:** `Server/index.js`

Add after the existing scanout routes (around line 9200):

```javascript
// ========================================
// SCAN IN ENDPOINTS - Return Package Tracking
// ========================================

// Scan In endpoint - Record scanned return shipping label barcodes
app.post("/scanin/scan", isAuthenticated, isAllowed, async (req, res) => {
    try {
        const { resi } = req.body;

        // Validate input
        if (!resi || typeof resi !== 'string' || resi.trim() === '') {
            return res.send({
                status: false,
                reason: "Resi (tracking number) is required"
            });
        }

        const cleanResi = resi.trim();
        const connection = res.locals.connection;

        // Verify resi exists in penjualan_online (ownership check)
        var sql = "SELECT * FROM penjualan_online WHERE no_resi = ?";
        var [result] = await connection.query(sql, [cleanResi]);

        if (result.length == 0) {
            return res.send({
                status: false,
                reason: "Resi not found, maybe owned by different store"
            });
        }

        // Check if resi already scanned in scan_in table
        const checkSql = "SELECT id, resi, time_scan FROM scan_in WHERE resi = ?";
        const [existingRecords] = await connection.query(checkSql, [cleanResi]);

        if (existingRecords.length > 0) {
            const existing = existingRecords[0];
            return res.send({
                status: false,
                reason: "Resi already scanned",
                data: {
                    resi: existing.resi,
                    time_scan: existing.time_scan,
                    message: `This tracking number was already scanned on ${new Date(existing.time_scan).toLocaleString('id-ID')}`
                }
            });
        }

        // Insert new scan record with Indonesia timezone (GMT+7)
        const insertSql = "INSERT INTO scan_in (resi, time_scan) VALUES (?, CONVERT_TZ(NOW(), '+00:00', '+07:00'))";
        const [insertResult] = await connection.query(insertSql, [cleanResi]);

        // Get the inserted record
        const [newRecord] = await connection.query(
            "SELECT id, resi, time_scan FROM scan_in WHERE id = ?",
            [insertResult.insertId]
        );

        console.log(`[ScanIn] Successfully scanned return resi: ${cleanResi}`);

        res.send({
            status: true,
            message: "Resi scanned successfully",
            data: {
                id: newRecord[0].id,
                resi: newRecord[0].resi,
                time_scan: newRecord[0].time_scan
            }
        });

    } catch (error) {
        console.error('[ScanIn] Error scanning resi:', error);
        res.send({
            status: false,
            reason: error instanceof Error ? error.message : "Error scanning resi"
        });
    }
});

// Scan In Search endpoint - Search and list previously scanned returns
app.get("/scanin/search", isAuthenticated, isAllowed, async (req, res) => {
    try {
        const connection = res.locals.connection;
        const { resi, date_from, date_to, page = 1, limit = 25 } = req.query;

        const offset = (Number(page) - 1) * Number(limit);

        let whereConditions = [];
        let params = [];

        // Filter by resi (partial match)
        if (resi && typeof resi === 'string' && resi.trim() !== '') {
            whereConditions.push("s.resi LIKE ?");
            params.push(`%${resi.trim()}%`);
        }

        // Filter by date range
        if (date_from && typeof date_from === 'string') {
            whereConditions.push("DATE(s.time_scan) >= ?");
            params.push(date_from);
        }

        if (date_to && typeof date_to === 'string') {
            whereConditions.push("DATE(s.time_scan) <= ?");
            params.push(date_to);
        }

        const whereClause = whereConditions.length > 0
            ? "WHERE " + whereConditions.join(" AND ")
            : "";

        // Get total count
        const countSql = `SELECT COUNT(*) as total FROM scan_in s ${whereClause}`;
        const [countResult] = await connection.query(countSql, params);
        const total = countResult[0].total;

        // Get scan_in records with joined order info from penjualan_online
        const sql = `
            SELECT
                s.id,
                s.resi,
                s.time_scan,
                po.id as order_id,
                po.id_online,
                po.id_penjualan,
                po.tanggal_order,
                po.total_barang,
                po.status,
                po.buyer_username,
                e.name as shop_name,
                e.platform
            FROM scan_in s
            LEFT JOIN penjualan_online po ON s.resi = po.no_resi
            LEFT JOIN ecommerce e ON po.shop_id = e.shop_id AND po.platform = e.platform
            ${whereClause}
            ORDER BY s.time_scan DESC
            LIMIT ? OFFSET ?
        `;

        const [records] = await connection.query(sql, [...params, Number(limit), offset]);

        res.send({
            status: true,
            data: records,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                total_pages: Math.ceil(total / Number(limit))
            }
        });

    } catch (error) {
        console.error('[ScanIn] Error searching scan_in records:', error);
        res.send({
            status: false,
            reason: error instanceof Error ? error.message : "Error searching scan_in records"
        });
    }
});

// Scan In Order Details endpoint - Get order details by resi
app.get("/scanin/order-details", isAuthenticated, isAllowed, async (req, res) => {
    try {
        const connection = res.locals.connection;
        const { resi } = req.query;

        if (!resi || typeof resi !== 'string' || resi.trim() === '') {
            return res.send({
                status: false,
                reason: "Resi (tracking number) is required"
            });
        }

        const cleanResi = resi.trim();

        // Get order info from penjualan_online
        const orderSql = `
            SELECT
                po.*,
                e.name as shop_name,
                s.time_scan as scan_timestamp
            FROM penjualan_online po
            LEFT JOIN ecommerce e ON po.shop_id = e.shop_id AND po.platform = e.platform
            LEFT JOIN scan_in s ON po.no_resi = s.resi
            WHERE po.no_resi = ?
        `;

        const [orderResult] = await connection.query(orderSql, [cleanResi]);

        if (orderResult.length === 0) {
            return res.send({
                status: false,
                reason: "Order not found for this resi"
            });
        }

        const order = orderResult[0];

        // Get order items from detailpenjualanonline
        const itemsSql = `
            SELECT
                dpo.id,
                dpo.sku,
                dpo.nama,
                dpo.id_online,
                dpo.qty,
                dpo.harga_jual,
                mb.id as id_masterbarang,
                mb.nama_barang,
                mb.merk,
                mb.kategori,
                mb.satuan
            FROM detailpenjualanonline dpo
            LEFT JOIN masterbarang mb ON dpo.sku = mb.sku
            WHERE dpo.id_po = ?
        `;

        const [itemsResult] = await connection.query(itemsSql, [order.id]);

        // Calculate totals
        const items = itemsResult.map(item => ({
            id: item.id,
            id_masterbarang: item.id_masterbarang || null,
            nama: item.nama || item.nama_barang || 'Unknown',
            sku: item.sku || '',
            merk: item.merk || '',
            kategori: item.kategori || '',
            satuan: item.satuan || 'pcs',
            qty: item.qty,
            harga: parseFloat(item.harga_jual) || 0,
            subtotal: (item.qty * (parseFloat(item.harga_jual) || 0))
        }));

        const total = items.reduce((sum, item) => sum + item.subtotal, 0);

        res.send({
            status: true,
            data: {
                id: order.id,
                id_order: order.id_online,
                id_penjualan: order.id_penjualan,
                shop_name: order.shop_name,
                platform: order.platform,
                no_resi: order.no_resi,
                tanggal: order.tanggal_order,
                status: order.status,
                total_barang: order.total_barang,
                buyer_username: order.buyer_username,
                buyer_city: order.buyer_city,
                scan_timestamp: order.scan_timestamp,
                scanned: !!order.scan_timestamp,
                items,
                total
            }
        });

    } catch (error) {
        console.error('[ScanIn] Error fetching order details:', error);
        res.send({
            status: false,
            reason: error instanceof Error ? error.message : "Error fetching order details"
        });
    }
});
```

---

## 5. Frontend Implementation - Web Application

### 5.1 Component Location

**File:** `Server/view/Components/core/Ecommerce/Scan In/Scan In.tsx`

### 5.2 Component Structure

The web component is a **React Class Component** with the following structure:

```typescript
interface ScannedOrder {
    orderNumber: string;
    timestamp: Date;
    status: 'success' | 'error';
    message?: string;
}

interface SearchResult {
    id: number;
    resi: string;
    time_scan: string;
    order_id: number | null;
    id_order: string | null;
    id_ecommerce: number | null;
    tanggal_order: string | null;
    total_barang: number | null;
    status: string | null;
    buyer_username: string | null;
    shop_name: string | null;
    platform: string | null;
}

interface OrderDetails {
    id: number;
    id_order: string;
    id_penjualan: string;
    shop_name: string;
    platform: string;
    no_resi: string;
    tanggal: string;
    status: string;
    total_barang: number;
    buyer_username: string;
    buyer_city: string;
    scan_timestamp: string | null;
    scanned: boolean;
    items: OrderItem[];
    total: number;
}

interface State {
    // Scanning tab state
    scannedOrders: ScannedOrder[];
    manualInput: string;
    processing: boolean;
    pendingScans: Set<string>;
    cameraActive: boolean;
    cameraError: string | null;
    snackbar: {
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'warning' | 'info';
    };
    clearDialogOpen: boolean;
    focusLocked: boolean;

    // Tab state
    activeTab: number;

    // Search tab state
    searchResi: string;
    searchDateFrom: string;
    searchDateTo: string;
    searchResults: SearchResult[];
    searchLoading: boolean;
    searchPage: number;
    searchLimit: number;
    searchTotal: number;

    // Order details dialog
    orderDetailsOpen: boolean;
    orderDetails: OrderDetails | null;
    orderDetailsLoading: boolean;
}
```

### 5.3 Key Features

**Tab 1: Scan**
- Camera-based barcode scanning (BarcodeDetector API)
- Manual input field for Bluetooth scanners
- Real-time scan feedback with visual indicators
- Duplicate scan prevention (client-side + server-side)
- Order number filtering (reject order numbers, accept only resi)
- Scanned orders list with success/error status
- Clear all scans functionality
- Focus lock for Bluetooth scanner support

**Tab 2: Search & View**
- Search by tracking number (partial match)
- Date range filtering (from/to dates)
- Pagination (10/25/50/100 items per page)
- Order details modal with full item breakdown
- Export to PDF functionality (future enhancement)

### 5.4 API Integration Points

```typescript
// Scan endpoint
const response = await fetch('/scanin/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resi: data })
});

// Search endpoint
const params = new URLSearchParams({
    page: (searchPage + 1).toString(),
    limit: searchLimit.toString(),
    resi: searchResi.trim(),
    date_from: searchDateFrom,
    date_to: searchDateTo
});
const response = await fetch(`/scanin/search?${params.toString()}`);

// Order details endpoint
const response = await fetch(`/scanin/order-details?resi=${encodeURIComponent(resi)}`);
```

### 5.5 Route Registration

**File:** `Server/view/Components/core/Main.tsx`

Add after the scanout route (around line 600):

```typescript
{
    context.state.access.ecommerce?.scanin &&
    <Route path='/scanin' children={(props) =>
        <ScanIn {...props} />
    } />
}
```

**Import statement:**
```typescript
import ScanIn from './Ecommerce/Scan In/Scan In';
```

### 5.6 Permission Requirements

The feature requires the `ecommerce.scanin` permission in the user's access control object.

---

## 6. Frontend Implementation - Mobile Application

### 6.1 Screen Location

**File:** `screens/scanin/ScanInScreen.tsx`

### 6.2 Component Structure

The mobile screen is a **React Functional Component** using hooks:

```typescript
interface ScannedOrder {
  orderNumber: string;
  timestamp: Date;
  status: 'success' | 'error';
  message?: string;
}

export default function ScanInScreen(): JSX.Element {
  // State management
  const [hasPermission, setHasPermission] = useState(false);
  const [scannedOrders, setScannedOrders] = useState<ScannedOrder[]>([]);
  const [scanning, setScanning] = useState(true);
  const [currentScan, setCurrentScan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [pendingScans, setPendingScans] = useState<Set<string>>(new Set());
  const [manualInput, setManualInput] = useState('');

  // Camera setup
  const device = useCameraDevice('back');
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'code-128', 'code-39', 'ean-13', 'ean-8'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0].value) {
        handleBarcodeScanned({ data: codes[0].value });
      }
    },
  });

  // ... component logic
}
```

### 6.3 Key Features

- **Camera Scanning**: React Native Vision Camera with barcode detection
- **Bluetooth Scanner Support**: TextInput field for external scanners
- **Haptic Feedback**: Success (light) and error (heavy) vibrations
- **Order Number Filtering**: Reject order numbers, accept only resi
- **Duplicate Prevention**: Client-side + server-side validation
- **Scan History**: FlatList of scanned items with status indicators
- **Manual Input**: Fallback for camera issues or Bluetooth scanners
- **Permission Handling**: Camera permission request with settings redirect

### 6.4 API Integration

```typescript
// Scan endpoint
const response = await ApiService.authenticatedRequest('/scanin/scan', {
  method: 'POST',
  body: JSON.stringify({ resi: data }),
});
```

### 6.5 Navigation Setup

**File:** `navigation/DrawerNavigator.tsx` (or equivalent)

Add drawer item:

```typescript
<Drawer.Screen
  name="ScanIn"
  component={ScanInScreen}
  options={{
    drawerLabel: 'Scan In',
    drawerIcon: ({ color, size }) => (
      <Ionicons name="scan" size={size} color={color} />
    ),
  }}
/>
```

---

## 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────▼─────┐           ┌──────▼──────┐
              │  Web App  │           │  Mobile App │
              │ (React)   │           │ (React Native)│
              └─────┬─────┘           └──────┬──────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Barcode Scanned       │
                    │   (Camera/Bluetooth)    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Client-Side Validation │
                    │  - Not empty            │
                    │  - Not order number     │
                    │  - Not in pending set   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  POST /scanin/scan      │
                    │  { resi: "JNE123..." }  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Backend Validation     │
                    │  1. Resi exists in      │
                    │     penjualan_online?   │
                    │  2. Not in scan_in?     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  INSERT INTO scan_in    │
                    │  (resi, time_scan)      │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Return Success         │
                    │  { status: true,        │
                    │    data: {...} }        │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Update UI              │
                    │  - Add to scanned list  │
                    │  - Show success message │
                    │  - Play haptic feedback │
                    └─────────────────────────┘
```

---

## 8. Error Handling Strategy

### 8.1 Client-Side Error Handling

**Web Application:**
```typescript
try {
    const response = await fetch('/scanin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resi: data })
    });

    const result = await response.json();

    if (result?.status) {
        // Success handling
        this.setState({
            scannedOrders: [newOrder, ...prevState.scannedOrders],
            snackbar: {
                open: true,
                message: 'Resi berhasil di-scan!',
                severity: 'success'
            }
        });
    } else {
        // Error handling
        this.setState({
            scannedOrders: [errorOrder, ...prevState.scannedOrders],
            snackbar: {
                open: true,
                message: result?.reason || 'Unknown error',
                severity: 'error'
            }
        });
    }
} catch (error) {
    // Network error handling
    console.error('Error scanning barcode:', error);
    this.setState({
        snackbar: {
            open: true,
            message: 'Gagal menghubungi server. Periksa koneksi internet Anda.',
            severity: 'error'
        }
    });
}
```

**Mobile Application:**
```typescript
try {
    const response = await ApiService.authenticatedRequest('/scanin/scan', {
        method: 'POST',
        body: JSON.stringify({ resi: data }),
    });

    if (response?.status) {
        // Success - light haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setScannedOrders(prev => [newOrder, ...prev]);
    } else {
        // Error - heavy haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert('✗ Scan Gagal', response?.reason || 'Unknown error');
    }
} catch (error) {
    // Network error
    console.error('Error scanning barcode:', error);
    Alert.alert('✗ Network Error', 'Gagal menghubungi server');
}
```

### 8.2 Server-Side Error Handling

```javascript
app.post("/scanin/scan", isAuthenticated, isAllowed, async (req, res) => {
    try {
        // ... business logic
    } catch (error) {
        console.error('[ScanIn] Error scanning resi:', error);
        res.send({
            status: false,
            reason: error instanceof Error ? error.message : "Error scanning resi"
        });
    }
});
```

### 8.3 Error Categories

| Error Type | HTTP Status | Response Format | User Message |
|------------|-------------|-----------------|--------------|
| Validation Error | 200 | `{ status: false, reason: "..." }` | "Resi (tracking number) is required" |
| Not Found | 200 | `{ status: false, reason: "..." }` | "Resi not found, maybe owned by different store" |
| Duplicate | 200 | `{ status: false, reason: "...", data: {...} }` | "Resi already scanned on [date]" |
| Server Error | 200 | `{ status: false, reason: "..." }` | "Error scanning resi" |
| Network Error | N/A | Exception | "Gagal menghubungi server. Periksa koneksi internet Anda." |

---

## 9. Authentication & Authorization

### 9.1 Middleware Stack

All Scan In endpoints use the following middleware:

```javascript
app.post("/scanin/scan", isAuthenticated, isAllowed, async (req, res) => {
    // ... handler
});
```

**Middleware Breakdown:**
1. **`isAuthenticated`**: Verifies user session/token
2. **`isAllowed`**: Checks user permissions for the route
3. **Database Connection**: Injected via `res.locals.connection` (tenant-specific)

### 9.2 Permission Requirements

**Web Application:**
- Permission key: `context.state.access.ecommerce?.scanin`
- Route protection: Conditional rendering in `Main.tsx`

**Mobile Application:**
- Permission key: Same as web (synced from backend)
- Navigation: Drawer item visibility based on permission

### 9.3 Tenant Isolation

- Each tenant has their own `scan_in` table in their database
- Database connection is tenant-specific via `res.locals.connection`
- No cross-tenant data leakage possible

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Backend API Tests:**
```javascript
describe('POST /scanin/scan', () => {
    it('should reject empty resi', async () => {
        const response = await request(app)
            .post('/scanin/scan')
            .send({ resi: '' });
        expect(response.body.status).toBe(false);
        expect(response.body.reason).toContain('required');
    });

    it('should reject non-existent resi', async () => {
        const response = await request(app)
            .post('/scanin/scan')
            .send({ resi: 'INVALID-RESI' });
        expect(response.body.status).toBe(false);
        expect(response.body.reason).toContain('not found');
    });

    it('should reject duplicate scan', async () => {
        // First scan
        await request(app)
            .post('/scanin/scan')
            .send({ resi: 'JNE123456789' });

        // Second scan (duplicate)
        const response = await request(app)
            .post('/scanin/scan')
            .send({ resi: 'JNE123456789' });

        expect(response.body.status).toBe(false);
        expect(response.body.reason).toContain('already scanned');
    });

    it('should successfully scan valid resi', async () => {
        const response = await request(app)
            .post('/scanin/scan')
            .send({ resi: 'JNE123456789' });

        expect(response.body.status).toBe(true);
        expect(response.body.data.resi).toBe('JNE123456789');
        expect(response.body.data.time_scan).toBeDefined();
    });
});

describe('GET /scanin/search', () => {
    it('should return paginated results', async () => {
        const response = await request(app)
            .get('/scanin/search?page=1&limit=10');

        expect(response.body.status).toBe(true);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter by resi', async () => {
        const response = await request(app)
            .get('/scanin/search?resi=JNE123');

        expect(response.body.status).toBe(true);
        response.body.data.forEach(record => {
            expect(record.resi).toContain('JNE123');
        });
    });

    it('should filter by date range', async () => {
        const response = await request(app)
            .get('/scanin/search?date_from=2026-02-01&date_to=2026-02-28');

        expect(response.body.status).toBe(true);
        // Verify dates are within range
    });
});
```

### 10.2 Integration Tests

**Web Component Tests:**
```typescript
describe('ScanIn Component', () => {
    it('should render scan tab by default', () => {
        const { getByText } = render(<ScanIn />);
        expect(getByText('Scan')).toBeInTheDocument();
    });

    it('should switch to search tab', () => {
        const { getByText } = render(<ScanIn />);
        fireEvent.click(getByText('Search & View'));
        expect(getByText('Search Scanned Orders')).toBeInTheDocument();
    });

    it('should handle manual input submission', async () => {
        const { getByPlaceholderText, getByText } = render(<ScanIn />);
        const input = getByPlaceholderText('Scan with Bluetooth scanner or type manually');

        fireEvent.change(input, { target: { value: 'JNE123456789' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        // Verify API call was made
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith('/scanin/scan', expect.any(Object));
        });
    });
});
```

**Mobile Screen Tests:**
```typescript
describe('ScanInScreen', () => {
    it('should request camera permission on mount', async () => {
        render(<ScanInScreen />);
        await waitFor(() => {
            expect(Camera.getCameraPermissionStatus).toHaveBeenCalled();
        });
    });

    it('should handle barcode scan', async () => {
        const { getByTestId } = render(<ScanInScreen />);

        // Simulate barcode scan
        act(() => {
            codeScanner.onCodeScanned([{ value: 'JNE123456789' }]);
        });

        await waitFor(() => {
            expect(ApiService.authenticatedRequest).toHaveBeenCalledWith(
                '/scanin/scan',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ resi: 'JNE123456789' })
                })
            );
        });
    });

    it('should reject order numbers', async () => {
        const { getByTestId } = render(<ScanInScreen />);

        // Simulate scanning order number
        act(() => {
            codeScanner.onCodeScanned([{ value: '240101ABCDEFGH' }]);
        });

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
                expect.stringContaining('Nomor Pesanan'),
                expect.any(String)
            );
        });
    });
});
```

### 10.3 Manual Testing Checklist

**Web Application:**
- [ ] Camera scanning works in Chrome/Edge (BarcodeDetector API)
- [ ] Manual input field accepts Bluetooth scanner input
- [ ] Focus lock prevents input field from losing focus
- [ ] Duplicate scans are rejected with proper error message
- [ ] Order numbers are rejected (not resi)
- [ ] Search filters work correctly (resi, date range)
- [ ] Pagination works (page navigation, limit changes)
- [ ] Order details modal displays correct information
- [ ] Clear all scans functionality works
- [ ] Snackbar notifications appear for success/error

**Mobile Application:**
- [ ] Camera permission request works
- [ ] Barcode scanning detects QR codes and barcodes
- [ ] Haptic feedback works (light for success, heavy for error)
- [ ] Manual input field works for Bluetooth scanners
- [ ] Duplicate scans are rejected with alert
- [ ] Order numbers are rejected with alert
- [ ] Scanned orders list updates in real-time
- [ ] Remove order from list works
- [ ] Clear all scans works
- [ ] Navigation drawer opens/closes correctly

**Backend API:**
- [ ] `/scanin/scan` validates input correctly
- [ ] `/scanin/scan` checks resi ownership
- [ ] `/scanin/scan` prevents duplicate scans
- [ ] `/scanin/scan` inserts with correct timezone (GMT+7)
- [ ] `/scanin/search` returns paginated results
- [ ] `/scanin/search` filters by resi (partial match)
- [ ] `/scanin/search` filters by date range
- [ ] `/scanin/order-details` returns complete order info
- [ ] All endpoints require authentication
- [ ] All endpoints respect tenant isolation

---

## 11. Deployment Checklist

### 11.1 Pre-Deployment

- [ ] **Database Migration**
  - [ ] Run `create-scanin-table.js` on all tenant databases
  - [ ] Verify table creation with `SHOW TABLES LIKE 'scan_in'`
  - [ ] Verify indexes with `SHOW INDEX FROM scan_in`
  - [ ] Update Prisma schema with `scan_in` model
  - [ ] Run `npx prisma generate` to update Prisma client

- [ ] **Backend Code**
  - [ ] Add `/scanin/*` routes to `Server/index.js`
  - [ ] Test all endpoints with Postman/Insomnia
  - [ ] Verify authentication middleware works
  - [ ] Verify tenant isolation (no cross-tenant data)
  - [ ] Check error handling for all edge cases

- [ ] **Web Frontend**
  - [ ] Create `Server/view/Components/core/Ecommerce/Scan In/Scan In.tsx`
  - [ ] Add route to `Server/view/Components/core/Main.tsx`
  - [ ] Add permission check (`ecommerce.scanin`)
  - [ ] Test camera scanning (Chrome/Edge only)
  - [ ] Test manual input with Bluetooth scanner
  - [ ] Test search and pagination
  - [ ] Test order details modal

- [ ] **Mobile Frontend**
  - [ ] Create `screens/scanin/ScanInScreen.tsx`
  - [ ] Add navigation drawer item
  - [ ] Add permission check
  - [ ] Test camera scanning on iOS and Android
  - [ ] Test Bluetooth scanner input
  - [ ] Test haptic feedback
  - [ ] Test error alerts

### 11.2 Deployment Steps

1. **Database Migration**
   ```bash
   node create-scanin-table.js
   ```

2. **Backend Deployment**
   ```bash
   # Build TypeScript (if applicable)
   npm run build

   # Restart server
   pm2 restart plex-cash-server
   ```

3. **Web Frontend Deployment**
   ```bash
   # Build React app
   cd Server
   npm run build

   # Restart server (if separate)
   pm2 restart plex-cash-web
   ```

4. **Mobile App Deployment**
   ```bash
   # Build Android APK
   cd mobile
   npx react-native build-android --mode=release

   # Build iOS IPA
   npx react-native build-ios --mode=Release

   # Upload to app stores or distribute via TestFlight/Firebase
   ```

### 11.3 Post-Deployment Verification

- [ ] **Database**
  - [ ] Verify `scan_in` table exists in all tenant databases
  - [ ] Check table structure matches schema
  - [ ] Verify indexes are created

- [ ] **Backend API**
  - [ ] Test `/scanin/scan` endpoint (success case)
  - [ ] Test `/scanin/scan` endpoint (duplicate case)
  - [ ] Test `/scanin/search` endpoint
  - [ ] Test `/scanin/order-details` endpoint
  - [ ] Verify authentication works
  - [ ] Check server logs for errors

- [ ] **Web Application**
  - [ ] Access `/scanin` route
  - [ ] Scan a test barcode
  - [ ] Search for scanned items
  - [ ] View order details
  - [ ] Check browser console for errors

- [ ] **Mobile Application**
  - [ ] Open Scan In screen
  - [ ] Grant camera permission
  - [ ] Scan a test barcode
  - [ ] Test manual input
  - [ ] Verify haptic feedback works
  - [ ] Check for crashes or errors

### 11.4 Rollback Plan

If issues are detected post-deployment:

1. **Backend Rollback**
   ```bash
   # Revert to previous version
   git checkout <previous-commit>
   npm run build
   pm2 restart plex-cash-server
   ```

2. **Database Rollback** (if needed)
   ```sql
   -- Drop scan_in table from all tenant databases
   DROP TABLE IF EXISTS scan_in;
   ```

3. **Frontend Rollback**
   - Remove `/scanin` route from `Main.tsx`
   - Remove `Scan In.tsx` component
   - Rebuild and redeploy

---

## 12. Success Criteria

### 12.1 Functional Requirements

✅ **Database**
- `scan_in` table created in all tenant databases
- Unique constraint on `resi` column prevents duplicates
- Indexes improve query performance

✅ **Backend API**
- `/scanin/scan` successfully records scans
- `/scanin/search` returns paginated, filtered results
- `/scanin/order-details` provides complete order information
- All endpoints require authentication
- Tenant isolation is maintained

✅ **Web Application**
- Camera scanning works (Chrome/Edge)
- Bluetooth scanner input works
- Duplicate scans are rejected
- Order numbers are filtered out
- Search and pagination work correctly
- Order details modal displays full information

✅ **Mobile Application**
- Camera scanning works (iOS/Android)
- Bluetooth scanner input works
- Haptic feedback provides tactile confirmation
- Duplicate scans are rejected with alerts
- Order numbers are filtered out
- Scanned orders list updates in real-time

### 12.2 Non-Functional Requirements

✅ **Performance**
- Scan operation completes in < 1 second
- Search results load in < 2 seconds
- Order details load in < 1 second
- No UI freezing or lag

✅ **Usability**
- Intuitive UI matching Scan Out design
- Clear error messages
- Visual feedback for all actions
- Accessible on mobile and desktop

✅ **Reliability**
- No data loss on network errors
- Graceful error handling
- Consistent behavior across platforms

✅ **Security**
- Authentication required for all endpoints
- Tenant isolation prevents data leakage
- Input validation prevents SQL injection

---

## 13. Future Enhancements

### 13.1 Phase 2 Features (Not in Current Scope)

1. **Return Reason Tracking**
   - Add `return_reason` column to `scan_in` table
   - UI dropdown for selecting return reason
   - Analytics dashboard for return reasons

2. **Inventory Adjustment Integration**
   - Automatically adjust inventory when return is scanned
   - Link to `masterbarang` table for stock updates
   - Audit trail for inventory changes

3. **Automatic Refund Processing**
   - Trigger refund workflow on scan
   - Integration with payment gateways
   - Email notifications to customers

4. **Return Quality Inspection**
   - Add `quality_status` field (Good, Damaged, Defective)
   - Photo upload for damaged items
   - Quality report generation

5. **Batch Scanning**
   - Scan multiple returns in one session
   - Bulk export to CSV/Excel
   - Print batch labels

6. **Analytics Dashboard**
   - Return rate by product/category
   - Return trends over time
   - Top return reasons
   - Financial impact analysis

### 13.2 Technical Improvements

1. **Offline Support**
   - Queue scans when offline
   - Sync when connection restored
   - Local storage for pending scans

2. **Barcode Format Validation**
   - Validate barcode format before API call
   - Support multiple courier formats
   - Auto-detect courier from barcode

3. **Performance Optimization**
   - Implement caching for search results
   - Lazy loading for order details
   - Database query optimization

4. **Enhanced Security**
   - Rate limiting on scan endpoint
   - IP whitelisting for API access
   - Audit logging for all scans

---

## 14. Parallel Development Guide

This section enables **two separate AI agents** to work independently on different parts of the implementation.

### 14.1 Agent 1: Mobile Frontend

**Responsibility:** Implement `screens/scanin/ScanInScreen.tsx`

**Dependencies:**
- API endpoints: `/scanin/scan` (must be available for testing)
- Authentication: `ApiService.authenticatedRequest` method
- Navigation: Drawer navigator setup

**Deliverables:**
1. `screens/scanin/ScanInScreen.tsx` - Main screen component
2. Navigation drawer item registration
3. Camera permission handling
4. Barcode scanning logic
5. Manual input support
6. Error handling with alerts
7. Haptic feedback integration

**Testing:**
- Use mock API responses during development
- Test with real backend once available
- Verify camera scanning on physical devices
- Test Bluetooth scanner input

**Reference Files:**
- `screens/scanout/ScanOutScreen.tsx` (copy and modify)
- `services/api.ts` (for API calls)

### 14.2 Agent 2: Web Frontend + Backend

**Responsibility:** Implement backend API + web component

**Dependencies:**
- Database: `scan_in` table must be created first
- Authentication middleware: `isAuthenticated`, `isAllowed`
- Database connection: `res.locals.connection`

**Deliverables:**
1. **Backend:**
   - `create-scanin-table.js` - Database migration script
   - API routes in `Server/index.js`:
     - `POST /scanin/scan`
     - `GET /scanin/search`
     - `GET /scanin/order-details`
   - Prisma schema update

2. **Web Frontend:**
   - `Server/view/Components/core/Ecommerce/Scan In/Scan In.tsx`
   - Route registration in `Main.tsx`
   - Permission check integration

**Testing:**
- Test API endpoints with Postman
- Verify database operations
- Test web component in browser
- Verify camera scanning (Chrome/Edge)

**Reference Files:**
- `Server/index.js` (lines 8990-9200 for scanout routes)
- `Server/view/Components/core/Ecommerce/Scan Out/Scan Out.tsx`
- `create-scanout-table.js`

### 14.3 Integration Points

**API Contract (Both Agents Must Follow):**

1. **POST /scanin/scan**
   - Request: `{ "resi": "string" }`
   - Success: `{ "status": true, "message": "...", "data": { "id": number, "resi": "string", "time_scan": "datetime" } }`
   - Error: `{ "status": false, "reason": "string", "data": {...} }`

2. **GET /scanin/search**
   - Query params: `resi`, `date_from`, `date_to`, `page`, `limit`
   - Response: `{ "status": true, "data": [...], "pagination": {...} }`

3. **GET /scanin/order-details**
   - Query param: `resi`
   - Response: `{ "status": true, "data": { "id": number, "items": [...], "total": number, ... } }`

**Coordination:**
- Agent 2 deploys backend first
- Agent 1 tests mobile app against deployed backend
- Both agents verify integration works end-to-end

---

## 15. Appendix

### 15.1 Glossary

| Term | Definition |
|------|------------|
| **Resi** | Tracking number from shipping label (Indonesian term) |
| **Scan In** | Process of scanning returned package barcodes |
| **Scan Out** | Process of scanning outgoing shipment barcodes |
| **Tenant** | Individual customer/business using the system |
| **Penjualan Online** | Online sales/orders table |
| **Detailpenjualanonline** | Order items/details table |
| **Masterbarang** | Master product catalog table |
| **Ecommerce** | Marketplace shop configuration table |

### 15.2 Related Documentation

- **Scan Out Implementation:** `Server/view/Components/core/Ecommerce/Scan Out/Scan Out.tsx`
- **Mobile Scan Out:** `screens/scanout/ScanOutScreen.tsx`
- **Database Schema:** `Server/Model/prisma/schema.prisma`
- **API Index:** `Server/index.js`
- **Authentication Middleware:** `Server/Middleware/isAuthenticated.ts`

### 15.3 Contact & Support

For questions or issues during implementation:
- **Backend Issues:** Check `Server/index.js` logs
- **Database Issues:** Verify `scan_in` table exists
- **Frontend Issues:** Check browser/mobile console logs
- **API Issues:** Test with Postman/Insomnia

---

**Document Version:** 1.0
**Last Updated:** 2026-02-21
**Status:** Ready for Implementation

