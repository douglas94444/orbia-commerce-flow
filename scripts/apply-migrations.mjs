/**
 * Reads .tmp-mig-*.sql files and prints JSON payloads for MCP apply_migration.
 * Usage: node scripts/apply-migrations.mjs 028
 */
import fs from 'fs'
import path from 'path'

const projectId = 'ztaozvgmzycetiwwkhjc'
const n = process.argv[2]
if (!n) {
  console.error('Usage: node scripts/apply-migrations.mjs <028|029|030|031|032>')
  process.exit(1)
}

const names = {
  '028': '028_fulfillly_wms',
  '029': '029_fulfillly_stock_v2',
  '030': '030_order_items_pick_pack_sla',
  '031': '031_reverse_logistics',
  '032': '032_fulfillment_cross',
}

const name = names[n]
const file = path.join(process.cwd(), `.tmp-mig-${n}.sql`)
const query = fs.readFileSync(file, 'utf8')
process.stdout.write(JSON.stringify({ project_id: projectId, name, query }))
