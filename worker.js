/**
 * SENBET Cloudflare Worker API + Static Assets
 * Metadata is stored in TiDB Cloud; SENBET_DB is retained only as the one-time migration source.
 * Existing API response envelopes and role checks are retained.
 */
import { connect } from "@tidbcloud/serverless";
const TABLES = ["users","sessions","departments","resources","exams","attendance","reports","directives","materials","messages"];
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status,headers:{"content-type":"application/json; charset=utf-8",...headers}});
const SEO_TERMS=["ደቂቀ መዊዕ","ቅዱስ መርቆሬዎስ","መጥምቀ መለኮት ቅዱስ ዮሐንስ","ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ","ሰንበት ትምህርት ቤት","ሰንበት","የሰንበት ትምህርት ቤት መምህራን እና ተማሪዎች","የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ሰንበት ትምህርት ቤት","Dekike Mewi","Dekike Mewie","Dekike Mewi Kidus Merkorios","Kidus Merkorios","St. Mercurius","Saint Mercurius","Metmike Melekot Kidus Yohannes","Kidus Yohannes","St. John the Baptist","Dekike Mewi Kidus Merkorios and Metmike Melekot Kidus Yohannes Sunday School","Senbet","Senbet Timhirt Bet","Senbet Temari","Sunday School","Ethiopian Orthodox Sunday School Portal","Addis Ababa Sunday School"];
const SEO_TITLE="ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ | Dekike Mewie | ደቂቀ መዊዕ | ቅዱስ መርቆሬዎስ | መጥምቀ መለኮት ቅዱስ ዮሐንስ | ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ | ሰንበት ትምህርት ቤት | ሰንበት | የሰንበት ትምህርት ቤት መምህራን እና ተማሪዎች | የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ሰንበት ትምህርት ቤት | Dekike Mewi | Dekike Mewie | Dekike Mewi Kidus Merkorios | Kidus Merkorios | St. Mercurius | Saint Mercurius | Metmike Melekot Kidus Yohannes | Kidus Yohannes | St. John the Baptist | Dekike Mewi Kidus Merkorios and Metmike Melekot Kidus Yohannes Sunday School | Senbet | Senbet Timhirt Bet | Senbet Temari | Sunday School | Ethiopian Orthodox Sunday School Portal | Addis Ababa Sunday School";
const SEO_DESCRIPTION="ደቂቀ መዊዕ | ቅዱስ መርቆሬዎስ | መጥምቀ መለኮት ቅዱስ ዮሐንስ | ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ | ሰንበት ትምህርት ቤት | ሰንበት | የሰንበት ትምህርት ቤት መምህራን እና ተማሪዎች | የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ሰንበት ትምህርት ቤት | Dekike Mewi | Dekike Mewie | Dekike Mewi Kidus Merkorios | Kidus Merkorios | St. Mercurius | Saint Mercurius | Metmike Melekot Kidus Yohannes | Kidus Yohannes | St. John the Baptist | Dekike Mewi Kidus Merkorios and Metmike Melekot Kidus Yohannes Sunday School | Senbet | Senbet Timhirt Bet | Senbet Temari | Sunday School | Ethiopian Orthodox Sunday School Portal | Addis Ababa Sunday School. Ethiopian Orthodox Tewahedo Sunday School in Addis Ababa, Ethiopia. Official learning portal for teachers and students, lessons, educational resources, announcements, registration and school administration.";
const SEO_SCHEMA={"@context":"https://schema.org","@type":"EducationalOrganization","name":"ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ","alternateName":SEO_TERMS,"description":SEO_DESCRIPTION,"url":"https://senbet.1surapro25.workers.dev/","inLanguage":["am","en"],"areaServed":[{"@type":"Country","name":"Ethiopia"},{"@type":"City","name":"Addis Ababa"}],"keywords":SEO_TERMS.join(", "),"audience":{"@type":"EducationalAudience","educationalRole":["teacher","student"]}};
const SEARCH_ASSIST_SCRIPT="(() => {\n  const normalize = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\\u200B-\\u200D\\uFEFF]/g, '').replace(/[^\\p{L}\\p{N}\\s]/gu, ' ').replace(/\\s+/g, ' ').trim();\n  const distance = (left, right) => {\n    const a = Array.from(left), b = Array.from(right);\n    if (a.length > b.length) return distance(right, left);\n    let previous = Array.from({length:a.length + 1}, (_, i) => i);\n    for (let row = 1; row <= b.length; row++) {\n      const current = [row];\n      for (let col = 1; col <= a.length; col++) current[col] = Math.min(current[col-1]+1, previous[col]+1, previous[col-1]+(a[col-1] === b[row-1] ? 0 : 1));\n      previous = current;\n    }\n    return previous[a.length];\n  };\n  const caches = new WeakMap();\n  const getCards = (scope) => Array.from(scope.querySelectorAll('.glass-card')).filter(card => card.querySelector('h3,h4'));\n  const refresh = (input) => {\n    const scope = input.closest('.space-y-6') || document.body;\n    const found = getCards(scope).map(card => {\n      const heading = card.querySelector('h3,h4');\n      return {label:(heading?.textContent || '').trim(), text:(card.textContent || '').trim()};\n    }).filter(item => item.label && item.text);\n    if (found.length) caches.set(input, found);\n  };\n  const bind = (input) => {\n    if (input.dataset.senbetFuzzyBound) return;\n    input.dataset.senbetFuzzyBound = '1';\n    const hint = document.createElement('p');\n    hint.className = 'mt-2 px-1 text-xs text-amber-100/90';\n    hint.setAttribute('role', 'status');\n    hint.hidden = true;\n    input.insertAdjacentElement('afterend', hint);\n    const render = () => {\n      refresh(input);\n      const query = normalize(input.value);\n      const candidates = caches.get(input) || [];\n      hint.replaceChildren();\n      if (!query || !candidates.length) { hint.hidden = true; return; }\n      if (candidates.some(item => normalize(item.text).includes(query))) { hint.hidden = true; return; }\n      const parts = query.split(' ').filter(Boolean);\n      const scored = candidates.map(item => {\n        const words = normalize(item.text).split(' ').filter(Boolean);\n        let score = 0;\n        for (const part of parts) {\n          const limit = part.length <= 3 ? 1 : part.length <= 7 ? 2 : 3;\n          let best = Infinity;\n          for (const word of words) {\n            if (word.includes(part) || part.includes(word)) { best = 0; break; }\n            best = Math.min(best, distance(part, word));\n          }\n          if (best > limit) return null;\n          score += best / Math.max(1, Array.from(part).length);\n        }\n        return {item, score:score / parts.length};\n      }).filter(Boolean).sort((a,b) => a.score - b.score);\n      const best = scored[0]?.item;\n      if (!best) { hint.hidden = true; return; }\n      hint.hidden = false;\n      const text = document.createElement('span');\n      text.textContent = 'ምናልባት ይህን ፈልገው ይሆን? / Did you mean: ';\n      const button = document.createElement('button');\n      button.type = 'button';\n      button.className = 'font-semibold text-amber-300 underline decoration-amber-300/60 underline-offset-2 hover:text-amber-200';\n      button.textContent = best.label;\n      button.addEventListener('click', () => {\n        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;\n        setter?.call(input, best.label);\n        input.dispatchEvent(new Event('input', {bubbles:true}));\n      });\n      const question = document.createElement('span');\n      question.textContent = '?';\n      hint.append(text, button, question);\n    };\n    input.addEventListener('input', render);\n    input.addEventListener('focus', () => refresh(input));\n    refresh(input);\n  };\n  const bindAll = () => {\n    document.querySelectorAll('input[type=\"search\"]').forEach(input => {\n      const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();\n      if (placeholder.includes('ፋይል') || placeholder.includes('ርዕስ') || placeholder.includes('መልእክቶች') || placeholder.includes('announcement')) bind(input);\n    });\n  };\n  const start = () => {\n    bindAll();\n    const observer = new MutationObserver(() => bindAll());\n    if (document.body) observer.observe(document.body, {childList:true, subtree:true});\n  };\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});\n  else start();\n})();";
function enhanceHtml(response) {
  if (!(response.headers.get("content-type") || "").includes("text/html")) return response;
  return new HTMLRewriter()
    .on("title", {element(e) { e.setInnerContent(SEO_TITLE); }})
    .on('meta[name="description"]', {element(e) { e.setAttribute("content", SEO_DESCRIPTION); }})
    .on('meta[name="keywords"]', {element(e) { e.setAttribute("content", SEO_TERMS.join(", ")); }})
    .on('meta[property="og:title"]', {element(e) { e.setAttribute("content", SEO_TITLE); }})
    .on('meta[property="og:description"]', {element(e) { e.setAttribute("content", SEO_DESCRIPTION); }})
    .on('meta[property="og:site_name"]', {element(e) { e.setAttribute("content", SEO_TERMS[3]); }})
    .on('link[rel="canonical"]', {element(e) { e.setAttribute("href", "https://senbet.1surapro25.workers.dev/"); }})
    .on("head", {element(e) {
      e.append('<meta property="og:image" content="https://senbet.1surapro25.workers.dev/og-image.png"><meta property="og:image:secure_url" content="https://senbet.1surapro25.workers.dev/og-image.png"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://senbet.1surapro25.workers.dev/og-image.png">', {html:true});
      e.append('<script type="application/ld+json">'+JSON.stringify(SEO_SCHEMA)+'</script><script>'+SEARCH_ASSIST_SCRIPT+'</script>', {html:true});
    }})
    .transform(response);
}

const err = (error,status=400) => json({error},status);
const now = () => new Date().toISOString().replace("T"," ").slice(0,19);

