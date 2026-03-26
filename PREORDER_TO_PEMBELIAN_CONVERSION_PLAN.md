# Pre-Order to Pembelian Conversion - Mobile Implementation Plan

## Executive Summary
This document outlines the implementation plan for adding "Convert Pre-Order to Purchase" functionality to the PlexCash mobile app's `PembelianTambahScreen.tsx`, achieving feature parity with the existing web frontend.

---

## 1. Research Findings

### 1.1 Web Frontend Implementation Analysis

**File**: `Server/view/Components/core/Transaksi/Pembelian/Tambah/Tambah.tsx`

**Key Features Identified**:
1. **URL Parameter Handling**: Accepts `po_ids` query parameter (e.g., `/pembelian/tambah?po_ids=1,2,3`)
2. **Pre-Order Search Modal**: Allows manual selection of pre-orders via search interface
3. **Supplier Notification**: Shows alert when supplier has pending pre-orders
4. **Auto-Population**: Automatically fills form with pre-order data
5. **Item Consolidation**: Merges items from multiple pre-orders, combining quantities for duplicates
6. **Validation**: Ensures all selected pre-orders have the same supplier
7. **Backend Integration**: Sends `preOrderIds` array to backend on save

**Web Implementation Flow**:
```
1. User navigates from PreOrder screen → /pembelian/tambah?po_ids=1,2,3
2. componentDidMount() detects po_ids parameter
3. Calls handlePreOrderIds(poIdsParam)
4. Fetches pre-orders via /get/preorder/by-ids?ids=1,2,3
5. Validates: same supplier, not already converted
6. Calls populateFromPreOrders(preOrders)
7. Sets supplier, merges items, updates state
8. User can modify and save
9. On save, sends preOrderIds to backend
10. Backend updates preorder.id_pembelian and pembelian.nomor_po
```

### 1.2 API Endpoints

**GET /get/preorder/by-ids**
- **Purpose**: Fetch multiple pre-orders by comma-separated IDs
- **Query Param**: `ids` (e.g., `?ids=1,2,3`)
- **Response**: Array of PreOrderData with items
- **Controller**: `Server/Controllers/Transaksi/PreOrder.ts` → `getByIds()`

**GET /api/preorder**
- **Purpose**: Fetch all pre-orders (for search modal)
- **Response**: Array of all non-cancelled pre-orders with items

**POST /pembelian**
- **Purpose**: Create new purchase order
- **Body**: Includes `preOrderIds` array
- **Backend Action**: Updates `preorder.id_pembelian` and `pembelian.nomor_po`

### 1.3 Data Structures

```typescript
interface PreOrderData {
  id?: number;
  tanggal_po: string;
  tanggal_perkiraan_sampai: string;
  id_supplier: number;
  supplier_nama?: string;
  notes: string;
  items: PreOrderItem[];
  id_pembelian?: number; // null = pending, number = converted
}

interface PreOrderItem {
  id_masterbarang: number;
  nama: string;
  qty: number;
  harga: number;
  merk: string;
  satuan: string;
}
```

---

## 2. Current State Analysis - PembelianTambahScreen.tsx

### 2.1 Existing Features
- ✅ Supplier selection via SearchSupplierModal
- ✅ Item management with SearchBarangModal
- ✅ PPN calculation (include/exclude modes)
- ✅ Warehouse selection
- ✅ Bagan Akun selection
- ✅ Save to /pembelian endpoint
- ✅ Form validation

### 2.2 Missing Features (To Be Implemented)
- ❌ Pre-order selection interface
- ❌ Pre-order search modal
- ❌ Navigation parameter handling for po_ids
- ❌ Auto-population from pre-orders
- ❌ Item consolidation logic
- ❌ Supplier notification for pending pre-orders
- ❌ preOrderIds in save payload

### 2.3 Current State Structure
```typescript
// Existing state (lines 44-73)
const [idSupplier, setIdSupplier] = useState(0);
const [supplierName, setSupplierName] = useState('');
const [itemDetails, setItemDetails] = useState<ItemDetail[]>([]);
// ... other form fields
```

**Required New State**:
```typescript
const [selectedPreOrders, setSelectedPreOrders] = useState<PreOrderData[]>([]);
const [preOrders, setPreOrders] = useState<PreOrderData[]>([]);
const [showPreOrderSearch, setShowPreOrderSearch] = useState(false);
const [loadingPreOrders, setLoadingPreOrders] = useState(false);
const [pendingPreOrdersCount, setPendingPreOrdersCount] = useState(0);
```

