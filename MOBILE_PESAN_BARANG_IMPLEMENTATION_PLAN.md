# Mobile Pesan Barang Implementation Plan
**PlexSeller Mobile Application**

**Date:** 2026-01-17  
**Target Screen:** `screens/transaksi/PesanBarangScreen.tsx`  
**Source Reference:** `Server/view/Components/core/Transaksi/Pesan Barang/Pesan Barang.tsx`

---

## 1. Executive Summary

This document outlines the implementation plan for porting the "Pesan Barang" (Order Items) functionality from the web application to the mobile app. The implementation provides complete feature parity with the web version, enabling mobile users to manage item orders and create pre-orders directly from their phones.

### Scope Inclusions
✅ "Belum Pesan" (Not Yet Ordered) tab with item management  
✅ "Sudah Pesan" (Already Ordered) tab with filtering  
✅ Supplier filtering for ordered items  
✅ PO status filtering (All, Belum PO, Sudah PO)  
✅ Quantity editing with inline updates  
✅ Transfer to Pre Order functionality  
✅ Mark as ordered/not ordered operations  
✅ Real-time data synchronization  

### Scope Exclusions
❌ None - Full feature parity required

---

## 2. Mobile UI/UX Design Approach

### 2.1 Screen Layout Structure
```
┌─────────────────────────────────────┐
│ Header: Pesan Barang                │
│ [Back] [Refresh]                    │
├─────────────────────────────────────┤
│ Main Tabs (Horizontal)              │
│ [Belum Pesan] [Sudah Pesan]        │
├─────────────────────────────────────┤
│                                     │
│ TAB 1: BELUM PESAN                  │
│ ┌─────────────────────────────────┐ │
│ │ [Card] Product Name             │ │
│ │ SKU: ABC | Stock: 10/50         │ │
│ │ Supplier: XYZ                   │ │
│ │ Qty: [Input] [Change] [Order]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ TAB 2: SUDAH PESAN                  │
│ ┌─────────────────────────────────┐ │
│ │ Supplier Filter Tabs            │ │
│ │ [ALL] [Supplier 1] [Supplier 2]│ │
│ ├─────────────────────────────────┤ │
│ │ PO Status Filter                │ │
│ │ [Semua] [Belum PO] [Sudah PO]  │ │
│ ├─────────────────────────────────┤ │
│ │ Selection Bar (when selected)   │ │
│ │ ✓ 5 selected [Transfer to PO]  │ │
│ ├─────────────────────────────────┤ │
│ │ [✓] [Card] Product Name         │ │
│ │     Ordered: 2026-01-15         │ │
│ │     Qty: [Editable] | PO: #123 │ │
│ │     [Mark as Not Ordered]       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2.2 Component Breakdown
- **Main Screen**: Tab navigation + content area
- **BelumPesanTab**: FlatList of items needing order
- **SudahPesanTab**: Filtered list with selection
- **ItemCard**: Reusable card for both tabs
- **SupplierTabs**: Horizontal scrollable tabs
- **POStatusTabs**: Filter tabs for PO status
- **SelectionBar**: Bulk action toolbar
- **SupplierModal**: Supplier selection modal
- **TransferModal**: Pre-order transfer confirmation

### 2.3 Touch-Friendly Design
- **Minimum Touch Target:** 44x44 points
- **Card Padding:** 12-16px
- **Button Height:** 48px minimum
- **Input Height:** 44px minimum
- **Spacing:** 8-16px between elements

---

## 3. Data Flow & API Integration

### 3.1 API Endpoints Used

#### Belum Pesan Tab
1. **GET `/get/masterbarang/items-needing-order`**
   - Fetches items where `(stok + qty_preorder_pending) <= minstok`
   - Filters to show only items with `pesan = 0`
   - Returns: `{ status, data: [{ id, nama, stok, minstok, qty_preorder_pending, ... }] }`

2. **PATCH `/masterbarang/pesan/:id_barang`**
   - Marks item as ordered with supplier
   - Body: `{ id_supplier, qty_pesan }`
   - Returns: `{ status, reason? }`

#### Sudah Pesan Tab
3. **GET `/get/supplier/sudahpesan`**
   - Fetches suppliers with ordered items
   - Returns: `{ status, data: [{ id_supplier, nama, ... }] }`

4. **GET `/get/masterbarang/sudahpesan/with-po-status`**
   - Fetches ordered items with PO status
   - Returns items with: `po_status`, `po_ids`, `po_qty_total`
   - Returns: `{ status, data: [{ id, nama, qty_pesan, po_status, ... }] }`

5. **PATCH `/masterbarang/pesan/:id`**
   - Updates qty_pesan for ordered item
   - Body: `{ qty_pesan }`
   - Returns: `{ status, reason? }`

6. **PATCH `/masterbarang/belumpesan/:id`**
   - Marks item as not ordered
   - Returns: `{ status, reason? }`

#### Transfer to Pre Order
7. **Navigation to PreOrder screen**
   - Pass transfer data via navigation params
   - Data: `{ items: [], supplierId, supplierName }`

---

## 4. State Management

### 4.1 Main Screen State
```typescript
interface PesanBarangState {
  // Tab state
  activeTab: 'belum' | 'sudah';
  