const CORE_TABLES = {
  users: { table: "senbet_users", columns: ["id","username","role","department","assigned_grade","full_name","created_at","payload"], values: row => [String(row.id), row.username ?? null, row.role ?? null, row.department ?? null, row.assignedGrade ?? null, row.fullName ?? null, sqlDateTime(row.createdAt), JSON.stringify(row)] },
  resources: { table: "senbet_resources", columns: ["id","title","resource_type","target_grade","target_division","uploaded_by","created_at","expires_at","payload"], values: row => [String(row.id), row.title ?? null, row.resourceType ?? null, row.targetGrade ?? null, row.targetDivision ?? null, row.uploadedBy == null ? null : String(row.uploadedBy), sqlDateTime(row.createdAt), row.expiresAt == null ? null : Number(row.expiresAt), JSON.stringify(row)] },
  materials: { table: "senbet_materials", columns: ["id","department","title","file_type","uploaded_by","created_at","expires_at","payload"], values: row => [String(row.id), row.department ?? null, row.title ?? null, row.fileType ?? null, row.uploadedBy == null ? null : String(row.uploadedBy), sqlDateTime(row.createdAt), row.expiresAt == null ? null : Number(row.expiresAt), JSON.stringify(row)] },
  reports: { table: "senbet_reports", columns: ["id","department","submitted_by","status","title","created_at","expires_at","payload"], values: row => [String(row.id), row.department ?? null, row.submittedBy == null ? null : String(row.submittedBy), row.status ?? null, row.title ?? null, sqlDateTime(row.createdAt), row.expiresAt == null ? null : Number(row.expiresAt), JSON.stringify(row)] }
};
const schemaReady = new WeakMap();
const migrationComplete = new WeakSet();
function tidbConfig(env) {
  const host = String(env.TIDB_HOST || "").trim().replace(/^https?:\/\//i, "").split("/")[0].replace(/:\d+$/, "");
  const username = String(env.TIDB_USER || "").trim();
  const password = String(env.TIDB_PASSWORD || "");
  const database = String(env.TIDB_DATABASE || "").trim();
  if (!host || !username || !password || !database) throw new Error("TiDB secrets are incomplete; expected TIDB_HOST, TIDB_USER, TIDB_PASSWORD, and TIDB_DATABASE.");
  return { host, username, password, database };
}
async function sql(env, statement, params = null) {
  const conn = connect(tidbConfig(env));
  return conn.execute(statement, params);
}
function sqlDateTime(value) {
  if (!value) return null;
  const raw = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? raw.replace(" ", "T") + "Z" : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 19).replace("T", " ");
}
function parsePayload(value) {
  if (value == null) return null;
  try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; }
}
const DDL = [
  "CREATE TABLE IF NOT EXISTS senbet_users (id VARCHAR(191) NOT NULL PRIMARY KEY, username VARCHAR(191) NULL, role VARCHAR(32) NULL, department VARCHAR(191) NULL, assigned_grade INT NULL, full_name VARCHAR(255) NULL, created_at DATETIME NULL, payload LONGTEXT NOT NULL, KEY idx_su_username (username), KEY idx_su_role_grade (role, assigned_grade), KEY idx_su_department (department)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS senbet_resources (id VARCHAR(191) NOT NULL PRIMARY KEY, title VARCHAR(255) NULL, resource_type VARCHAR(32) NULL, target_grade INT NULL, target_division VARCHAR(32) NULL, uploaded_by VARCHAR(191) NULL, created_at DATETIME NULL, expires_at BIGINT NULL, payload LONGTEXT NOT NULL, KEY idx_sr_grade_division (target_grade, target_division), KEY idx_sr_uploaded_by (uploaded_by), KEY idx_sr_created_at (created_at), KEY idx_sr_expires_at (expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS senbet_materials (id VARCHAR(191) NOT NULL PRIMARY KEY, department VARCHAR(191) NULL, title VARCHAR(255) NULL, file_type VARCHAR(32) NULL, uploaded_by VARCHAR(191) NULL, created_at DATETIME NULL, expires_at BIGINT NULL, payload LONGTEXT NOT NULL, KEY idx_sm_department (department), KEY idx_sm_uploaded_by (uploaded_by), KEY idx_sm_created_at (created_at), KEY idx_sm_expires_at (expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS senbet_reports (id VARCHAR(191) NOT NULL PRIMARY KEY, department VARCHAR(191) NULL, submitted_by VARCHAR(191) NULL, status VARCHAR(32) NULL, title VARCHAR(255) NULL, created_at DATETIME NULL, expires_at BIGINT NULL, payload LONGTEXT NOT NULL, KEY idx_sp_department_status (department, status), KEY idx_sp_submitted_by (submitted_by), KEY idx_sp_created_at (created_at), KEY idx_sp_expires_at (expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS senbet_records (table_name VARCHAR(64) NOT NULL, record_id VARCHAR(191) NOT NULL, created_at DATETIME NULL, payload LONGTEXT NOT NULL, PRIMARY KEY (table_name, record_id), KEY idx_srec_record_id (record_id), KEY idx_srec_created_at (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS senbet_kv (key_name VARCHAR(512) NOT NULL PRIMARY KEY, value LONGTEXT NULL, expires_at BIGINT NULL, KEY idx_skv_expires_at (expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS senbet_migrations (migration_key VARCHAR(64) NOT NULL PRIMARY KEY, cursor_value LONGTEXT NULL, completed TINYINT NOT NULL DEFAULT 0, processed_count BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
];
async function ensureSchema(env) {
  let ready = schemaReady.get(env);
  if (!ready) {
    ready = (async () => {
      for (const statement of DDL) await sql(env, statement);
      await sql(env, "INSERT IGNORE INTO senbet_migrations (migration_key, cursor_value, completed, processed_count) VALUES (?, NULL, 0, 0)", ["kv_to_tidb_v1"]);
    })();
    schemaReady.set(env, ready);
  }
  try { await ready; } catch (error) { schemaReady.delete(env); throw error; }
}
async function migrationState(env) {
  const rows = await sql(env, "SELECT cursor_value, completed, processed_count FROM senbet_migrations WHERE migration_key = ? LIMIT 1", ["kv_to_tidb_v1"]);
  const row = rows[0] || {};
  const done = Number(row.completed || 0) === 1;
  if (done) migrationComplete.add(env);
  return { complete: done, cursor: row.cursor_value || null, processedCount: Number(row.processed_count || 0) };
}
async function migrationDone(env) {
  if (migrationComplete.has(env)) return true;
  return (await migrationState(env)).complete;
}
async function insertMany(env, tableName, columns, rows, valueMapper) {
  for (let start = 0; start < rows.length; start += 100) {
    const batch = rows.slice(start, start + 100);
    if (!batch.length) continue;
    const tuple = "(" + columns.map(() => "?").join(",") + ")";
    const valuesSql = batch.map(() => tuple).join(",");
    await sql(env, "INSERT IGNORE INTO " + tableName + " (" + columns.join(",") + ") VALUES " + valuesSql, batch.flatMap(valueMapper));
  }
}
async function importKvPage(env, keys) {
  const core = { users: [], resources: [], materials: [], reports: [] };
  const records = [];
  const kvRows = [];
  for (let start = 0; start < keys.length; start += 40) {
    const batch = keys.slice(start, start + 40);
    const values = await Promise.all(batch.map(async key => ({ key, value: await env.SENBET_DB.get(key.name) })));
    for (const item of values) {
      if (item.value == null) continue;
      const keyName = item.key.name;
      const split = keyName.indexOf(":");
      const prefix = split < 0 ? "" : keyName.slice(0, split);
      const suffix = split < 0 ? "" : keyName.slice(split + 1);
      let row = null;
      if (Object.prototype.hasOwnProperty.call(core, prefix)) {
        row = parsePayload(item.value);
        if (row && row.id != null) core[prefix].push(row);
        else kvRows.push([keyName, item.value, item.key.expiration ? Number(item.key.expiration) * 1000 : null]);
      } else if (TABLES.includes(prefix) && suffix) {
        row = parsePayload(item.value);
        if (row && row.id != null) records.push([prefix, String(row.id), sqlDateTime(row.createdAt), JSON.stringify(row)]);
        else kvRows.push([keyName, item.value, item.key.expiration ? Number(item.key.expiration) * 1000 : null]);
      } else {
        kvRows.push([keyName, item.value, item.key.expiration ? Number(item.key.expiration) * 1000 : null]);
      }
    }
  }
  for (const [table, rows] of Object.entries(core)) {
    const config = CORE_TABLES[table];
    if (rows.length) await insertMany(env, config.table, config.columns, rows, row => config.values(row));
  }
  if (records.length) await insertMany(env, "senbet_records", ["table_name","record_id","created_at","payload"], records, row => row);
  if (kvRows.length) await insertMany(env, "senbet_kv", ["key_name","value","expires_at"], kvRows, row => row);
}
async function migrateKvBatch(env, limit = 1000) {
  const state = await migrationState(env);
  if (state.complete) return state;
  if (!env.SENBET_DB) throw new Error("SENBET_DB KV binding is required for the one-time migration.");
  const options = { limit: Math.min(1000, Math.max(1, limit)), ...(state.cursor ? { cursor: state.cursor } : {}) };
  const page = await env.SENBET_DB.list(options);
  const keys = page.keys || [];
  await importKvPage(env, keys);
  const complete = Boolean(page.list_complete);
  const cursor = complete ? null : (page.cursor || null);
  await sql(env, "UPDATE senbet_migrations SET cursor_value = ?, completed = ?, processed_count = processed_count + ? WHERE migration_key = ?", [cursor, complete ? 1 : 0, keys.length, "kv_to_tidb_v1"]);
  return migrationState(env);
}
async function listKvTable(env, table) {
  const keys = [];
  let cursor;
  do {
    const page = await env.SENBET_DB.list({ prefix: table + ":", limit: 1000, ...(cursor ? { cursor } : {}) });
    keys.push(...(page.keys || []));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const rows = [];
  for (let start = 0; start < keys.length; start += 40) {
    const batch = keys.slice(start, start + 40);
    const values = await Promise.all(batch.map(async key => parsePayload(await env.SENBET_DB.get(key.name))));
    rows.push(...values.filter(Boolean));
  }
  return rows;
}
async function all(env, table) {
  const config = CORE_TABLES[table];
  const result = config ? await sql(env, "SELECT payload FROM " + config.table) : await sql(env, "SELECT payload FROM senbet_records WHERE table_name = ?", [table]);
  const rows = result.map(row => parsePayload(row.payload)).filter(Boolean);
  if (await migrationDone(env) || !env.SENBET_DB) return rows;
  const merged = new Map(rows.map(row => [String(row.id), row]));
  for (const row of await listKvTable(env, table)) if (!merged.has(String(row.id))) merged.set(String(row.id), row);
  return [...merged.values()];
}
async function get(env, table, id) {
  const config = CORE_TABLES[table];
  const result = config ? await sql(env, "SELECT payload FROM " + config.table + " WHERE id = ? LIMIT 1", [String(id)]) : await sql(env, "SELECT payload FROM senbet_records WHERE table_name = ? AND record_id = ? LIMIT 1", [table, String(id)]);
  const row = result[0] ? parsePayload(result[0].payload) : null;
  if (row || await migrationDone(env) || !env.SENBET_DB) return row;
  return parsePayload(await env.SENBET_DB.get(idKey(table, id)));
}
async function put(env, table, row) {
  const config = CORE_TABLES[table];
  if (config) {
    const values = config.values(row);
    const placeholders = "(" + config.columns.map(() => "?").join(",") + ")";
    const updates = config.columns.slice(1).map(column => column + "=VALUES(" + column + ")").join(",");
    await sql(env, "INSERT INTO " + config.table + " (" + config.columns.join(",") + ") VALUES " + placeholders + " ON DUPLICATE KEY UPDATE " + updates, values);
  } else {
    await sql(env, "INSERT INTO senbet_records (table_name,record_id,created_at,payload) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE created_at=VALUES(created_at), payload=VALUES(payload)", [table, String(row.id), sqlDateTime(row.createdAt), JSON.stringify(row)]);
  }
  if (!(await migrationDone(env)) && env.SENBET_DB) await env.SENBET_DB.put(idKey(table, row.id), JSON.stringify(row));
  return row;
}
async function remove(env, table, id) {
  const config = CORE_TABLES[table];
  if (config) await sql(env, "DELETE FROM " + config.table + " WHERE id = ?", [String(id)]);
  else await sql(env, "DELETE FROM senbet_records WHERE table_name = ? AND record_id = ?", [table, String(id)]);
  if (!(await migrationDone(env)) && env.SENBET_DB) await env.SENBET_DB.delete(idKey(table, id));
}
async function kvGet(env, key) {
  const rows = await sql(env, "SELECT value, expires_at FROM senbet_kv WHERE key_name = ? LIMIT 1", [key]);
  if (rows[0]) {
    const expires = rows[0].expires_at == null ? null : Number(rows[0].expires_at);
    if (expires && expires <= Date.now()) {
      await sql(env, "DELETE FROM senbet_kv WHERE key_name = ?", [key]);
      if (!(await migrationDone(env)) && env.SENBET_DB) await env.SENBET_DB.delete(key);
      return null;
    }
    return rows[0].value == null ? null : String(rows[0].value);
  }
  if (await migrationDone(env) || !env.SENBET_DB) return null;
  return env.SENBET_DB.get(key);
}
async function kvPut(env, key, value, options = {}) {
  const ttl = Number(options.expirationTtl || 0);
  const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
  await sql(env, "INSERT INTO senbet_kv (key_name,value,expires_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value), expires_at=VALUES(expires_at)", [key, String(value), expiresAt]);
  if (!(await migrationDone(env)) && env.SENBET_DB) {
    if (ttl > 0) await env.SENBET_DB.put(key, String(value), { expirationTtl: ttl });
    else await env.SENBET_DB.put(key, String(value));
  }
}
async function kvDelete(env, key) {
  await sql(env, "DELETE FROM senbet_kv WHERE key_name = ?", [key]);
  if (!(await migrationDone(env)) && env.SENBET_DB) await env.SENBET_DB.delete(key);
}
async function nextId(env, table) {
  const key = "seq:" + table;
  const n = Number(await kvGet(env, key) || 0) + 1;
  await kvPut(env, key, String(n));
  return n;
}
async function migrationStatus(env) {
  const state = await migrationState(env);
  return { database: "TiDB Cloud", migration: "Workers KV to TiDB", ...state };
}
const sortNewest=(a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))||Number(b.id)-Number(a.id);
const sortName=(a,b)=>String(a.fullName||"").localeCompare(String(b.fullName||""));
const safeUser=(u,withPassword=false)=>{if(!u)return null;const {password,passwordHash,...rest}=u;return withPassword?{...rest}:rest;};
function division(grade){return grade>=1&&grade<=4?"wetani":grade<=6?"maekelawi":"wetat";}
function gradeByAge(age){return age<=10?1:age<=14?3:age<=17?5:7;}
function mimeFor(name){const e=(name.split(".").pop()||"").toLowerCase();return ({pdf:"application/pdf",mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",m4a:"audio/mp4",aac:"audio/mp4",mp4:"video/mp4",webm:"video/webm",mov:"video/quicktime",avi:"video/x-msvideo",mkv:"video/x-matroska"})[e]||"application/octet-stream";}
function resourceType(name,mime,explicit){const n=(name||"").toLowerCase(),m=(mime||"").toLowerCase();if(m==="application/pdf"||n.endsWith(".pdf"))return "pdf";if(m.startsWith("audio/")||/\.(mp3|wav|ogg|m4a|aac)$/.test(n))return "audio";if(m.startsWith("video/")||/\.(mp4|webm|mov|mkv|avi)$/.test(n))return "video";return ["pdf","audio","video"].includes(explicit)?explicit:null;}
function safeName(s){return String(s||"file").split(/[\\/]/).pop().replace(/[\r\n"]/g,"_");}
function disposition(type,name){const n=preserveFileName(name||"download");const ascii=n.replace(/[^\x20-\x7e]/g,"_").replace(/"/g,"'");return type+'; filename="'+ascii+'"; filename*=UTF-8\'\''+encodeURIComponent(n);}
async function readBody(req){const ct=req.headers.get("content-type")||"";if(ct.includes("application/json"))return await req.json().catch(()=>({}));if(ct.includes("multipart/form-data")){const f=await req.formData(),o={};for(const [k,v] of f.entries()){if(typeof v==="string")o[k]=v;else if(v&&typeof v.arrayBuffer==="function"){o.file=v;if(!o.originalFileName&&v.name)o.originalFileName=v.name;if(!o.mimeType&&v.type)o.mimeType=v.type;}}return o;}return {};}
async function ensureSeed(env){
  if(await kvGet(env,"meta:initialized"))return;
  const depts=[
    ["education","ትምህርት ክፍል","የትምህርት ካሪኩለም፣ የመጽሐፍ ቅዱስና የቤተ ክርስቲያን ታሪክ ትምህርቶች አስተባባሪ",false],
    ["choir","መዝሙር ክፍል","የመዝሙር ልምምድ፣ የበገናና የከበሮ አገልግሎት (PDF፣ ኦዲዮ እና ቪዲዮ ግብአቶች)",true],
    ["property","ንብረት ክፍል","የሰንበት ትምህርት ቤቱ ንብረቶች፣ መጻሕፍትና ቁሳቁስ አስተዳደር",false],
    ["charity","በጎ አድራጎት ክፍል","የድጋፍ፣ የጉብኝት እና የበጎ አድራጎት አገልግሎት ማስተባበሪያ",false],
    ["member_admin","አባላት አስተዳደር ክፍል","የአባላት መረጃ፣ ስነ-ምግባርና ለሁሉም ክፍሎች መልእክት ማስተላለፊያ",false]
  ];
  for(const [id,label,description,allowsMedia] of depts) await put(env,"departments",{id,label,description,allowsMedia,createdAt:now()});
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const hash=await hashPassword("admin123",salt);
  await put(env,"users",{id:1,username:"admin",passwordHash:hash,passwordSalt:Array.from(salt),fullName:"SENBET Administrator",role:"head",age:32,educationLevel:"ዲግሪ",assignedGrade:null,department:null,subject:null,phone:null,createdAt:now()});
  await kvPut(env,"seq:users","1");
  await kvPut(env,"meta:initialized","1");
}
const PBKDF2_ITERATIONS=100000;
async function hashPassword(password,saltBytes){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:saltBytes,iterations:PBKDF2_ITERATIONS,hash:"SHA-256"},key,256);return Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,"0")).join("");}
async function verifyPassword(user,password){if(user.passwordHash&&user.passwordSalt){return await hashPassword(password,new Uint8Array(user.passwordSalt))===user.passwordHash;}return user.password===password;}
async function makeToken(env,userId){const token=Array.from(crypto.getRandomValues(new Uint8Array(24))).map(x=>x.toString(16).padStart(2,"0")).join("");await put(env,"sessions",{id:token,token,userId,createdAt:now()});return token;}
async function auth(req,env){const token=(req.headers.get("authorization")||"").startsWith("Bearer ")?req.headers.get("authorization").slice(7).trim():"";if(!token)return {error:"እባክዎ መጀመሪያ ወደ ስርዓቱ ይግቡ።",status:401};const s=await get(env,"sessions",token);const u=s?await get(env,"users",s.userId):null;if(!u)return {error:"የመግቢያ ጊዜዎ አብቅቷል፤ እባክዎ እንደገና ይግቡ።",status:401};return {user:u,token};}
const joinedUser=(row,u,fields={})=>({...row,...fields});
async function withUser(env,row,field){const u=await get(env,"users",row[field]);return u?{...row,[field==="uploadedBy"?"uploaderName":field==="submittedBy"?"submitterName":"senderName"]:u.fullName,...(field==="uploadedBy"?{uploaderRole:u.role}:{})}:row;}
async function enriched(env,rows,foreign,extra){const out=[];for(const r of rows){const u=await get(env,"users",r[foreign]);out.push({...r,...(u?extra(u):{})});}return out;}
async function getFile(env,kind,id){const table=kind==="resource"?"resources":kind==="material"?"materials":kind==="report"?"reports":null;const row=table?await get(env,table,Number(id)):null;if(!row)return null;return kind==="report"?{...row,fileUrl:row.pdfUrl,fileName:row.pdfName||"report.pdf"}:row;}
function googleDriveScriptUrl(env){return String(env.GOOGLE_DRIVE_SCRIPT_URL||"").trim();}
const FILE_TTL_MS=21*24*60*60*1000;
function expirationTime(row){
  if(Number.isFinite(Number(row?.expiresAt))&&Number(row.expiresAt)>0)return Number(row.expiresAt);
  if(row?.createdAt){const parsed=Date.parse(String(row.createdAt).replace(" ","T")+"Z");if(Number.isFinite(parsed))return parsed+FILE_TTL_MS;}
  return null;
}
function isExpired(row,at=Date.now()){if(row?.driveExpiredAt)return false;const expires=expirationTime(row);return expires!==null&&expires<=at;}
function extractGoogleDriveFileId(row){
  const direct=String(row?.googleDriveFileId||"").trim().replace(/^gdrive:/i,"");
  if(direct)return direct;
  const value=String(row?.fileUrl||row?.pdfUrl||"").trim();
  if(!value)return "";
  if(/^gdrive:/i.test(value))return value.slice(7).trim();
  try{
    const parsed=new URL(value);
    const host=parsed.hostname.toLowerCase();
    if(host==="drive.google.com"||host.endsWith(".drive.google.com")||host==="docs.google.com"){
      const pathMatch=parsed.pathname.match(/\/d\/([A-Za-z0-9_-]{10,})/);
      if(pathMatch)return pathMatch[1];
      const queryId=parsed.searchParams.get("id");
      if(queryId&&/^[A-Za-z0-9_-]{10,}$/.test(queryId))return queryId;
    }
  }catch{}
  const match=value.match(/[A-Za-z0-9_-]{20,}/);
  return match?match[1]:"";
}
async function trashGoogleDriveFileId(env,fileId){
  if(!fileId)return true;
  const script=googleDriveScriptUrl(env);
  if(!script)throw new Error("GOOGLE_DRIVE_SCRIPT_URL is not configured; refusing to delete the KV record before its Drive file is trashed.");
  const target=new URL(script);target.searchParams.set("action","delete");target.searchParams.set("fileId",fileId);
  const response=await fetch(target.toString(),{method:"GET",redirect:"follow"});
  const raw=await response.text();let result=null;try{result=raw?JSON.parse(raw):null;}catch{}
  if(!response.ok||result?.error||result?.ok===false||result?.status==="error")throw new Error("Google Drive trash request failed ("+response.status+"): "+String(result?.error||result?.message||raw||"Unknown response").slice(0,300));
  return true;
}
async function trashGoogleDriveFile(env,row){
  const ids=[...new Set([...(Array.isArray(row?.storageChunks)?row.storageChunks.map(x=>x?.googleDriveFileId).filter(Boolean):[]),extractGoogleDriveFileId(row)].filter(Boolean))];
  for(const id of ids)await trashGoogleDriveFileId(env,id);
  return true;
}
async function purgeExpiredTable(env,table){
  const rows=await all(env,table),expired=rows.filter(row=>isExpired(row));
  await Promise.all(expired.map(async row=>{
    await trashGoogleDriveFile(env,row);
    const permanent=Array.isArray(row.storageChunks)&&row.storageChunks.length>0&&row.storageChunks.every(chunk=>Boolean(chunk?.telegramFileId));
    if(permanent){
      row.storageChunks=row.storageChunks.map(chunk=>({...chunk,googleDriveFileId:null}));
      row.googleDriveFileIds=[];row.telegramPermanent=true;row.driveExpiredAt=Date.now();
      await put(env,table,row);
    }else await remove(env,table,row.id);
  }));
  return expired.length;
}
async function cleanupExpiredFiles(env){
  const counts=await Promise.all(["resources","materials","reports"].map(table=>purgeExpiredTable(env,table)));
  return counts.reduce((sum,count)=>sum+count,0);
}
async function createGoogleDriveUploadSession(env,{fileName,mimeType,fileSize}){
  const script=googleDriveScriptUrl(env);if(!script)return err("የGoogle Drive ማገናኛ አልተዋቀረም።",503);
  try{
    const sessionEndpoint=new URL(script);sessionEndpoint.searchParams.set("action","createUploadSession");
    const upstream=await fetch(sessionEndpoint.toString(),{method:"POST",headers:{"content-type":"text/plain;charset=utf-8"},body:JSON.stringify({fileName,mimeType,fileSize}),redirect:"follow"});
    const raw=await upstream.text();let result=null;try{result=raw?JSON.parse(raw):null;}catch{}
    if(!upstream.ok||!result||result.error)return err(result?.error||result?.message||"Google Drive የመጫኛ ክፍለ ጊዜ መፍጠር አልቻለም።",502);
    const uploadUrl=String(result.uploadUrl||"").trim();
    if(!uploadUrl)return err("Google Drive የመጫኛ URL አልመለሰም።",502);
    const parsed=new URL(uploadUrl);if(parsed.protocol!=="https:"||!/(^|\.)googleapis\.com$/i.test(parsed.hostname))return err("Google Drive የመጫኛ URL ትክክል አይደለም።",502);
    return json({uploadUrl});
  }catch(error){console.error("Google Drive upload session failed",error);return err("Google Drive የመጫኛ ክፍለ ጊዜ መፍጠር አልቻለም።",502);}
}
async function uploadToGoogleDrive(env,payload){
  const script=googleDriveScriptUrl(env);
  if(!script)return err("የGoogle Drive ማገናኛ አልተዋቀረም።",503);
  try{
    const upstream=await fetch(script,{method:"POST",headers:{"content-type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),redirect:"follow"});
    const raw=await upstream.text();
    let result=null;
    try{result=raw?JSON.parse(raw):null;}catch{}
    if(!upstream.ok)return err(result?.error||result?.message||"Google Drive ላይ ፋይሉን መጫን አልተቻለም።",502);
    if(!result||result.error||result.status==="error")return err(result?.error||result?.message||"Google Drive ትክክለኛ ምላሽ አልመለሰም።",502);
    const fileId=typeof result.fileId==="string"&&result.fileId.trim()?result.fileId.trim():typeof result.id==="string"&&result.id.trim()?result.id.trim():"";
    if(!fileId)return err("Google Drive የፋይል መለያ (fileId) አልመለሰም።",502);
    return json({fileId});
  }catch(e){
    console.error("Google Drive upload failed",e);
    return err("ወደ Google Drive መጫን አልተቻለም።",502);
  }
}

const UPLOAD_CHUNK_SIZE=15000000;
const FILE_LIMITS={pdf:100000000,audio:50000000,video:200000000,other:50000000};
const AUDIO_EXT=new Set(["mp3","wav","m4a","ogg","aac","flac"]);
const VIDEO_EXT=new Set(["mp4","webm","mov","mkv","avi"]);
const OTHER_EXT=new Set(["doc","docx","xls","xlsx","ppt","pptx","txt","csv","rtf","odt","ods","odp","png","jpg","jpeg","gif","webp","svg"]);
function fileClass(name,mime=""){
  const ext=String(name||"").toLowerCase().split(".").pop();
  if(ext==="pdf"||mime==="application/pdf")return "pdf";
  if(AUDIO_EXT.has(ext)||mime.startsWith("audio/"))return "audio";
  if(VIDEO_EXT.has(ext)||mime.startsWith("video/"))return "video";
  if(OTHER_EXT.has(ext)||mime.startsWith("image/")||mime.startsWith("text/"))return "other";
  return null;
}
function validateUpload(name,mime,size){
  const kind=fileClass(name,mime);
  if(!kind)return {error:"This file type is not allowed. Choose PDF, supported audio/video, or a common document/image file."};
  const limit=FILE_LIMITS[kind];
  if(size>limit)return {error:kind==="pdf"?"PDF files must be 100 MB or smaller.":kind==="audio"?"Audio files must be 50 MB or smaller.":kind==="video"?"Video files must be 200 MB or smaller.":"Documents and images must be 50 MB or smaller."};
  return {kind,limit};
}
function preserveFileName(value){return String(value||"file").split(/[\\\\/]/).pop().replace(/[\\r\\n\\0]/g,"_").trim()||"file";}
function base64FromBytes(bytes){let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));return btoa(binary);}
async function telegramStoreChunk(env,{blob,fileName,mimeType}){
  const token=String(env.TELEGRAM_BOT_TOKEN||"").trim(),chatId=String(env.TELEGRAM_STORAGE_CHAT_ID||"").trim();
  if(!token||!chatId)throw new Error("Telegram storage is not configured.");
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const form=new FormData();form.append("chat_id",chatId);form.append("document",new Blob([await blob.arrayBuffer()],{type:mimeType||"application/octet-stream"}),fileName);
      const response=await fetch("https://api.telegram.org/bot"+token+"/sendDocument",{method:"POST",body:form});
      const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch{}
      const fileId=data?.result?.document?.file_id;
      if(response.ok&&data?.ok&&typeof fileId==="string"&&fileId)return fileId;
      const message=data?.description||"Telegram sendDocument failed (HTTP "+response.status+").";
      if(response.status<500&&response.status!==429)throw new Error(message);
      lastError=new Error(message);
    }catch(error){lastError=error;if(attempt===2)break;}
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
  }
  throw lastError||new Error("Telegram upload failed.");
}
async function driveStoreChunk(env,{bytes,fileName,mimeType}){
  if(!googleDriveScriptUrl(env))throw new Error("Google Drive storage is not configured.");
  const response=await uploadToGoogleDrive(env,{fileName,mimeType,base64:base64FromBytes(bytes)});
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.fileId)throw new Error(data?.error||"Google Drive chunk upload failed.");
  return data.fileId;
}
async function mirrorChunkLater(env,uploadId,chunkIndex,bytes,fileName,mimeType){
  try{
    const fileId=await driveStoreChunk(env,{bytes,fileName,mimeType});
    const chunkKey="upload:"+uploadId+":chunk:"+chunkIndex,chunkRaw=await kvGet(env,chunkKey);let chunk=null;try{chunk=chunkRaw?JSON.parse(chunkRaw):null;}catch{}
    if(!chunk)return;
    chunk.googleDriveFileId=fileId;await kvPut(env,chunkKey,JSON.stringify(chunk),{expirationTtl:86400});
    const key="upload:"+uploadId,raw=await kvGet(env,key);let stage=null;try{stage=raw?JSON.parse(raw):null;}catch{}
    if(stage?.finalized&&Array.isArray(stage.chunks)){stage.chunks[chunkIndex]=chunk;await kvPut(env,key,JSON.stringify(stage),{expirationTtl:86400});}
    for(const table of ["resources","materials","reports"]){
      const rows=await all(env,table),row=rows.find(item=>item.uploadId===uploadId);
      if(row){row.storageChunks=stage.chunks;row.googleDriveFileIds=stage.chunks.map(c=>c.googleDriveFileId||null);await put(env,table,row);}
    }
  }catch(error){console.warn("Background Google Drive mirror failed; Telegram copy remains permanent",error);}
}
async function uploadChunkCore(env,actor,body,ctx){
  const blob=body.file;
  const uploadId=String(body.uploadId||"").trim(),chunkIndex=Number(body.chunkIndex),totalChunks=Number(body.totalChunks),fileSize=Number(body.fileSize);
  const originalName=preserveFileName(body.originalName||body.originalFileName||blob?.name),mimeType=String(body.mimeType||blob?.type||mimeFor(originalName)).trim();
  const validation=validateUpload(originalName,mimeType,fileSize);
  if(validation.error)return err(validation.error,413);
  if(!blob||typeof blob.arrayBuffer!=="function"||!uploadId||!/^[A-Za-z0-9_-]{16,80}$/.test(uploadId)||!originalName||!Number.isInteger(chunkIndex)||!Number.isInteger(totalChunks)||!Number.isSafeInteger(fileSize)||fileSize<=0||totalChunks!==Math.ceil(fileSize/UPLOAD_CHUNK_SIZE)||chunkIndex<0||chunkIndex>=totalChunks)return err("የፋይል ክፍሉ መረጃ ትክክል አይደለም።",400);
  if(blob.size>UPLOAD_CHUNK_SIZE)return err("Each upload chunk must be 15 MB or smaller.",413);
  const expectedSize=Math.min(UPLOAD_CHUNK_SIZE,fileSize-chunkIndex*UPLOAD_CHUNK_SIZE);
  if(blob.size!==expectedSize)return err("የፋይል ክፍሉ መጠን ከተጠበቀው ጋር አይዛመድም።",400);
  const stageKey="upload:"+uploadId,stageRaw=await kvGet(env,stageKey);let stage=null;
  try{stage=stageRaw?JSON.parse(stageRaw):null;}catch{}
  if(stage&&(stage.userId!==actor.id||stage.fileSize!==fileSize||stage.totalChunks!==totalChunks||stage.originalName!==originalName))return err("ይህ የመጫኛ መለያ ከዚህ ፋይል ጋር አይዛመድም።",409);
  if(stage?.chunks?.[chunkIndex]?.telegramFileId)return json({ok:true,chunkIndex,alreadyUploaded:true,fileId:stage.chunks[chunkIndex].telegramFileId});
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const driveName=originalName+".part-"+String(chunkIndex+1).padStart(3,"0");
  let telegramFileId;
  try{telegramFileId=await telegramStoreChunk(env,{blob,fileName:driveName,mimeType});}
  catch(error){console.error("Telegram chunk upload failed",error);return err("Could not save this chunk to permanent Telegram storage. Please retry.",502);}
  const chunkRecord={chunkIndex,byteLength:blob.size,telegramFileId,googleDriveFileId:null};
  const chunkKey=stageKey+":chunk:"+chunkIndex;
  await kvPut(env,stageKey,JSON.stringify({uploadId,userId:actor.id,originalName,mimeType,fileSize,totalChunks,createdAt:stage?.createdAt||Date.now()}),{expirationTtl:86400});
  await kvPut(env,chunkKey,JSON.stringify(chunkRecord),{expirationTtl:86400});
  if(ctx?.waitUntil)ctx.waitUntil(mirrorChunkLater(env,uploadId,chunkIndex,bytes,driveName,mimeType));
  return json({ok:true,chunkIndex,fileId:telegramFileId,storage:{telegram:true,googleDrive:"pending"}});
}
async function finalizeUpload(env,actor,uploadId){
  const key="upload:"+String(uploadId||"").trim(),raw=await kvGet(env,key);let stage=null;try{stage=raw?JSON.parse(raw):null;}catch{}
  if(!stage)return err("የመጫኛ ክፍለ ጊዜ አልተገኘም።",404);
  if(stage.userId!==actor.id)return err("ፈቃድ የለዎትም።",403);
  const chunkRows=await Promise.all(Array.from({length:stage.totalChunks},async(_,index)=>{const rawChunk=await kvGet(env,key+":chunk:"+index);try{return rawChunk?JSON.parse(rawChunk):null;}catch{return null;}}));
  if(chunkRows.some((chunk,index)=>!chunk||chunk.chunkIndex!==index||!chunk.telegramFileId))return err("ሁሉም የፋይል ክፍሎች ገና አልተጫኑም።",409);
  stage.chunks=chunkRows;stage.finalized=true;stage.finalizedAt=Date.now();await kvPut(env,key,JSON.stringify(stage),{expirationTtl:86400});
  return json({uploadId:stage.uploadId,originalFileName:stage.originalName,mimeType:stage.mimeType,fileSize:stage.fileSize,totalChunks:stage.totalChunks});
}
async function uploadSingleFile(env,actor,body,ctx){
  let file=body.file;
  if(!file&&typeof body.base64==="string"){
    try{const binary=atob(body.base64);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));file=new Blob([bytes],{type:body.mimeType||"application/octet-stream"});}catch{return err("Base64 ፋይሉ ትክክል አይደለም።",400);}
  }
  if(!file)return err("ፋይል አልተሰጠም።",400);
  const validation=validateUpload(body.originalName||body.originalFileName||file.name,body.mimeType||file.type,file.size);
  if(validation.error)return err(validation.error,413);
  if(file.size>UPLOAD_CHUNK_SIZE)return err("Files larger than 15 MB must be uploaded in chunks.",413);
  const uploadId=String(body.uploadId||crypto.randomUUID());
  const chunkBody={...body,file,uploadId,chunkIndex:0,totalChunks:1,fileSize:file.size,originalName:body.originalName||body.originalFileName||file.name,mimeType:body.mimeType||file.type||"application/octet-stream"};
  const uploaded=await uploadChunkCore(env,actor,chunkBody,ctx);
  if(!uploaded.ok)return uploaded;
  const uploadResult=await uploaded.json().catch(()=>({}));
  const finalized=await finalizeUpload(env,actor,uploadId);
  if(!finalized.ok)return finalized;
  return json({...(await finalized.json()),fileId:uploadResult.fileId||null,ok:true},201);
}
async function driveChunkBytes(env,fileId){
  const script=googleDriveScriptUrl(env);let upstream=null;
  if(script){const target=new URL(script);target.searchParams.set("fileId",fileId);upstream=await fetch(target.toString(),{redirect:"follow"});}
  if(!upstream||!upstream.ok||(upstream.headers.get("content-type")||"").includes("text/html"))upstream=await fetch("https://drive.google.com/uc?export=download&confirm=t&id="+encodeURIComponent(fileId),{redirect:"follow"});
  if(!upstream.ok)throw new Error("Google Drive chunk download failed.");
  const ct=upstream.headers.get("content-type")||"";
  if(ct.includes("application/json")){
    const payload=await upstream.json();if(payload.error||payload.status==="error")throw new Error(payload.error||payload.message||"Google Drive error");
    const encoded=payload.base64||payload.data;if(encoded){const binary=atob(String(encoded).split(",").pop());return Uint8Array.from(binary,c=>c.charCodeAt(0));}
    const dest=payload.downloadUrl||payload.url;if(dest){const response=await fetch(dest);if(!response.ok)throw new Error("Google Drive download URL failed.");return new Uint8Array(await response.arrayBuffer());}
    throw new Error("Google Drive returned no chunk content.");
  }
  return new Uint8Array(await upstream.arrayBuffer());
}
async function telegramChunkBytes(env,fileId){
  const token=String(env.TELEGRAM_BOT_TOKEN||"").trim();if(!token)throw new Error("Telegram storage is not configured.");
  const metaResponse=await fetch("https://api.telegram.org/bot"+token+"/getFile?file_id="+encodeURIComponent(fileId));
  const meta=await metaResponse.json().catch(()=>null);const path=meta?.result?.file_path;
  if(!metaResponse.ok||!meta?.ok||!path)throw new Error(meta?.description||"Telegram getFile failed.");
  const response=await fetch("https://api.telegram.org/file/bot"+token+"/"+path);
  if(!response.ok)throw new Error("Telegram file download failed.");
  return new Uint8Array(await response.arrayBuffer());
}
async function storedChunkBytes(env,chunk){
  if(chunk.googleDriveFileId){try{return await driveChunkBytes(env,chunk.googleDriveFileId);}catch(error){console.warn("Google Drive chunk unavailable; falling back to Telegram",error);}}
  if(chunk.telegramFileId)return telegramChunkBytes(env,chunk.telegramFileId);
  throw new Error("No available storage copy for this file chunk.");
}
async function storedFileResponse(env,target,type,filename){
  const chunks=target.storageChunks;
  if(!Array.isArray(chunks)||!chunks.length)return null;
  let index=0;
  const stream=new ReadableStream({
    async pull(controller){
      if(index>=chunks.length){controller.close();return;}
      try{controller.enqueue(await storedChunkBytes(env,chunks[index++]));}
      catch(error){controller.error(error);}
    }
  });
  return new Response(stream,{status:200,headers:{"content-type":mimeFor(filename),"content-disposition":disposition(type,filename),"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}
function publicFileRecord(row,kind){
  const {storageChunks,telegramFileIds,googleDriveFileIds,googleDriveFileId,...safe}=row;
  const download="/api/files/download?kind="+encodeURIComponent(kind)+"&id="+encodeURIComponent(row.id);
  if(kind==="report")return {...safe,pdfUrl:row.pdfName?download:null};
  return {...safe,fileUrl:download};
}
async function createStoredFile(env,body,actor){
  const uploadId=String(body.uploadId||"").trim();
  if(!uploadId){
    const legacy=await legacyCreateStoredFile(body);if(!legacy)return null;
    const driveId=legacy.fileUrl.slice(7);
    return {...legacy,storageChunks:[{chunkIndex:0,byteLength:0,telegramFileId:null,googleDriveFileId:driveId}],uploadId:null};
  }
  const raw=await kvGet(env,"upload:"+uploadId);let stage=null;try{stage=raw?JSON.parse(raw):null;}catch{}
  if(!stage||!stage.finalized||stage.userId!==actor.id)return null;
  const name=preserveFileName(stage.originalName),mime=stage.mimeType||mimeFor(name);
  return {fileUrl:"",fileName:name,resourceType:resourceType(name,mime,body.resourceType||body.fileType),storageChunks:stage.chunks,uploadId};
}

async function fileResponse(request,env,kind){
  const url=new URL(request.url),type=kind==="preview"?"inline":"attachment";
  const entityKind=url.searchParams.get("kind"),id=url.searchParams.get("id"),raw=url.searchParams.get("file"),name=url.searchParams.get("name");
  let target=null,filename=name||"download";
  if(entityKind&&id){
    const table=entityKind==="resource"?"resources":entityKind==="material"?"materials":entityKind==="report"?"reports":null;
    if(table)await purgeExpiredTable(env,table);
    target=await getFile(env,entityKind,id);if(!target)return err("ፋይሉ አልተገኘም።",404);filename=target.fileName||filename;
  }
  else if(raw){target={fileUrl:"/uploads/"+safeName(raw),fileName:safeName(raw)};filename=name||target.fileName;}
  else return err("የፋይል መለያ አልተሰጠም።",400);
  const stored=await storedFileResponse(env,target,type,filename);
  if(stored)return stored;
  const value=target.fileUrl||"";
  if(value.startsWith("gdrive:")){
    const script=googleDriveScriptUrl(env),fid=value.slice(7);
    try{
      let upstream;
      if(script){const sep=script.includes("?")?"&":"?";upstream=await fetch(script+sep+"fileId="+encodeURIComponent(fid),{redirect:"follow"});}
      if(!upstream||!upstream.ok||(upstream.headers.get("content-type")||"").includes("text/html"))upstream=await fetch("https://drive.google.com/uc?export=download&confirm=t&id="+encodeURIComponent(fid),{redirect:"follow"});
      if(!upstream.ok)return err("ፋይሉን ከGoogle Drive ማውረድ አልተቻለም።",502);
      const ct=upstream.headers.get("content-type")||mimeFor(filename);
      if(ct.includes("application/json")){const p=await upstream.json();if(p.error||p.status==="error")return err(p.error||p.message||"Google Drive error",502);const b64=p.base64||p.data;if(b64){const bin=atob(String(b64).split(",").pop());const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new Response(bytes,{headers:{"content-type":p.mimeType||p.contentType||mimeFor(filename),"content-disposition":disposition(type,filename),"cache-control":"private, max-age=3600"}});}const dest=p.downloadUrl||p.url;if(dest){const r=await fetch(dest);return new Response(r.body,{status:r.status,headers:{"content-type":mimeFor(filename),"content-disposition":disposition(type,filename),"cache-control":"private, max-age=3600"}});}}
      return new Response(upstream.body,{status:200,headers:{"content-type":ct,"content-disposition":disposition(type,filename),"cache-control":"private, max-age=3600",...(upstream.headers.get("content-length")?{"content-length":upstream.headers.get("content-length")}:{})}});
    }catch{return err("ፋይሉን ከGoogle Drive ማውረድ አልተቻለም።",502);}
  }
  if(value.startsWith("/uploads/"))return err("ይህ ፋይል በአሮጌው የአገልጋይ ዲስክ ላይ ነበር፤ ወደ Google Drive እንደገና ይጫኑት።",404);
  return err("የፋይሉ አድራሻ ትክክል አይደለም።",400);
}
async function legacyCreateStoredFile(body){
  const name=safeName(body.originalFileName||body.file?.name||"");
  const mime=body.mimeType||body.file?.type||mimeFor(name);
  const drive=String(body.googleDriveFileId||"").trim();
  if(!name||!drive||/\s/.test(drive))return null;
  return {fileUrl:"gdrive:"+drive,fileName:name,resourceType:resourceType(name,mime,body.resourceType||body.fileType)};
}
async function handler(request,env,ctx){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(method==="GET"&&path==="/googleba7f61ba454e7933.html"){
    return new Response("google-site-verification: googleba7f61ba454e7933.html",{status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=3600","x-content-type-options":"nosniff"}});
  }
  if(method==="GET"&&path==="/og-image.png"){
    const upstream=await fetch("https://raw.githubusercontent.com/surapro25-sketch/senbet/main/src/assets/images/senbet-og-image.png",{cf:{cacheEverything:true,cacheTtl:86400}});
    if(!upstream.ok)return new Response("Open Graph image not found.",{status:404});
    const headers=new Headers(upstream.headers);
    headers.set("content-type","image/png");
    headers.set("cache-control","public, max-age=86400, s-maxage=604800, immutable");
    headers.set("x-content-type-options","nosniff");
    return new Response(upstream.body,{status:200,headers});
  }
  if(method==="GET"&&path==="/robots.txt"){
    return new Response(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://senbet.1surapro25.workers.dev/sitemap.xml
`,{headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600"}});
  }
  if(method==="GET"&&path==="/sitemap.xml"){
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://senbet.1surapro25.workers.dev/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`,{headers:{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age=3600"}});
  }
  await ensureSchema(env);
  try { await migrateKvBatch(env, 1000); } catch (migrationError) { console.error("SENBET KV migration batch failed; continuing with dual-read/dual-write compatibility", migrationError); }
  await ensureSeed(env);
  if(path==="/api/public/tidb-migration"&&method==="GET"){
    const state=await migrationStatus(env);
    return json({database:state.database,complete:state.complete,processedCount:state.processedCount});
  }
  if(path==="/api/files/download"&&method==="GET")return fileResponse(request,env,"download");
  if(path==="/api/files/preview"&&method==="GET")return fileResponse(request,env,"preview");
  if(path==="/api/public/overview"&&method==="GET"){
    await purgeExpiredTable(env,"resources");
    const users=await all(env,"users"),resources=await all(env,"resources");
    return json({stats:{studentCount:users.filter(x=>x.role==="student").length,teacherCount:users.filter(x=>x.role==="teacher").length,resourceCount:resources.length,memberCount:users.filter(x=>["dept_head","dept_member"].includes(x.role)).length}});
  }
  const body=["POST","PATCH","PUT"].includes(method)?await readBody(request):{};
  const a=await auth(request,env),needsAuth=!["/api/auth/login","/api/auth/register-student"].includes(path);
  if(needsAuth&&a.error)return err(a.error,a.status);
  const actor=a.user;
  if(path==="/api/files/upload-session"&&method==="POST"){
    if(!["head","teacher","dept_head"].includes(actor.role))return err("ፈቃድ የለዎትም።",403);
    const fileName=safeName(body.fileName),mimeType=String(body.mimeType||"application/octet-stream").trim(),fileSize=Number(body.fileSize);
    if(!fileName||!Number.isSafeInteger(fileSize)||fileSize<=0)return err("የፋይል መረጃው ትክክል አይደለም።",400);
    return createGoogleDriveUploadSession(env,{fileName,mimeType,fileSize});
  }
  if(path==="/api/files/upload-chunk"&&method==="POST"){
    if(!["head","teacher","dept_head"].includes(actor.role))return err("ፈቃድ የለዎትም።",403);
    return uploadChunkCore(env,actor,body,ctx);
  }
  if(path==="/api/files/finalize"&&method==="POST"){
    if(!["head","teacher","dept_head"].includes(actor.role))return err("ፈቃድ የለዎትም።",403);
    return finalizeUpload(env,actor,body.uploadId);
  }
  if(path==="/api/files/upload"&&method==="POST"){
    if(!["head","teacher","dept_head"].includes(actor.role))return err("ፈቃድ የለዎትም።",403);
    return uploadSingleFile(env,actor,body,ctx);
  }
  const idMatch=path.match(/^\/api\/(users|resources|exams|reports|directives|dept-materials|departments\/materials|departments\/reports)\/(\d+)$/);
  if(path==="/api/admin/tidb-migration"&&method==="GET"){
    if(actor.role!=="head")return err("የዋና ሀላፊ ፈቃድ ያስፈልጋል።",403);
    return json(await migrationStatus(env));
  }
  if(path==="/api/admin/tidb-migration"&&method==="POST"){
    if(actor.role!=="head")return err("የዋና ሀላፊ ፈቃድ ያስፈልጋል።",403);
    try { await migrateKvBatch(env,1000); return json(await migrationStatus(env)); }
    catch(error) { console.error("SENBET admin migration batch failed",error); return err("TiDB የዳታ ማዛወር አልተሳካም።",502); }
  }
  // Departments
  if(path==="/api/departments"&&method==="GET"){const rows=(await all(env,"departments")).sort((x,y)=>String(x.createdAt).localeCompare(String(y.createdAt)));return json({departments:rows.map(d=>({...d,allowsMedia:Boolean(d.allowsMedia)}))});}
  if(path==="/api/departments"&&method==="POST"){
    if(actor.role!=="head")return err("አዲስ የስራ ክፍል ለመፍጠር የሀላፊ ፈቃድ ያስፈልጋል።",403);
    const label=typeof body.label==="string"?body.label.trim():"";if(!label)return err("እባክዎ የአዲሱን የስራ ክፍል ስም ያስገቡ።");
    const rows=await all(env,"departments"),old=rows.find(d=>d.label.toLowerCase()===label.toLowerCase());if(old)return json({department:{...old,allowsMedia:Boolean(old.allowsMedia)}});
    const d={id:"dept_"+Date.now().toString(36)+"_"+crypto.randomUUID().slice(0,4),label,description:String(body.description||"").trim(),allowsMedia:Boolean(body.allowsMedia),createdAt:now()};await put(env,"departments",d);return json({department:d},201);
  }
  // Admin stats
  if(path==="/api/admin/stats"&&method==="GET"){
    if(actor.role!=="head")return err("የአስተዳደር ስታቲስቲክስን ለማየት የሀላፊ ፈቃድ ያስፈልጋል።",403);
    await Promise.all(["resources","reports"].map(table=>purgeExpiredTable(env,table)));
    const users=await all(env,"users"),resources=await all(env,"resources"),reports=await all(env,"reports"),atts=await all(env,"attendance");
    const students=users.filter(u=>u.role==="student"),studentsPerGrade=Array.from({length:12},(_,i)=>{const g=i+1;return {grade:g,label:g+"ኛ ክፍል",division:division(g),count:students.filter(s=>s.assignedGrade===g).length};});
    const divisionTotals=[["wetani","ወጣኒ (1ኛ - 4ኛ)"],["maekelawi","ማእከላዊ (5ኛ - 6ኛ)"],["wetat","ወጣት (7ኛ - 12ኛ)"]].map(([d,label])=>({division:d,label,count:studentsPerGrade.filter(x=>x.division===d).reduce((n,x)=>n+x.count,0)}));
    const dates=[...new Set(atts.map(x=>x.date))].sort().slice(0,30),attendanceTrends=dates.map(date=>{const rows=atts.filter(x=>x.date===date),present=rows.filter(x=>x.status==="present").length,absent=rows.filter(x=>x.status==="absent").length,late=rows.filter(x=>x.status==="late").length,excused=rows.filter(x=>x.status==="excused").length,total=rows.length;return {date,present,absent,late,excused,total,rate:total?Math.round((present+late)/total*100):0};});
    const total=atts.length,attended=atts.filter(x=>["present","late"].includes(x.status)).length;
    return json({summary:{totalStudents:students.length,totalTeachers:users.filter(x=>x.role==="teacher").length,totalDeptMembers:users.filter(x=>["dept_head","dept_member"].includes(x.role)).length,attendanceRate:total?Math.round(attended/total*100):0,pendingReports:reports.filter(x=>x.status==="pending").length,totalResources:resources.length},studentsPerGrade,divisionTotals,attendanceTrends});
  }
  // Auth
  if(path==="/api/auth/register-student"&&method==="POST"){
    const fullName=String(body.fullName||"").trim(),age=Number(body.age),username=String(body.username||"").trim(),password=String(body.password||"");
    if(fullName.split(/\s+/).length<3)return err("እባክዎ ሙሉ ስምዎን እስከ አያት (3 ስሞች) ያስገቡ።");
    if(!Number.isInteger(age)||age<5||age>100)return err("እድሜ ከ5 ዓመት በላይ ትክክለኛ ቁጥር መሆን አለበት።");
    if(!String(body.educationLevel||"").trim())return err("እባክዎ አሁን ያሉበትን የትምህርት ደረጃ ያስገቡ።");
    if(username.length<3)return err("የመግቢያ ስም (Username) ቢያንስ 3 ፊደላት መሆን አለበት።");
    if(password.length<4)return err("የይለፍ ቃል (Password) ቢያንስ 4 ቁምፊ መሆን አለበት።");
    if((await all(env,"users")).some(u=>u.username===username))return err("ይህ የመግቢያ ስም (Username) አስቀድሞ ተይዟል፤ ሌላ ይምረጡ።",409);
    const id=await nextId(env,"users"),salt=crypto.getRandomValues(new Uint8Array(16)),user={id,username,passwordHash:await hashPassword(password,salt),passwordSalt:Array.from(salt),fullName,role:"student",age,educationLevel:String(body.educationLevel).trim(),assignedGrade:gradeByAge(age),department:null,subject:null,phone:body.phone?String(body.phone).trim():null,createdAt:now()};
    await put(env,"users",user);const token=await makeToken(env,id);return json({token,user:safeUser(user)},201);
  }
  if(path==="/api/auth/login"&&method==="POST"){
    if(!body.username||!body.password)return err("እባክዎ የመግቢያ ስም እና የይለፍ ቃል ያስገቡ።");
    const u=(await all(env,"users")).find(x=>x.username===String(body.username).trim());
    if(!u||!(await verifyPassword(u,String(body.password))))return err("የመግቢያ ስም ወይም የይለፍ ቃል ትክክል አይደለም።",401);
    return json({token:await makeToken(env,u.id),user:safeUser(u)});
  }
  if(path==="/api/auth/logout"&&method==="POST"){await remove(env,"sessions",a.token);return json({ok:true});}
  if(path==="/api/auth/me"&&method==="GET")return json({user:safeUser(actor)});
  // User management
  if(path==="/api/users"&&method==="GET"){
    const users=await all(env,"users");
    if(actor.role==="head")return json({users:users.sort((x,y)=>String(x.role).localeCompare(String(y.role))||(x.assignedGrade||0)-(y.assignedGrade||0)||y.id-x.id).map(u=>safeUser(u))});
    if(actor.role==="teacher")return json({users:actor.assignedGrade?users.filter(u=>u.role==="student"&&u.assignedGrade===actor.assignedGrade).sort(sortName).map(u=>safeUser(u)):[]});
    if(actor.role==="dept_head")return json({users:actor.department?users.filter(u=>u.department===actor.department&&["dept_head","dept_member"].includes(u.role)).sort((x,y)=>String(x.role).localeCompare(String(y.role))||sortName(x,y)).map(u=>safeUser(u)):[]});
    return err("ይህን መረጃ ለማየት ፈቃድ የለዎትም።",403);
  }
  if(path==="/api/users"&&method==="POST"){
    if(!body.username||!body.password||!body.fullName)return err("ሙሉ ስም፣ የመግቢያ ስም እና የይለፍ ቃል ያስፈልጋሉ።");
    const users=await all(env,"users");if(users.some(u=>u.username===String(body.username).trim()))return err("ይህ የመግቢያ ስም (Username) አስቀድሞ አለ።",409);
    let role,dept=body.department||null,grade=body.assignedGrade?Number(body.assignedGrade):null;
    if(actor.role==="head"){if(!["head","teacher","student","dept_head","dept_member"].includes(body.role))return err("ትክክለኛ የስራ ድርሻ (Role) ይምረጡ።");role=body.role;if(role==="student"&&!grade&&body.age)grade=gradeByAge(Number(body.age));}
    else if(actor.role==="dept_head"&&actor.department){role="dept_member";dept=actor.department;grade=null;}
    else return err("አዲስ አባል ወይም መምህር ለመመዝገብ ፈቃድ የለዎትም።",403);
    const salt=crypto.getRandomValues(new Uint8Array(16)),id=await nextId(env,"users"),u={id,username:String(body.username).trim(),passwordHash:await hashPassword(String(body.password),salt),passwordSalt:Array.from(salt),fullName:String(body.fullName).trim(),role,age:body.age?Number(body.age):null,educationLevel:body.educationLevel?String(body.educationLevel).trim():null,assignedGrade:grade,department:dept,subject:role==="teacher"&&body.subject?String(body.subject).trim():null,phone:body.phone?String(body.phone).trim():null,createdAt:now()};await put(env,"users",u);return json({user:safeUser(u)},201);
  }
  if(idMatch&&idMatch[1]==="users"&&method==="PATCH"){
    const targetId=Number(idMatch[2]),u=await get(env,"users",targetId);if(!u)return err("ተጠቃሚው አልተገኘም።",404);
    if(actor.role!=="head"&&actor.id!==targetId)return err("የሌላ ተጠቃሚ መረጃ ለማስተካከል ፈቃድ የለዎትም።",403);
    const users=await all(env,"users");if(body.username&&body.username.trim()!==u.username&&users.some(x=>x.id!==targetId&&x.username===String(body.username).trim()))return err("ይህ የመግቢያ ስም (Username) በሌላ ሰው ተይዟል።",409);
    if(actor.role==="head"){
      for(const k of ["fullName","username","age","educationLevel","assignedGrade","department","role","phone"])if(body[k]!==undefined)u[k]=["fullName","username","educationLevel","department","phone"].includes(k)?(body[k]?String(body[k]).trim():null):(["age","assignedGrade"].includes(k)?(body[k]===""||body[k]===null?null:Number(body[k])):body[k]);
      if(u.role==="teacher"&&body.subject!==undefined)u.subject=body.subject?String(body.subject).trim():null;else if(u.role!=="teacher")u.subject=null;
    }else{for(const k of ["fullName","educationLevel","phone"])if(body[k]!==undefined)u[k]=body[k]?String(body[k]).trim():null;}
    if(body.password) {const salt=crypto.getRandomValues(new Uint8Array(16));u.passwordHash=await hashPassword(String(body.password),salt);u.passwordSalt=Array.from(salt);delete u.password;}
    await put(env,"users",u);return json({user:safeUser(u)});
  }
  if(idMatch&&idMatch[1]==="users"&&method==="DELETE"){
    const targetId=Number(idMatch[2]);if(actor.role!=="head")return err("መለያ ለመሰረዝ የሀላፊ ፈቃድ ያስፈልጋል።",403);if(actor.id===targetId)return err("የራስዎን ዋና ሀላፊ መለያ መሰረዝ አይችሉም።");await remove(env,"users",targetId);for(const s of await all(env,"sessions"))if(s.userId===targetId)await remove(env,"sessions",s.token);return json({ok:true});
  }
  if(path==="/api/files/upload-config"&&method==="GET"){
    if(!["head","teacher","dept_head"].includes(actor.role))return json({enabled:false,scriptUrl:null});const script=googleDriveScriptUrl(env);return json({enabled:!!script,scriptUrl:script||null});
  }
  // Educational resources
  if(path==="/api/resources"&&method==="GET"){
    await purgeExpiredTable(env,"resources");
    let rows=await enriched(env,await all(env,"resources"),"uploadedBy",u=>({uploaderName:u.fullName,uploaderRole:u.role}));rows.sort(sortNewest);
    if(actor.role==="student"&&actor.assignedGrade){const d=division(actor.assignedGrade);rows=rows.filter(r=>(r.targetGrade==null&&["all",d].includes(r.targetDivision))||r.targetGrade===actor.assignedGrade);}
    return json({resources:rows.map(r=>publicFileRecord(r,"resource"))});
  }
  if(path==="/api/resources"&&method==="POST"){
    if(!["head","teacher","dept_head"].includes(actor.role))return err("የትምህርት ግብአት ለመጫን ፈቃድ የለዎትም።",403);
    if(!String(body.title||"").trim())return err("እባክዎ የትምህርት ግብአቱን ርዕስ ያስገቡ።");
    const file=await createStoredFile(env,body,actor);if(!file)return err("እባክዎ ፋይሉን በትክክል ይጫኑና ይጨርሱ።");
    if(!file.resourceType)return err("የተፈቀዱት የፋይል አይነቶች PDF፣ Audio እና Video ብቻ ናቸው።");
    let grade=body.targetGrade?Number(body.targetGrade):null,div=body.targetDivision||"all";if(actor.role==="teacher"&&actor.assignedGrade&&!grade&&div==="all")grade=actor.assignedGrade;if(grade)div=division(grade);
    const id=await nextId(env,"resources"),r={id,title:String(body.title).trim(),description:String(body.description||"").trim(),resourceType:file.resourceType,fileUrl:file.fileUrl,fileName:file.fileName,storageChunks:file.storageChunks,googleDriveFileIds:file.storageChunks.map(chunk=>chunk.googleDriveFileId||null),telegramFileIds:file.storageChunks.map(chunk=>chunk.telegramFileId||null),telegramPermanent:file.storageChunks.every(chunk=>Boolean(chunk?.telegramFileId)),targetGrade:grade,targetDivision:div,uploadedBy:actor.id,createdAt:now(),expiresAt:Date.now()+FILE_TTL_MS};await put(env,"resources",r);return json({resource:{...publicFileRecord(r,"resource"),uploaderName:actor.fullName,uploaderRole:actor.role}},201);
  }
  if(idMatch&&idMatch[1]==="resources"&&method==="DELETE"){
    const id=Number(idMatch[2]),r=await get(env,"resources",id);if(!r)return err("ግብአቱ አልተገኘም።",404);if(actor.role!=="head"&&r.uploadedBy!==actor.id)return err("ይህን ግብአት ለመሰረዝ ፈቃድ የለዎትም።",403);
    try{await trashGoogleDriveFile(env,r);}catch(error){console.error("Resource Google Drive trash failed",error);return err("Google Drive ፋይሉን ወደ Trash ማንቀሳቀስ አልተቻለም፤ መዝገቡ አልተሰረዘም።",502);}
    await remove(env,"resources",id);return json({ok:true});
  }
  // Exams
  if(path==="/api/exams"&&method==="GET"){
    const grade=url.searchParams.get("grade"),users=await all(env,"users");let rows=await all(env,"exams");
    if(actor.role==="head"){if(grade)rows=rows.filter(e=>e.grade===Number(grade));}
    else if(actor.role==="teacher")rows=actor.assignedGrade?rows.filter(e=>e.grade===actor.assignedGrade):[];
    else if(actor.role==="student")rows=rows.filter(e=>e.studentId===actor.id);else rows=[];
    rows=rows.map(e=>({...e,studentName:users.find(u=>u.id===e.studentId)?.fullName||"",recordedByName:users.find(u=>u.id===e.recordedBy)?.fullName||""}));
    rows.sort((x,y)=>actor.role==="teacher"||actor.role==="head"?(x.grade-y.grade)||String(x.studentName).localeCompare(y.studentName)||y.id-x.id:y.id-x.id);return json({exams:rows});
  }
  if(path==="/api/exams"&&method==="POST"){
    if(!["head","teacher"].includes(actor.role))return err("የፈተና ውጤት ለመመዝገብ ፈቃድ የለዎትም።",403);
    const student=await get(env,"users",Number(body.studentId));if(!student||student.role!=="student"||!student.assignedGrade)return err("ተማሪው አልተገኘም።",404);
    if(actor.role==="teacher"&&actor.assignedGrade!==student.assignedGrade)return err("እርስዎ ከተመደቡበት ክፍል ውጪ ላሉ ተማሪዎች ውጤት ማስገባት አይችሉም።",403);
    const score=Number(body.score),max=Number(body.maxScore||100);if(Number.isNaN(score)||score<0||score>max)return err("ውጤቱ ከ0 እስከ "+max+" መካከል መሆን አለበት።");
    const id=await nextId(env,"exams"),e={id,studentId:student.id,grade:student.assignedGrade,subject:String(body.subject||"አጠቃላይ ትምህርት").trim(),examTitle:String(body.examTitle||"ፈተና").trim(),score,maxScore:max,term:String(body.term||"1ኛ መንፈቅ ዓመት").trim(),remarks:String(body.remarks||"").trim(),recordedBy:actor.id,updatedAt:now()};await put(env,"exams",e);return json({exam:{...e,studentName:student.fullName,recordedByName:actor.fullName}},201);
  }
  if(idMatch&&idMatch[1]==="exams"&&method==="PATCH"){
    const id=Number(idMatch[2]),e=await get(env,"exams",id);if(!e)return err("የፈተና ውጤቱ አልተገኘም።",404);if(actor.role!=="head"&&!(actor.role==="teacher"&&actor.assignedGrade===e.grade))return err("ይህን ውጤት ለማስተካከል ፈቃድ የለዎትም።",403);
    const max=body.maxScore!==undefined?Number(body.maxScore):e.maxScore,score=body.score!==undefined?Number(body.score):e.score;if(Number.isNaN(score)||score<0||score>max)return err("ውጤቱ ከ0 እስከ "+max+" መካከል መሆን አለበት።");
    for(const k of ["subject","examTitle","term","remarks"])if(body[k]!==undefined)e[k]=String(body[k]).trim();e.score=score;e.maxScore=max;e.updatedAt=now();await put(env,"exams",e);const users=await all(env,"users");return json({exam:{...e,studentName:users.find(u=>u.id===e.studentId)?.fullName||"",recordedByName:users.find(u=>u.id===e.recordedBy)?.fullName||""}});
  }
  if(idMatch&&idMatch[1]==="exams"&&method==="DELETE"){
    const id=Number(idMatch[2]),e=await get(env,"exams",id);if(!e)return err("የፈተና ውጤቱ አልተገኘም።",404);if(actor.role!=="head"&&!(actor.role==="teacher"&&actor.assignedGrade===e.grade))return err("ፈቃድ የለዎትም።",403);await remove(env,"exams",id);return json({ok:true});
  }
  // Attendance
  if(path==="/api/attendance"&&method==="GET"){
    const date=url.searchParams.get("date"),grade=url.searchParams.get("grade"),users=await all(env,"users");let rows=await all(env,"attendance");
    if(actor.role==="head"){if(grade)rows=rows.filter(x=>x.grade===Number(grade));if(date)rows=rows.filter(x=>x.date===date);}
    else if(actor.role==="teacher")rows=actor.assignedGrade?rows.filter(x=>x.grade===actor.assignedGrade&&(!date||x.date===date)):[];
    else if(actor.role==="student")rows=rows.filter(x=>x.studentId===actor.id);else rows=[];
    rows=rows.map(x=>({...x,studentName:users.find(u=>u.id===x.studentId)?.fullName||"",recordedByName:users.find(u=>u.id===x.recordedBy)?.fullName||""}));rows.sort((x,y)=>String(y.date).localeCompare(String(x.date))||(x.grade-y.grade)||String(x.studentName).localeCompare(y.studentName));return json({attendance:rows});
  }
  if(path==="/api/attendance/bulk"&&method==="POST"){
    if(!["head","teacher"].includes(actor.role))return err("አቴንዳንስ ለመመዝገብ ፈቃድ የለዎትም።",403);
    if(!body.date||!Array.isArray(body.entries)||!body.entries.length)return err("እባክዎ ቀንና የተማሪዎችን አቴንዳንስ ያስገቡ።");
    const users=await all(env,"users");for(const item of body.entries){const s=users.find(u=>u.id===Number(item.studentId)&&u.role==="student");if(!s||!s.assignedGrade)continue;if(actor.role==="teacher"&&actor.assignedGrade!==s.assignedGrade)return err("ከተመደቡበት ክፍል ውጪ አቴንዳንስ መመዝገብ አይችሉም።",403);let old=(await all(env,"attendance")).find(x=>x.studentId===s.id&&x.date===body.date);const row={...(old||{}),id:old?.id||await nextId(env,"attendance"),studentId:s.id,grade:s.assignedGrade,date:body.date,status:item.status,note:item.note||"",recordedBy:actor.id,createdAt:old?.createdAt||now()};await put(env,"attendance",row);}return json({ok:true});
  }
  // Reports
  if(path==="/api/reports"&&method==="GET"){
    await purgeExpiredTable(env,"reports");
    let rows=await enriched(env,await all(env,"reports"),"submittedBy",u=>({submitterName:u.fullName}));if(actor.role==="head"){}else if(actor.role==="dept_head"&&actor.department)rows=rows.filter(x=>x.department===actor.department);else rows=[];rows.sort(sortNewest);return json({reports:rows.map(r=>publicFileRecord(r,"report"))});
  }
  if(path==="/api/reports"&&method==="POST"){
    if(actor.role!=="dept_head"||!actor.department)return err("ሪፖርት ማቅረብ የሚችሉት የክፍል ተመዳቢ ሀላፊዎች ብቻ ናቸው።",403);
    if(!body.title||!body.content)return err("እባክዎ የሪፖርቱን ርዕስና የፅሁፍ ዝርዝር ያስገቡ።");
    let pdfUrl=null,pdfName=null;if(body.uploadId||body.googleDriveFileId){const f=await createStoredFile(env,{...body,resourceType:"pdf"},actor);if(!f||f.resourceType!=="pdf")return err("ለሪፖርት ማያያዣ የተፈቀደው PDF ፋይል ብቻ ነው።");pdfUrl=f.fileUrl;pdfName=f.fileName;}
    const reportUpload=(body.uploadId||body.googleDriveFileId)?await createStoredFile(env,{...body,resourceType:"pdf"},actor):null;
    const id=await nextId(env,"reports"),r={id,department:actor.department,submittedBy:actor.id,title:String(body.title).trim(),content:String(body.content).trim(),pdfUrl,pdfName,storageChunks:reportUpload?.storageChunks||null,googleDriveFileIds:reportUpload?.storageChunks?.map(chunk=>chunk.googleDriveFileId||null)||[],telegramFileIds:reportUpload?.storageChunks?.map(chunk=>chunk.telegramFileId||null)||[],telegramPermanent:Boolean(reportUpload?.storageChunks?.length&&reportUpload.storageChunks.every(chunk=>Boolean(chunk?.telegramFileId))),status:"pending",createdAt:now(),expiresAt:Date.now()+FILE_TTL_MS};await put(env,"reports",r);return json({report:{...publicFileRecord(r,"report"),submitterName:actor.fullName}},201);
  }
  if(idMatch&&["reports","departments/reports"].includes(idMatch[1])&&method==="PATCH"){if(actor.role!=="head")return err("ፈቃድ የለዎትም።",403);const r=await get(env,"reports",Number(idMatch[2]));if(r){r.status=body.status==="reviewed"?"reviewed":"pending";await put(env,"reports",r);}return json({ok:true});}
  if(idMatch&&["reports","departments/reports"].includes(idMatch[1])&&method==="DELETE"){
    const id=Number(idMatch[2]),r=await get(env,"reports",id);if(!r)return err("ሪፖርቱ አልተገኘም።",404);if(actor.role!=="head"&&!(actor.role==="dept_head"&&r.submittedBy===actor.id))return err("ይህን ሪፖርት ለመሰረዝ ፈቃድ የለዎትም።",403);
    try{await trashGoogleDriveFile(env,r);}catch(error){console.error("Report Google Drive trash failed",error);return err("Google Drive ፋይሉን ወደ Trash ማንቀሳቀስ አልተቻለም፤ መዝገቡ አልተሰረዘም።",502);}
    await remove(env,"reports",id);return json({ok:true});
  }
  // Directives
  if(path==="/api/directives"&&method==="GET"){
    let rows=await enriched(env,await all(env,"directives"),"senderId",u=>({senderName:u.fullName,senderRole:u.role}));if(actor.role==="head"){}else if(actor.role==="dept_head"&&actor.department)rows=rows.filter(d=>d.targetDepartment===actor.department);else if(actor.role==="dept_member"&&actor.department)rows=rows.filter(d=>d.targetDepartment===actor.department&&d.targetScope==="dept_members");else rows=[];rows.sort(sortNewest);return json({directives:rows});
  }
  if(path==="/api/directives"&&method==="POST"){
    if(!body.title||!body.body)return err("እባክዎ የትዕዛዙን ርዕስና ዝርዝር መልእክት ያስገቡ።");
    let target,scope;if(actor.role==="head"){if(!body.targetDepartment)return err("እባክዎ ትዕዛዙ የሚላክለትን ክፍል ይምረጡ።");target=body.targetDepartment;scope="dept_head";}else if(actor.role==="dept_head"&&actor.department){target=actor.department;scope="dept_members";}else return err("ትዕዛዝ ለማስተላለፍ ፈቃድ የለዎትም።",403);
    const id=await nextId(env,"directives"),d={id,senderId:actor.id,targetDepartment:target,targetScope:scope,title:String(body.title).trim(),body:String(body.body).trim(),status:"active",createdAt:now()};await put(env,"directives",d);return json({directive:{...d,senderName:actor.fullName,senderRole:actor.role}},201);
  }
  if(idMatch&&idMatch[1]==="directives"&&method==="PATCH"){
    const id=Number(idMatch[2]),d=await get(env,"directives",id);if(!d)return err("ትዕዛዙ አልተገኘም።",404);if(actor.role!=="head"&&actor.department!==d.targetDepartment)return err("ፈቃድ የለዎትም።",403);d.status="acknowledged";await put(env,"directives",d);return json({ok:true});
  }
  // Department materials
  if(path==="/api/dept-materials"&&method==="GET"){
    await purgeExpiredTable(env,"materials");
    let rows=await enriched(env,await all(env,"materials"),"uploadedBy",u=>({uploaderName:u.fullName}));if(actor.role==="head"){}else if(["dept_head","dept_member"].includes(actor.role)&&actor.department)rows=rows.filter(m=>m.department===actor.department);else rows=[];rows.sort(sortNewest);return json({materials:rows.map(m=>publicFileRecord(m,"material"))});
  }
  if(path==="/api/dept-materials"&&method==="POST"){
    if(actor.role!=="dept_head"||!actor.department)return err("ለክፍል አባላት ፋይል መስጠት የሚችሉት የክፍሉ ተመዳቢ ሀላፊዎች ብቻ ናቸው።",403);
    if(!body.title||!body.uploadId)return err("እባክዎ ርዕስና ፋይል ያስገቡ።");
    const f=await createStoredFile(env,body,actor);if(!f||!f.resourceType)return err("የማይታወቅ የፋይል አይነት ነው።");
    const dept=await get(env,"departments",actor.department),allows=dept?Boolean(dept.allowsMedia):actor.department==="choir";if(!allows&&f.resourceType!=="pdf")return err("ለዚህ ክፍል ለአባላት መስጠት የሚፈቀደው የPDF ፋይል ብቻ ነው። (ኦዲዮና ቪዲዮ ለመዝሙር ክፍል ወይም ለተፈቀደለት ክፍል ብቻ ነው)");
    const id=await nextId(env,"materials"),m={id,department:actor.department,title:String(body.title).trim(),description:String(body.description||"").trim(),fileType:f.resourceType,fileUrl:f.fileUrl,fileName:f.fileName,storageChunks:f.storageChunks,googleDriveFileIds:f.storageChunks.map(chunk=>chunk.googleDriveFileId||null),telegramFileIds:f.storageChunks.map(chunk=>chunk.telegramFileId||null),telegramPermanent:f.storageChunks.every(chunk=>Boolean(chunk?.telegramFileId)),uploadedBy:actor.id,createdAt:now(),expiresAt:Date.now()+FILE_TTL_MS};await put(env,"materials",m);return json({material:{...publicFileRecord(m,"material"),uploaderName:actor.fullName}},201);
  }
  if(idMatch&&["dept-materials","departments/materials"].includes(idMatch[1])&&method==="DELETE"){
    const id=Number(idMatch[2]),m=await get(env,"materials",id);if(!m)return err("ፋይሉ አልተገኘም።",404);if(actor.role!=="head"&&m.uploadedBy!==actor.id)return err("ፈቃድ የለዎትም።",403);
    try{await trashGoogleDriveFile(env,m);}catch(error){console.error("Material Google Drive trash failed",error);return err("Google Drive ፋይሉን ወደ Trash ማንቀሳቀስ አልተቻለም፤ መዝገቡ አልተሰረዘም።",502);}
    await remove(env,"materials",id);return json({ok:true});
  }
  // Targeted messages
  if(path==="/api/messages"&&method==="GET"){
    const users=await all(env,"users"),rows=await all(env,"messages");let enrichedRows=rows.map(m=>{const u=users.find(x=>x.id===m.senderId);return {...m,senderName:u?.fullName||"",senderRole:u?.role||"",senderDepartment:u?.department||null};}).sort(sortNewest);
    const can=actor.role==="head"||(["dept_head","dept_member"].includes(actor.role)&&actor.department==="member_admin");
    if(!can)enrichedRows=enrichedRows.filter(m=>{
      if(m.targetType==="all")return true;
      if(actor.role==="student"&&actor.assignedGrade){
        if(m.targetType==="grade"&&Number(m.targetValue)===actor.assignedGrade)return true;
        if(m.targetType==="division"&&m.targetValue===division(actor.assignedGrade))return true;
      }
      if(actor.role==="teacher"){
        if(m.targetType==="teachers")return true;
        if(actor.assignedGrade&&m.targetType==="grade"&&Number(m.targetValue)===actor.assignedGrade)return true;
        if(actor.assignedGrade&&m.targetType==="division"&&m.targetValue===division(actor.assignedGrade))return true;
      }
      if(["dept_head","dept_member"].includes(actor.role)&&actor.department&&m.targetType==="department"&&m.targetValue===actor.department)return true;
      return false;
    });
    return json({messages:enrichedRows});
  }
  if(path==="/api/messages"&&method==="POST"){
    const can=actor.role==="head"||(["dept_head","dept_member"].includes(actor.role)&&actor.department==="member_admin");if(!can)return err("መልእክት ለሁሉም ክፍላት ማስተላለፍ የሚችሉት የሰንበት ትምህርት ቤት ሀላፊ፣ የአባላት አስተዳደር ሀላፊ እና የአባላት አስተዳደር ክፍል አባላት ብቻ ናቸው።",403);
    if(!body.targetType||!body.targetValue||!body.title||!body.body)return err("እባክዎ ተቀባይ ክፍል፣ ርዕስ እና መልእክት ያስገቡ።");
    const id=await nextId(env,"messages"),m={id,senderId:actor.id,targetType:String(body.targetType),targetValue:String(body.targetValue),title:String(body.title).trim(),body:String(body.body).trim(),createdAt:now()};await put(env,"messages",m);return json({message:{...m,senderName:actor.fullName,senderRole:actor.role,senderDepartment:actor.department||null}},201);
  }
  if(path.startsWith("/api/"))return err("API endpoint not found.",404);
  // Safe SPA fallback: missing ASSETS must not hide API failures.
  if(env.ASSETS){const asset=await env.ASSETS.fetch(request);if(asset.status!==404)return enhanceHtml(asset);const index=await env.ASSETS.fetch(new Request(new URL("/index.html",request.url),request));if(index.ok)return enhanceHtml(index);return asset;}
  return new Response("Frontend assets binding ASSETS is unavailable.",{status:500});
}
export async function scheduled(event,env,ctx){ctx.waitUntil((async()=>{await ensureSchema(env);try{await migrateKvBatch(env,1000);}catch(error){console.error("Scheduled SENBET KV migration batch failed",error);}await cleanupExpiredFiles(env);})());}
export default {
  async fetch(request,env,ctx){try{return await handler(request,env,ctx);}catch(e){console.error("SENBET Worker error",e);if(new URL(request.url).pathname.startsWith("/api/"))return err("የአገልጋይ ስህተት ተከስቷል።",500);return new Response("Internal Server Error",{status:500});}},
  async scheduled(event,env,ctx){ctx.waitUntil((async()=>{await ensureSchema(env);try{await migrateKvBatch(env,1000);}catch(error){console.error("Scheduled SENBET KV migration batch failed",error);}await cleanupExpiredFiles(env);})());}
};
