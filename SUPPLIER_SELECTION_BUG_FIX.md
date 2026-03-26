# Supplier Selection Bug Fix

**Date:** 2026-01-17  
**Issue:** Change button not updating supplier selection in Belum Pesan tab  
**Status:** ✅ **FIXED**

---

## 🐛 Problem Description

### Original Issue
When users clicked the "Change" button on an item in the Belum Pesan tab and selected a supplier from the modal, the selection was not being applied to the item. The supplier ID would not update in the UI, and no console logs were appearing.

### Root Cause
The supplier selection was being managed locally within `BelumPesanTab.tsx` using `currentSupplierId` state, but this state was **not being propagated back to the parent component** (`PesanBarangScreen.tsx`). The local state would be lost on re-renders, and the actual item data in the parent component was never updated.

**Flow Before Fix:**
```
User clicks "Change" 
  → Modal opens 
  → User selects supplier 
  → Local state updated (currentSupplierId) 
  → Modal closes 
  → ❌ Parent component's item data NOT updated
  → ❌ UI shows old supplier ID
```

---

## ✅ Solution Implemented

### Changes Made

#### 1. **Added `onUpdateSupplier` Callback** (`PesanBarangScreen.tsx`)
Created a new handler to update the supplier in the parent component's state:

```typescript
// Update supplier for Belum Pesan item
const handleUpdateSupplierBelum = (id: number, id_supplier: number) => {
  console.log('[PesanBarang] Updating supplier for item:', id, 'to supplier:', id_supplier);
  setItemsBelumPesan(prev =>
    prev.map(item => (item.id === id ? { ...item, id_supplier } : item))
  );
};
```

#### 2. **Passed Callback to Child Component**
Updated the `BelumPesanTab` component props to include the new callback:

```typescript
<BelumPesanTab
  items={itemsBelumPesan}
  loading={loadingBelum}
  refreshing={refreshing}
  onRefresh={handleRefresh}
  onUpdateQty={handleUpdateQtyBelum}
  onUpdateSupplier={handleUpdateSupplierBelum}  // ← NEW
  onMarkAsOrdered={handleMarkAsOrdered}
/>
```

#### 3. **Updated `BelumPesanTab` Interface**
Added the new prop to the component interface:

```typescript
interface BelumPesanTabProps {
  items: ItemBelumPesan[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onUpdateQty: (id: number, qty: number) => void;
  onUpdateSupplier: (id: number, id_supplier: number) => void;  // ← NEW
  onMarkAsOrdered: (id: number, id_supplier: number, qty_pesan: number) => void;
}
```

#### 4. **Simplified State Management in `BelumPesanTab`**
Removed the `currentSupplierId` local state and simplified the logic:

**Before:**
```typescript
const [currentItemId, setCurrentItemId] = useState<number | null>(null);
const [currentSupplierId, setCurrentSupplierId] = useState<number | null>(null);

const handleSupplierSelect = (supplier: SupplierItem) => {
  if (currentItemId) {
    setCurrentSupplierId(supplier.id);  // ❌ Only updates local state
    setShowSupplierModal(false);
  }
};
```

**After:**
```typescript
const [currentItemId, setCurrentItemId] = useState<number | null>(null);
// ✅ Removed currentSupplierId state

const handleSupplierSelect = (supplier: SupplierItem) => {
  console.log('[BelumPesanTab] Supplier selected:', supplier.id, supplier.nama);
  if (currentItemId) {
    console.log('[BelumPesanTab] Updating supplier for item:', currentItemId, 'to:', supplier.id);
    onUpdateSupplier(currentItemId, supplier.id);  // ✅ Updates parent state
    setShowSupplierModal(false);
    setCurrentItemId(null);
  }
};
```

#### 5. **Updated `renderItem` to Use Actual Item Data**
Removed the local state logic and display the actual item's supplier ID:

**Before:**
```typescript
const isCurrentItem = currentItemId === item.id;
const displaySupplierId = isCurrentItem && currentSupplierId ? currentSupplierId : item.id_supplier;

<Text style={styles.infoValue}>{displaySupplierId || '-'}</Text>
```

**After:**
```typescript
<Text style={[
  styles.infoValue, 
  item.id_supplier ? styles.supplierSelected : styles.supplierNotSelected
]}>
  {item.id_supplier || 'Not Selected'}
</Text>
```

#### 6. **Added Comprehensive Console Logging**
Added debug logs throughout the flow to track events:

- `[PesanBarang]` prefix for main screen logs
- `[BelumPesanTab]` prefix for tab component logs
- Logs for: button clicks, modal opening, supplier selection, state updates, API calls

#### 7. **Enhanced Visual Feedback**
Added color-coded styling for supplier selection state:

```typescript
supplierSelected: {
  color: '#10b981',      // Green - supplier is selected
  fontWeight: '600',
},
supplierNotSelected: {
  color: '#ef4444',      // Red - no supplier selected
  fontStyle: 'italic',
},
```

---

## 🔄 New Flow (After Fix)

```
User clicks "Change" 
  → [BelumPesanTab] Change button pressed for item: X
  → [BelumPesanTab] Opening supplier modal for item: X
  → Modal opens 
  → User selects supplier 
  → [BelumPesanTab] Supplier selected: Y (Supplier Name)
  → [BelumPesanTab] Updating supplier for item: X to: Y
  → [PesanBarang] Updating supplier for item: X to supplier: Y
  → ✅ Parent state updated
  → ✅ UI re-renders with new supplier ID
  → ✅ Supplier ID shows in GREEN
  → Modal closes
```