  // Belum Pesan state
  itemsBelumPesan: ItemBelumPesan[];
  loadingBelum: boolean;
  
  // Sudah Pesan state
  itemsSudahPesan: ItemSudahPesan[];
  suppliers: Supplier[];
  selectedSupplierIndex: number;
  poFilterIndex: number; // 0: All, 1: Belum PO, 2: Sudah PO
  selectedItems: number[];
  loadingSudah: boolean;
  
  // Modal state
  showSupplierModal: boolean;
  currentItemId: number | null;
  
  // Refresh state
  refreshing: boolean;
}
```

### 4.2 Data Types
```typescript
interface ItemBelumPesan {
  id: number;
  nama: string;
  merk: string;
  kategori: string;
  id_supplier: number;
  minstok: number;
  stok: number;
  qty_pesan: number;
  qty_preorder_pending: number;
}

interface ItemSudahPesan {
  id: number;
  tgl_pesan: string;
  nama: string;
  merk: string;
  kategori: string;
  id_supplier: number;
  supplier_nama: string;
  qty_pesan: number;
  po_status: 'belum_po' | 'sudah_po';
  po_ids: number[];
  po_qty_total: number;
}

interface Supplier {
  id_supplier: number;
  nama: string;
}
```

---

## 5. Component Implementation Details

### 5.1 Main Screen (`PesanBarangScreen.tsx`)
**Responsibilities:**
- Tab navigation between Belum Pesan and Sudah Pesan
- Data fetching and state management
- Pull-to-refresh functionality
- Navigation to supplier modal and pre-order screen

**Key Functions:**
- `fetchBelumPesan()`: Load items needing order
- `fetchSudahPesan()`: Load ordered items with PO status
- `fetchSuppliers()`: Load suppliers for filtering
- `handleRefresh()`: Refresh current tab data
- `handleTabChange()`: Switch between tabs

### 5.2 Belum Pesan Tab Component
**Features:**
- FlatList of items needing order
- Inline quantity input
- Change supplier button
- Order button (marks as ordered)
- Empty state when no items

**Card Layout:**
```
┌─────────────────────────────────────┐
│ Product Name                        │
│ Merk: ABC | Kategori: Electronics   │
│ Stock: 10 / Min: 50 | Pending PO: 5│
│ Supplier: XYZ Supplier              │
│ ┌─────────┬──────────┬────────────┐ │
│ │ Qty: 35 │ [Change] │ [Order]    │ │
│ └─────────┴──────────┴────────────┘ │
└─────────────────────────────────────┘
```

**Actions:**
- **Change Supplier**: Opens supplier selection modal
- **Order**: Calls API to mark as ordered with current supplier

### 5.3 Sudah Pesan Tab Component
**Features:**
- Supplier filter tabs (horizontal scroll)
- PO status filter tabs
- Checkbox selection for bulk transfer
- Editable quantity
- Mark as not ordered button
- Transfer to Pre Order button

**Card Layout:**
```
┌─────────────────────────────────────┐
│ [✓] Product Name                    │
│ Ordered: 2026-01-15 | Supplier: XYZ│
│ Qty: [50] (editable)                │
│ Status: [Sudah ada PO] PO: #123, #124│
│ [Mark as Not Ordered]               │
└─────────────────────────────────────┘
```

**Filtering Logic:**
1. Filter by supplier (if not "ALL")
2. Filter by PO status:
   - Semua: Show all
   - Belum PO: `po_status === 'belum_po'`
   - Sudah PO: `po_status === 'sudah_po'`

**Selection Bar:**
- Shows when items are selected
- Displays count of selected items
- "Transfer to Pre Order" button
- "Clear Selection" button

### 5.4 Supplier Selection Modal
**Features:**
- Search functionality
- List of suppliers
- Select and confirm

**Integration:**
- Reuse existing `SearchSupplierModal` component if available
- Or create new modal with FlatList

### 5.5 Transfer to Pre Order Flow
**Steps:**
1. User selects items in Sudah Pesan tab
2. Clicks "Transfer to Pre Order"
3. Validation: Check all items have same supplier
4. Navigate to PreOrder screen with params:
   ```typescript
   navigation.navigate('PreOrder', {
     transferData: {
       items: selectedItems,
       supplierId: items[0].id_supplier,
       supplierName: items[0].supplier_nama
     }
   });
   ```
5. PreOrder screen receives data and pre-fills form

---

## 6. Mobile UI Adaptations

### 6.1 DataGrid → FlatList
**Web (MUI DataGrid):**
- Inline editing
- Checkbox selection
- Pagination
- Sorting

**Mobile (FlatList):**
- Card-based layout
- Checkbox in card header
- Pull-to-refresh instead of pagination
- Manual sorting via filters

### 6.2 Tabs → React Native Tabs
**Web (MUI Tabs):**
```tsx
<Tabs value={menu} onChange={setMenu}>
  <Tab label="Belum Pesan" />
  <Tab label="Sudah Pesan" />
