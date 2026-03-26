import openpyxl
import os
from datetime import datetime

EXCEL_FILE = 'Produk Material-2026-01-09__2026-01-09.xlsx'
OUTPUT_FILE = 'migration-output.sql'

if not os.path.exists(EXCEL_FILE):
    print('Error: Excel file not found')
    exit(1)

print('Reading Excel file...')
workbook = openpyxl.load_workbook(EXCEL_FILE)
sheet = workbook['product_materials']

data = []
for i, row in enumerate(sheet.iter_rows(values_only=True)):
    if i > 0:  # Skip header row
        row_data = {
            'product_name': row[0],      # Column 1: Product name
            'variant': row[1],            # Column 2: Product variant/size
            'empty_col': row[2],          # Column 3: Empty column
            'material': row[3],           # Column 4: Material name (with #)
            'qty': row[4],                # Column 5: Quantity required
            'unit': row[5],               # Column 6: Unit (GR, PAIL, etc.)
            'conversion_factor': row[6]   # Column 7: Conversion factor
        }
        data.append(row_data)

print('Loaded ' + str(len(data)) + ' rows')

sql_statements = []
master_barang_map = {}
bundling_map = {}
master_barang_id = 1
bundling_id = 1

# Helper function to validate and convert conversion factor
def get_conversion_factor(value):
    try:
        if value is None or str(value).strip() == '':
            return 1
        factor = float(value)
        return int(factor) if factor == int(factor) else factor
    except (ValueError, TypeError):
        return 1

# Helper function to escape SQL strings
def escape_sql(text):
    if text is None:
        return ''
    return str(text).replace("'", "''")

# Helper function to remove "VARIAN [anything]" pattern from product name
def remove_varian_from_name(name):
    if not name:
        return name
    import re
    # Remove pattern "VARIAN [anything]" from the end or middle of the name
    # This handles cases where the Excel data already contains VARIAN in the product name
    cleaned = re.sub(r'\s+VARIAN\s+.*$', '', str(name), flags=re.IGNORECASE)
    return cleaned.strip()

# Step 1: Analyze data to identify single vs multi-variant products
print('Analyzing data structure...')
material_variants = {}  # material -> list of (product_name, variant, conversion_factor) tuples

for row in data:
    material = row.get('material')
    product_name = row.get('product_name')
    variant = row.get('variant')
    conversion_factor = row.get('conversion_factor', 1)

    if material and product_name:
        material_clean = escape_sql(material)
        if material_clean not in material_variants:
            material_variants[material_clean] = []
        material_variants[material_clean].append((product_name, variant, conversion_factor))

# Identify which materials have multiple variants (bundles) vs single variant
# AND which ones need conversion (have at least one variant with conversion != 1)
multi_variant_materials = set()
materials_needing_conversion = set()

for material, variants in material_variants.items():
    unique_variants = set((v[0], v[1]) for v in variants)
    if len(unique_variants) > 1:
        multi_variant_materials.add(material)
        # Check if any variant has conversion factor != 1
        for v in variants:
            conversion_factor = v[2] if len(v) > 2 else 1
            try:
                if float(conversion_factor) != 1.0:
                    materials_needing_conversion.add(material)
                    break
            except (ValueError, TypeError):
                pass

print('Found ' + str(len(multi_variant_materials)) + ' multi-variant materials (bundles)')
print('Found ' + str(len(materials_needing_conversion)) + ' materials needing conversion (hidden=1)')
print('Found ' + str(len(material_variants) - len(multi_variant_materials)) + ' single-variant materials')

# Step 2: Create masterbarang entries
print('Creating masterbarang entries...')
processed_materials = set()
processed_products = set()

