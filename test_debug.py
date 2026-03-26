import openpyxl

wb = openpyxl.load_workbook('Produk Material-2026-01-09__2026-01-09.xlsx')
sheet = wb['product_materials']

rows = list(sheet.iter_rows(values_only=True))
row1 = rows[1]

product_name = row1[0]
variant = row1[1]
material = row1[3]

print('Row 1:')
print('  Product:', product_name)
print('  Variant:', variant)
print('  Material:', material)
print('  Product cleaned:', str(product_name).lstrip('#').strip())
print('  Material cleaned:', str(material).lstrip('#').strip())

# Check if this is single or multi-variant
material_variants = {}
for i, row in enumerate(rows):
    if i > 0:
        mat = row[3]
        prod = row[0]
        var = row[1]
        if mat and prod:
            mat_clean = str(mat).replace("'", "''")
            if mat_clean not in material_variants:
                material_variants[mat_clean] = []
            material_variants[mat_clean].append((prod, var))

# Check MESES
meses_material = str(material).replace("'", "''")
if meses_material in material_variants:
    variants = material_variants[meses_material]
    unique_variants = set((v[0], v[1]) for v in variants)
    print('\nMESES Material:', meses_material)
    print('  Total rows:', len(variants))
    print('  Unique variants:', len(unique_variants))
    print('  Is multi-variant?', len(unique_variants) > 1)
    if len(unique_variants) <= 3:
        for v in unique_variants:
            print('    -', v)