</Tabs>
```

**Mobile (Custom Tabs):**
```tsx
<View style={styles.tabBar}>
  <TouchableOpacity onPress={() => setTab('belum')}>
    <Text>Belum Pesan</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => setTab('sudah')}>
    <Text>Sudah Pesan</Text>
  </TouchableOpacity>
</View>
```

### 6.3 Inline Editing
**Web:** Click cell to edit, auto-save on blur

**Mobile:**
- TextInput always visible
- Debounced auto-save (500ms after typing stops)
- Visual feedback on save (loading indicator)

### 6.4 Supplier Filter Tabs
**Implementation:**
- ScrollView horizontal
- Tab buttons with active state
- Auto-scroll to selected tab

---

## 7. Performance Optimizations

### 7.1 FlatList Optimizations
```typescript
<FlatList
  data={filteredItems}
  renderItem={renderItem}
  keyExtractor={(item) => item.id.toString()}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  initialNumToRender={10}
  windowSize={10}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### 7.2 Debounced Quantity Updates
```typescript
const debouncedUpdateQty = useCallback(
  debounce(async (id: number, qty: number) => {
    await ApiService.patch(`/masterbarang/pesan/${id}`, { qty_pesan: qty });
  }, 500),
  []
);
```

### 7.3 Memoized Components
```typescript
const ItemCard = React.memo(({ item, onPress }) => {
  // Card implementation
});
```

---

## 8. Error Handling & User Feedback

### 8.1 Loading States
- Skeleton screens for initial load
- Pull-to-refresh indicator
- Button loading states during API calls

### 8.2 Error Messages
- Network errors: "Failed to connect. Please check your internet."
- API errors: Display `reason` from response
- Validation errors: "Please select a supplier first"

### 8.3 Success Feedback
- Toast notifications for successful operations
- Visual confirmation (checkmark animation)
- Auto-refresh data after mutations

---

## 9. Implementation Checklist

### Phase 1: Basic Structure ✅
- [ ] Create `PesanBarangScreen.tsx` with tab navigation
- [ ] Implement main state management
- [ ] Add header with back and refresh buttons
- [ ] Create tab switching logic

### Phase 2: Belum Pesan Tab ✅
- [ ] Fetch items from `/get/masterbarang/items-needing-order`
- [ ] Create `BelumPesanCard` component
- [ ] Implement quantity input
- [ ] Add supplier selection modal
- [ ] Implement "Order" action
- [ ] Add pull-to-refresh