for row in data:
    material = row.get('material')
    product_name = row.get('product_name')
    variant = row.get('variant')

    if not material or not product_name:
        continue

    material_clean = escape_sql(material)

    # For multi-variant materials: create base material entry
    # Set hidden=1 only if material needs conversion (has at least one variant with conversion != 1)
    if material_clean in multi_variant_materials:
        if material_clean not in processed_materials:
            sku = 'SKU_' + str(master_barang_id)
            # Use original material (not escaped) for cleaning the name
            material_name_clean = str(material).lstrip('#').strip()
            # Remove "VARIAN [anything]" pattern from material name if it exists in the Excel data
            material_name_clean = remove_varian_from_name(material_name_clean)
            hidden_flag = 1 if material_clean in materials_needing_conversion else 0
            sql = "INSERT INTO masterbarang (id, nama, merk, satuan, kategori, stok, stok_online, hargajual, hargabeli, sku, hidden) VALUES (" + str(master_barang_id) + ", '" + escape_sql(material_name_clean) + "', '', 'PCS', '', 0, 0, 0, 0, '" + sku + "', " + str(hidden_flag) + ");"
            sql_statements.append(sql)
            master_barang_map[material_clean] = master_barang_id
            master_barang_id += 1
            processed_materials.add(material_clean)

    # For single-variant materials: create direct masterbarang entry
    else:
        product_variant_key = (product_name, variant)
        if product_variant_key not in processed_products:
            sku = 'SKU_' + str(master_barang_id)
            # Strip # prefix from product name if present
            product_name_clean = str(product_name).lstrip('#').strip()
            # Remove "VARIAN [anything]" pattern from product name if it exists in the Excel data
            product_name_clean = remove_varian_from_name(product_name_clean)

            # Keep product name clean (without VARIAN text)
            product_full_name = escape_sql(product_name_clean)
            # Store variant information in satuan field instead of appending to name
            # Use variant if available and not None/empty, otherwise use 'PCS'
            if variant and str(variant).strip() and str(variant).strip().upper() != 'NONE':
                satuan_value = escape_sql(str(variant).strip())
            else:
                satuan_value = 'PCS'
            sql = "INSERT INTO masterbarang (id, nama, merk, satuan, kategori, stok, stok_online, hargajual, hargabeli, sku, hidden) VALUES (" + str(master_barang_id) + ", '" + product_full_name + "', '', '" + satuan_value + "', '', 0, 0, 0, 0, '" + sku + "', 0);"
            sql_statements.append(sql)
            master_barang_map[product_variant_key] = master_barang_id
            master_barang_id += 1
            processed_products.add(product_variant_key)

# Step 3: Create bundling entries for multi-variant materials
print('Creating bundling entries...')
processed_bundles = set()

for row in data:
    material = row.get('material')
    product_name = row.get('product_name')
    variant = row.get('variant')

    if not material or not product_name:
        continue

    material_clean = escape_sql(material)

    # Only create bundles for multi-variant materials
    if material_clean in multi_variant_materials:
        bundle_key = (product_name, variant)
        if bundle_key not in processed_bundles:
            bundle_sku = 'BUNDLE_' + str(bundling_id)
            # Strip # prefix from product name if present
            product_name_clean = str(product_name).lstrip('#').strip()
            bundle_name = escape_sql(product_name_clean + ' VARIAN ' + str(variant)) if variant else escape_sql(product_name_clean)
            sql = "INSERT INTO bundling (nama, sku, hargajual, label) VALUES ('" + bundle_name + "', '" + bundle_sku + "', 0, NULL);"
            sql_statements.append(sql)
            bundling_map[bundle_key] = bundling_id
            bundling_id += 1
            processed_bundles.add(bundle_key)




# Step 4: Create detailbundling entries
print('Creating detailbundling entries...')
processed_details = set()

for row in data:
    material = row.get('material')
    product_name = row.get('product_name')
    variant = row.get('variant')
    conversion_factor = get_conversion_factor(row.get('conversion_factor'))

    if not material or not product_name:
        continue

    material_clean = escape_sql(material)

    # Only create detailbundling for multi-variant materials
    if material_clean in multi_variant_materials:
        bundle_key = (product_name, variant)
        detail_key = (bundle_key, material_clean)

        if detail_key not in processed_details:
            bundle_id = bundling_map.get(bundle_key)
            material_id = master_barang_map.get(material_clean)

            if bundle_id and material_id:
                sql = "INSERT INTO detailbundling (id_bundling, id_masterbarang, qty_required) VALUES (" + str(bundle_id) + ", " + str(material_id) + ", " + str(conversion_factor) + ");"
                sql_statements.append(sql)
                processed_details.add(detail_key)

try:
    # Post-processing: Remove "VARIAN [anything]" from masterbarang names
    print('Post-processing: Cleaning masterbarang names...')
    import re
    cleaned_statements = []
    for stmt in sql_statements:
        if 'INSERT INTO masterbarang' in stmt:
            # Remove "VARIAN [anything]" pattern from nama field
            stmt = re.sub(r"(VALUES \(\d+, ')([^']+)( VARIAN [^']+)(')", r"\1\2\4", stmt, flags=re.IGNORECASE)
        cleaned_statements.append(stmt)

    sql_content = "-- Product Migration SQL\n-- Generated: " + datetime.now().isoformat() + "\n-- Total statements: " + str(len(sql_statements)) + "\n\nSET FOREIGN_KEY_CHECKS=0;\n\n" + "\n".join(cleaned_statements) + "\n\nSET FOREIGN_KEY_CHECKS=1;\n\n-- Migration complete!\n"
except Exception as e:
    print('Error in post-processing:', e)
    import traceback
    traceback.print_exc()
    sql_content = "-- Product Migration SQL\n-- Generated: " + datetime.now().isoformat() + "\n-- Total statements: " + str(len(sql_statements)) + "\n\nSET FOREIGN_KEY_CHECKS=0;\n\n" + "\n".join(sql_statements) + "\n\nSET FOREIGN_KEY_CHECKS=1;\n\n-- Migration complete!\n"

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write(sql_content)

print('Migration SQL generated: ' + OUTPUT_FILE)
print('Total SQL statements: ' + str(len(sql_statements)))