---

## 🧪 Testing Instructions

### Test Case 1: Change Supplier
1. Open Pesan Barang screen
2. Go to "Belum Pesan" tab
3. Find an item (note its current Supplier ID)
4. Click the "Change" button
5. **Expected:** Modal opens, console shows: `[BelumPesanTab] Opening supplier modal for item: X`
6. Select a different supplier from the list
7. **Expected:** 
   - Console shows: `[BelumPesanTab] Supplier selected: Y (Name)`
   - Console shows: `[PesanBarang] Updating supplier for item: X to supplier: Y`
   - Modal closes
   - Supplier ID updates to new value in GREEN
   - UI reflects the change immediately

### Test Case 2: Order with Changed Supplier
1. Change supplier for an item (follow Test Case 1)
2. Set a quantity (e.g., 50)
3. Click "Order" button
4. **Expected:**
   - Console shows: `[BelumPesanTab] Order button pressed for item: X`
   - Confirmation dialog shows correct supplier ID
   - After confirming, item is marked as ordered with the NEW supplier

### Test Case 3: Multiple Supplier Changes
1. Change supplier for item A to Supplier 1
2. Change supplier for item B to Supplier 2
3. Change supplier for item A again to Supplier 3
4. **Expected:**
   - Each change is reflected immediately
   - No interference between items
   - Console logs show all changes

### Test Case 4: Order Without Supplier
1. Find an item with "Not Selected" supplier (in RED)
2. Click "Order" button
3. **Expected:**
   - Alert shows: "Please select a supplier first"
   - Console shows warning

### Test Case 5: Console Log Verification
Open React Native debugger or Metro bundler console and verify logs appear for:
- Button clicks
- Modal opening
- Supplier selection
- State updates
- API calls

---

## 📊 Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `screens/transaksi/PesanBarangScreen.tsx` | +15 | Added `handleUpdateSupplierBelum` handler and console logs |
| `screens/transaksi/components/BelumPesanTab.tsx` | +30, -20 | Updated props, simplified state, added logs, enhanced UI |

**Total Changes:** ~45 lines modified/added

---

## 🎨 Visual Changes

### Before
```
Supplier ID: 123
```
(Plain text, no indication if changed)

### After
```
Supplier ID: 123  (in GREEN if selected)
Supplier ID: Not Selected  (in RED italic if not selected)
```

---

## 🔍 Debug Console Output Example

```
[BelumPesanTab] Change button pressed for item: 42
[BelumPesanTab] Opening supplier modal for item: 42 current supplier: 5
[BelumPesanTab] Supplier selected: 8 PT Supplier Baru
[BelumPesanTab] Updating supplier for item: 42 to: 8
[PesanBarang] Updating supplier for item: 42 to supplier: 8
[BelumPesanTab] Order button pressed for item: 42
[BelumPesanTab] Order button clicked for item: 42 supplier: 8
[BelumPesanTab] Showing confirmation dialog for item: 42
[BelumPesanTab] User confirmed order for item: 42
[PesanBarang] Marking item as ordered: {id: 42, id_supplier: 8, qty_pesan: 50}
[PesanBarang] Item marked as ordered successfully
```

---

## ✅ Verification Checklist

- [x] Supplier selection updates parent state
- [x] UI reflects supplier changes immediately
- [x] Console logs appear for all events
- [x] Modal integration works correctly
- [x] Order button uses updated supplier
- [x] Visual feedback for supplier state
- [x] No TypeScript errors
- [x] No runtime errors
- [x] State management is clean and predictable

---

## 🚀 Deployment Notes

This fix is **backward compatible** and requires no database changes or API modifications. It only affects the mobile app's internal state management.

**Safe to deploy immediately.**

---

## 📝 Lessons Learned

1. **Always propagate state changes to parent components** when child components modify data that belongs to the parent
2. **Use console logs liberally** during development to track data flow
3. **Visual feedback** (colors, styles) helps users understand state changes
4. **Single source of truth** - avoid duplicating state between parent and child components

---

---

## 🔧 Quick Reference: Console Log Prefixes

All debug logs use prefixes to identify the source:

| Prefix | Component | Example |
|--------|-----------|---------|
| `[PesanBarang]` | Main screen | `[PesanBarang] Updating supplier for item: 42 to supplier: 8` |
| `[BelumPesanTab]` | Belum Pesan tab | `[BelumPesanTab] Change button pressed for item: 42` |

### Expected Log Sequence for Supplier Change

```
1. [BelumPesanTab] Change button pressed for item: 42
2. [BelumPesanTab] Opening supplier modal for item: 42 current supplier: 5
3. [BelumPesanTab] Supplier selected: 8 PT Supplier Baru
4. [BelumPesanTab] Updating supplier for item: 42 to: 8
5. [PesanBarang] Updating supplier for item: 42 to supplier: 8
```

### Expected Log Sequence for Order

```
1. [BelumPesanTab] Order button pressed for item: 42
2. [BelumPesanTab] Order button clicked for item: 42 supplier: 8
3. [BelumPesanTab] Showing confirmation dialog for item: 42
4. [BelumPesanTab] User confirmed order for item: 42
5. [PesanBarang] Marking item as ordered: {id: 42, id_supplier: 8, qty_pesan: 50}
6. [PesanBarang] Item marked as ordered successfully
```

---

**Bug Status:** ✅ **RESOLVED**