### Phase 3: Sudah Pesan Tab ✅
- [ ] Fetch suppliers from `/get/supplier/sudahpesan`
- [ ] Fetch items from `/get/masterbarang/sudahpesan/with-po-status`
- [ ] Create supplier filter tabs
- [ ] Create PO status filter tabs
- [ ] Implement checkbox selection
- [ ] Create `SudahPesanCard` component
- [ ] Implement editable quantity with debounce
- [ ] Add "Mark as Not Ordered" action
- [ ] Add selection bar with transfer button

### Phase 4: Transfer to Pre Order ✅
- [ ] Validate selected items (same supplier)
- [ ] Prepare transfer data
- [ ] Navigate to PreOrder screen with params
- [ ] Test end-to-end flow

### Phase 5: Polish & Testing ✅
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success feedback
- [ ] Test on different screen sizes
- [ ] Test with large datasets
- [ ] Test offline behavior
- [ ] Add accessibility labels

---

## 10. File Structure

```
screens/transaksi/
├── PesanBarangScreen.tsx          # Main screen (400-500 lines)
└── components/
    ├── BelumPesanCard.tsx         # Card for items needing order (150 lines)
    ├── SudahPesanCard.tsx         # Card for ordered items (200 lines)
    ├── SupplierFilterTabs.tsx     # Supplier filter tabs (100 lines)
    ├── POStatusTabs.tsx           # PO status filter tabs (80 lines)
    ├── SelectionBar.tsx           # Bulk action toolbar (100 lines)
    └── SupplierSelectionModal.tsx # Supplier picker (150 lines)
```

**Total Estimated Lines:** ~1,180 lines

---

## 11. Testing Strategy

### 11.1 Unit Tests
- Test filtering logic
- Test quantity validation
- Test selection logic

### 11.2 Integration Tests
- Test API calls
- Test navigation flow
- Test data synchronization

### 11.3 Manual Testing Scenarios
1. **Belum Pesan Flow:**
   - Load items needing order
   - Change quantity
   - Change supplier
   - Mark as ordered
   - Verify item moves to Sudah Pesan

2. **Sudah Pesan Flow:**
   - Filter by supplier
   - Filter by PO status
   - Edit quantity
   - Select multiple items
   - Transfer to Pre Order
   - Mark as not ordered

3. **Edge Cases:**
   - Empty states
   - Network errors
   - Large datasets
   - Rapid interactions

---

## 12. Success Criteria

✅ **Feature Parity:** All web features work on mobile
✅ **Performance:** Smooth scrolling with 100+ items
✅ **Usability:** Intuitive touch interactions
✅ **Reliability:** Proper error handling and recovery
✅ **Integration:** Seamless transfer to Pre Order
✅ **Accessibility:** Screen reader support

---

## 13. Future Enhancements

🔮 **Offline Support:** Cache data for offline viewing
🔮 **Barcode Scanning:** Scan items to add to order
🔮 **Push Notifications:** Alert when items need ordering
🔮 **Batch Operations:** Bulk order multiple items
🔮 **Analytics:** Track ordering patterns

---

## 14. Dependencies

### Required Packages (Already Installed)
- `react-native`: Core framework
- `@react-navigation/native`: Navigation
- `react-native-safe-area-context`: Safe area handling
- `@expo/vector-icons`: Icons

### API Service
- `services/api.ts`: Authenticated API calls
- `services/token.ts`: Token management

### Existing Components (Reusable)
- `PlaceholderScreen`: Template for new screens
- `IntervalDatePicker`: Date range picker (if needed)
- `SearchSupplierModal`: Supplier selection (from Pembelian)

---

## 15. Implementation Timeline

**Estimated Time:** 2-3 days

- **Day 1:** Phase 1-2 (Basic structure + Belum Pesan)
- **Day 2:** Phase 3 (Sudah Pesan with filtering)
- **Day 3:** Phase 4-5 (Transfer flow + Polish)

---

## 16. Notes & Considerations

### 16.1 Supplier Selection
- Reuse existing `SearchSupplierModal` from Pembelian screens
- Ensure consistent UX across app

### 16.2 Pre Order Integration
- Verify PreOrder screen exists in mobile app
- If not, create placeholder or web view
- Ensure navigation params are properly typed

### 16.3 Data Consistency
- Refresh data after mutations
- Handle concurrent edits gracefully
- Show stale data indicators if needed

### 16.4 Accessibility
- Add `accessibilityLabel` to all interactive elements
- Ensure proper focus management
- Support screen readers

---

**END OF IMPLEMENTATION PLAN**