---

## 3. Required UI Changes

### 3.1 New Components to Add

#### A. Pre-Order Selection Field
**Location**: After supplier field, before items section
**UI Elements**:
- Text input showing selected PO IDs (read-only)
- Search icon button to open pre-order modal
- Chips displaying selected pre-orders with remove option

**Mobile Design**:
```tsx
<View style={styles.formGroup}>
  <Text style={styles.label}>Nomor PO (Optional)</Text>
  <TouchableOpacity
    style={styles.selectButton}
    onPress={() => handleOpenPreOrderSearch()}
  >
    <Text style={styles.selectButtonText}>
      {selectedPreOrders.length > 0
        ? selectedPreOrders.map(po => `#${po.id}`).join(', ')
        : 'Pilih Pre-Order'}
    </Text>
    <Ionicons name="search" size={20} color="#6B7280" />
  </TouchableOpacity>

  {/* Selected PO Chips */}
  {selectedPreOrders.length > 0 && (
    <View style={styles.chipContainer}>
      {selectedPreOrders.map((po, idx) => (
        <View key={idx} style={styles.chip}>
          <Text style={styles.chipText}>PO #{po.id}</Text>
          <TouchableOpacity onPress={() => handleRemovePreOrder(idx)}>
            <Ionicons name="close-circle" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  )}
</View>
```

#### B. Pre-Order Search Modal
**Component**: New modal component for browsing and selecting pre-orders
**Features**:
- FlatList of pending pre-orders
- Checkbox selection (multi-select)
- Filter by supplier (auto-filter when supplier selected)
- Display: PO ID, Date, Supplier, Item Count
- Confirm/Cancel buttons

**Mobile Design**:
```tsx
<Modal visible={showPreOrderSearch} animationType="slide">
  <SafeAreaView style={styles.modalContainer}>
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>Pilih Pre-Order</Text>
      <TouchableOpacity onPress={() => setShowPreOrderSearch(false)}>
        <Ionicons name="close" size={24} />
      </TouchableOpacity>
    </View>

    <FlatList
      data={filteredPreOrders}
      renderItem={({ item }) => (
        <PreOrderListItem
          preOrder={item}
          selected={isSelected(item)}
          onToggle={() => handleTogglePreOrder(item)}
        />
      )}
    />

    <View style={styles.modalFooter}>
      <Button title="Cancel" onPress={handleCancel} />
      <Button title="Confirm" onPress={handleConfirmSelection} />
    </View>
  </SafeAreaView>
</Modal>
```

#### C. Supplier Notification Alert
**Location**: Below supplier field
**Condition**: Show when supplier has pending pre-orders
**UI**: Info banner with "Lihat" button

```tsx
{idSupplier > 0 && pendingPreOrdersCount > 0 && (
  <View style={styles.infoAlert}>
    <Ionicons name="information-circle" size={20} color="#3b82f6" />
    <Text style={styles.infoText}>
      Ada {pendingPreOrdersCount} pre-order menunggu untuk supplier ini.
    </Text>
    <TouchableOpacity onPress={handleOpenPreOrderSearch}>
      <Text style={styles.infoLink}>Lihat</Text>
    </TouchableOpacity>
  </View>
)}
```

---

## 4. API Integration Requirements

### 4.1 New API Calls

#### Fetch Pre-Orders by IDs
```typescript
const fetchPreOrdersByIds = async (ids: number[]) => {
  const token = await getTokenAuth();
  const response = await fetch(
    `${API_BASE_URL}/get/preorder/by-ids?ids=${ids.join(',')}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  const data = await response.json();
  return data;
};
```

#### Fetch All Pre-Orders (for search)
```typescript
const fetchAllPreOrders = async () => {
  const token = await getTokenAuth();
  const response = await fetch(`${API_BASE_URL}/api/preorder`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  // Filter only pending (not converted)
  return data.data.filter((po: PreOrderData) => !po.id_pembelian);
};
```

#### Fetch Pending Pre-Orders for Supplier
```typescript
const fetchPendingPreOrdersForSupplier = async (supplierId: number) => {
  const allPreOrders = await fetchAllPreOrders();
  const pending = allPreOrders.filter(
    (po: PreOrderData) => po.id_supplier === supplierId
  );
  setPendingPreOrdersCount(pending.length);
};
```

### 4.2 Modified Save Payload
```typescript
// Current save payload
const saveData = {
  data: {
    tanggal_invoice: tanggalInvoice,
    id_supplier: idSupplier,
    keterangan: keterangan,
    // ... other fields
  },
  detailpembelian: itemDetails.map(item => ({
    id_barang: item.id,
    qty: parseInt(item.qty),
    hargabeli: parseFloat(item.hargabeli),
    // ...
  }))
};

// NEW: Add preOrderIds
const saveData = {
  data: {
    // ... existing fields
  },
  detailpembelian: [...],
  preOrderIds: selectedPreOrders.map(po => po.id).filter(id => id !== undefined)
};
```

---

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Journey Flow                         │
└─────────────────────────────────────────────────────────────┘

Option 1: Direct Navigation from PreOrder Screen
┌──────────────┐    po_ids=1,2,3    ┌──────────────────┐
│ PreOrder     │ ──────────────────> │ PembelianTambah  │
│ Screen       │                     │ Screen           │
└──────────────┘                     └──────────────────┘
                                              │
                                              ▼
                                     useEffect detects
                                     route.params.po_ids
                                              │
                                              ▼
                                     fetchPreOrdersByIds()
                                              │
                                              ▼
                                     Validate & Populate Form

Option 2: Manual Selection in PembelianTambah
┌──────────────────┐                ┌──────────────────┐
│ PembelianTambah  │                │ Pre-Order Search │
│ Screen           │ ─────────────> │ Modal            │
└──────────────────┘   Click Search └──────────────────┘
         │                                   │
         │                                   ▼
         │                          fetchAllPreOrders()
         │                                   │
         │                                   ▼
         │                          User selects POs
         │                                   │
         │                                   ▼
         │ <──────────────────────  Confirm Selection
         │
         ▼
    Populate Form

Save Flow
┌──────────────────┐                ┌──────────────────┐
│ User clicks Save │ ──────────────> │ POST /pembelian  │
└──────────────────┘                 └──────────────────┘
                                              │
                                              ▼
                                     Backend receives:
                                     - pembelian data
                                     - detailpembelian
                                     - preOrderIds: [1,2,3]
                                              │
                                              ▼
                                     Backend updates:
                                     - preorder.id_pembelian
                                     - pembelian.nomor_po
```

---

## 6. Step-by-Step User Interaction Flow

### Scenario A: Convert from PreOrder Screen
1. User opens PreOrder screen
2. User selects one or more pre-orders (same supplier)
3. User taps "Convert to Pembelian" button
4. App navigates to PembelianTambah with `po_ids` param
5. PembelianTambah detects param and auto-loads pre-orders
6. Form auto-populates: supplier, items (merged), notes
7. User reviews/modifies data
8. User taps Save
9. Backend creates pembelian and links pre-orders
10. Success message shown

### Scenario B: Manual Selection in PembelianTambah
1. User opens PembelianTambah screen
2. User selects supplier
3. System shows notification: "Ada 3 pre-order menunggu"
4. User taps "Lihat" or search icon
5. Pre-Order Search Modal opens (filtered by supplier)
6. User selects desired pre-orders via checkboxes
7. User taps "Confirm"
8. Form auto-populates with merged items
9. User reviews/modifies data
10. User taps Save
11. Backend creates pembelian and links pre-orders
12. Success message shown

---

## 7. Technical Implementation Approach

### 7.1 Phase 1: Add State Management
**File**: `screens/transaksi/pembelian/PembelianTambahScreen.tsx`
**Lines**: After line 73 (existing state declarations)

```typescript
// Pre-order related state
const [selectedPreOrders, setSelectedPreOrders] = useState<PreOrderData[]>([]);
const [preOrders, setPreOrders] = useState<PreOrderData[]>([]);
const [showPreOrderSearch, setShowPreOrderSearch] = useState(false);
const [loadingPreOrders, setLoadingPreOrders] = useState(false);
const [pendingPreOrdersCount, setPendingPreOrdersCount] = useState(0);
```

### 7.2 Phase 2: Add Navigation Parameter Handling
**Location**: After `loadInitialData()` useEffect

```typescript
// Handle po_ids from navigation params (from PreOrder screen)
useEffect(() => {
  const params = route.params as any;
  if (params?.po_ids) {
    handlePreOrderIds(params.po_ids);
    // Clear param after processing
    navigation.setParams({ po_ids: undefined } as any);
  }
}, [route.params]);
```

### 7.3 Phase 3: Implement Core Functions

#### A. Fetch Pre-Orders by IDs
```typescript
const handlePreOrderIds = async (poIdsParam: string) => {
  try {
    setLoadingPreOrders(true);

    // Parse comma-separated IDs
    const poIds = poIdsParam.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));

    if (poIds.length === 0) {
      Alert.alert('Error', 'No valid pre-order IDs');
      return;
    }

    // Fetch pre-orders
    const token = await getTokenAuth();
    const response = await fetch(
      `${API_BASE_URL}/get/preorder/by-ids?ids=${poIds.join(',')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();

    if (data.status && data.data) {
      const preOrders = data.data;

      // Validate same supplier
      const firstSupplierId = preOrders[0].id_supplier;
      const allSame = preOrders.every(po => po.id_supplier === firstSupplierId);

      if (!allSame) {
        Alert.alert('Error', 'Semua pre-order harus memiliki supplier yang sama');
        return;
      }

      // Validate not converted
      const anyConverted = preOrders.some(po => po.id_pembelian);
      if (anyConverted) {
        Alert.alert('Error', 'Beberapa pre-order sudah dikonversi');
        return;
      }

      // Populate form
      populateFromPreOrders(preOrders);
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to load pre-orders');
  } finally {
    setLoadingPreOrders(false);
  }
};
```

#### B. Populate Form from Pre-Orders
```typescript
const populateFromPreOrders = (preOrders: PreOrderData[]) => {
  // Set supplier
  const supplierId = preOrders[0].id_supplier;
  const supplierName = preOrders[0].supplier_nama || '';
  setIdSupplier(supplierId);
  setSupplierName(supplierName);

  // Merge items from all pre-orders
  const itemMap = new Map<number, ItemDetail>();

  preOrders.forEach(po => {
    po.items.forEach(item => {
      if (itemMap.has(item.id_masterbarang)) {
        // Combine quantities
        const existing = itemMap.get(item.id_masterbarang)!;
        existing.qty = (parseInt(existing.qty) + item.qty).toString();
      } else {
        // Add new item
        itemMap.set(item.id_masterbarang, {
          id: item.id_masterbarang,
          nama: item.nama,
          merk: item.merk || '',
          kategori: '',
          satuan: item.satuan || 'pcs',
          qty: item.qty.toString(),
          hargabeli: item.harga.toString(),
          dpp: item.harga.toString(),
          pricelist: '',
          qty_print: '0',
        });
      }
    });
  });

  // Convert map to array
  const mergedItems = Array.from(itemMap.values());
  setItemDetails(mergedItems);

  // Set selected pre-orders
  setSelectedPreOrders(preOrders);

  // Set notes
  const notes = preOrders.map(po => `PO #${po.id}: ${po.notes}`).join('\n');
  setKeterangan(notes);
};
```

#### C. Fetch All Pre-Orders for Search
```typescript
const fetchAllPreOrders = async () => {
  try {
    setLoadingPreOrders(true);
    const token = await getTokenAuth();
    const response = await fetch(`${API_BASE_URL}/api/preorder`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.status && data.data) {
      // Filter only pending pre-orders
      const pending = data.data.filter((po: PreOrderData) => !po.id_pembelian);
      setPreOrders(pending);
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to load pre-orders');
  } finally {
    setLoadingPreOrders(false);
  }
};
```

#### D. Handle Supplier Change
```typescript
// Modify existing handleSelectSupplier function
const handleSelectSupplier = async (supplier: SupplierItem) => {
  setIdSupplier(supplier.id);
  setSupplierName(supplier.nama);
  setShowSupplier(false);

  // NEW: Fetch pending pre-orders for this supplier
  try {
    const token = await getTokenAuth();
    const response = await fetch(`${API_BASE_URL}/api/preorder`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.status && data.data) {
      const pending = data.data.filter(
        (po: PreOrderData) => !po.id_pembelian && po.id_supplier === supplier.id
      );
      setPendingPreOrdersCount(pending.length);
    }
  } catch (error) {
    console.error('Error fetching pending pre-orders:', error);
  }
};
```

### 7.4 Phase 4: Update Save Function
**Location**: Modify existing save function (around line 500+)

```typescript
// Add preOrderIds to save payload
const response = await fetch(`${API_BASE_URL}/pembelian`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    data: {
      tanggal_invoice: tanggalInvoice,
      id_supplier: idSupplier,
      keterangan: keterangan,
      // ... other fields
    },
    detailpembelian: itemDetails.map(item => ({
      id_barang: item.id,
      qty: parseInt(item.qty),
      hargabeli: parseFloat(item.hargabeli),
      // ...
    })),
    // NEW: Add pre-order IDs
    preOrderIds: selectedPreOrders.map(po => po.id).filter(id => id !== undefined)
  })
});
```

---

## 8. Validation & Error Handling

### 8.1 Validation Rules
1. ✅ All selected pre-orders must have the same supplier
2. ✅ Pre-orders must not be already converted (id_pembelian === null)
3. ✅ At least one item must exist after merging
4. ✅ Supplier must be selected before opening pre-order search
5. ✅ Cannot mix manual items with pre-order items (optional - web allows this)

### 8.2 Error Scenarios
| Scenario | Validation | Error Message |
|----------|-----------|---------------|
| Different suppliers | Check id_supplier match | "Semua pre-order harus memiliki supplier yang sama" |
| Already converted | Check id_pembelian | "Beberapa pre-order sudah dikonversi ke pembelian" |
| No items | Check items.length > 0 | "Pre-order tidak memiliki item" |
| Network error | Try-catch | "Gagal memuat pre-order. Periksa koneksi internet" |
| Invalid IDs | Parse validation | "ID pre-order tidak valid" |

---

## 9. Testing Checklist

### 9.1 Unit Tests
- [ ] Parse po_ids parameter correctly
- [ ] Merge items with same id_masterbarang
- [ ] Calculate combined quantities correctly
- [ ] Filter pending pre-orders only
- [ ] Validate same supplier constraint

### 9.2 Integration Tests
- [ ] Navigate from PreOrder screen with po_ids
- [ ] Fetch pre-orders by IDs from API
- [ ] Populate form with pre-order data
- [ ] Save pembelian with preOrderIds
- [ ] Verify backend updates preorder.id_pembelian

### 9.3 UI/UX Tests
- [ ] Pre-order search modal opens/closes
- [ ] Checkbox selection works
- [ ] Chips display and remove correctly
- [ ] Supplier notification appears
- [ ] Loading states show correctly
- [ ] Error alerts display properly

### 9.4 Edge Cases
- [ ] Single pre-order conversion
- [ ] Multiple pre-orders (2-5)
- [ ] Pre-order with many items (10+)
- [ ] Pre-order with duplicate items
- [ ] Empty pre-order (no items)
- [ ] Already converted pre-order
- [ ] Network timeout
- [ ] Invalid po_ids format

---

## 10. Implementation Timeline

### Phase 1: Core Functionality (Day 1)
- Add state management
- Implement navigation parameter handling
- Create fetch functions
- Implement populateFromPreOrders

### Phase 2: UI Components (Day 2)
- Create Pre-Order Search Modal
- Add pre-order selection field
- Add supplier notification alert
- Style components

### Phase 3: Integration (Day 3)
- Update save function
- Test API integration
- Handle error scenarios
- Add loading states

### Phase 4: Testing & Refinement (Day 4)
- Manual testing all scenarios
- Fix bugs
- Optimize performance
- Code review

---

## 11. Success Criteria

✅ **Feature Parity**: Mobile app matches web frontend functionality
✅ **Navigation**: Can navigate from PreOrder screen with po_ids
✅ **Manual Selection**: Can manually select pre-orders in PembelianTambah
✅ **Auto-Population**: Form auto-fills with pre-order data
✅ **Item Merging**: Correctly combines quantities for duplicate items
✅ **Validation**: Enforces same supplier and not-converted rules
✅ **Backend Integration**: Successfully saves with preOrderIds
✅ **User Experience**: Smooth, intuitive, error-free workflow

---

## 12. References

- Web Implementation: `Server/view/Components/core/Transaksi/Pembelian/Tambah/Tambah.tsx`
- Backend Controller: `Server/Controllers/Transaksi/PreOrder.ts`
- Backend Routes: `Server/index.ts` (lines 13588-13600)
- Mobile PreOrder Screen: `screens/transaksi/PreOrderScreen.tsx`
- Mobile PembelianTambah: `screens/transaksi/pembelian/PembelianTambahScreen.tsx`

---

**Document Version**: 1.0
**Created**: 2026-01-17
**Status**: Ready for Implementation

