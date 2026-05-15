const DB_FILE_NAME = 'INDAH CELL POS Database';
const STORE_NAME = 'INDAH CELL';
const SCRIPT_PROPS = PropertiesService.getScriptProperties();

const SHEET_HEADERS = {
  Products: ['id', 'sku', 'name', 'category', 'type', 'price', 'cost', 'stock', 'minStock', 'unit', 'active', 'notes', 'createdAt', 'updatedAt'],
  Customers: ['id', 'name', 'phone', 'address', 'points', 'totalSpend', 'createdAt', 'updatedAt'],
  Suppliers: ['id', 'name', 'phone', 'address', 'notes', 'createdAt', 'updatedAt'],
  Transactions: ['id', 'invoice', 'date', 'customerId', 'customerName', 'subtotal', 'discount', 'tax', 'total', 'paid', 'change', 'paymentMethod', 'cashier', 'note', 'status', 'createdAt'],
  TransactionItems: ['id', 'transactionId', 'productId', 'sku', 'name', 'category', 'type', 'qty', 'price', 'cost', 'discount', 'total'],
  StockMovements: ['id', 'date', 'productId', 'sku', 'productName', 'type', 'qty', 'beforeStock', 'afterStock', 'reference', 'note'],
  Expenses: ['id', 'date', 'category', 'description', 'amount', 'paymentMethod', 'note', 'createdAt'],
  ServiceOrders: ['id', 'ticketNo', 'date', 'customerId', 'customerName', 'phone', 'device', 'serviceType', 'description', 'status', 'price', 'cost', 'deposit', 'dueDate', 'note', 'createdAt', 'updatedAt'],
  Settings: ['id', 'key', 'value', 'updatedAt']
};

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('POS INDAH CELL')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    return json_(api(body.action, body.payload || {}));
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function api(action, payload) {
  try {
    ensureDb_();
    let data;
    switch (action) {
      case 'bootstrap':
        data = loadData_();
        break;
      case 'saveProduct':
        data = saveProduct_(payload || {});
        break;
      case 'deleteProduct':
        data = deleteProduct_(payload.id);
        break;
      case 'saveCustomer':
        data = saveCustomer_(payload || {});
        break;
      case 'deleteCustomer':
        data = deleteRowById_('Customers', payload.id);
        break;
      case 'saveSupplier':
        data = saveSupplier_(payload || {});
        break;
      case 'deleteSupplier':
        data = deleteRowById_('Suppliers', payload.id);
        break;
      case 'createTransaction':
        data = createTransaction_(payload || {});
        break;
      case 'adjustStock':
        data = adjustStock_(payload || {});
        break;
      case 'saveExpense':
        data = saveExpense_(payload || {});
        break;
      case 'deleteExpense':
        data = deleteRowById_('Expenses', payload.id);
        break;
      case 'saveServiceOrder':
        data = saveServiceOrder_(payload || {});
        break;
      case 'deleteServiceOrder':
        data = deleteRowById_('ServiceOrders', payload.id);
        break;
      case 'saveSettings':
        data = saveSettings_(payload || {});
        break;
      default:
        throw new Error('Aksi tidak dikenal: ' + action);
    }
    return { ok: true, data: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function ensureDb_() {
  const ss = getSpreadsheet_();
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    const headers = SHEET_HEADERS[name];
    const current = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || headers.length)).getValues()[0];
    const missingHeader = headers.some(function (header, index) {
      return current[index] !== header;
    });
    if (sheet.getLastRow() === 0 || missingHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headers.length);
    }
  });
  seedData_();
  migrateStoreName_();
  return ss;
}

function getSpreadsheet_() {
  let spreadsheetId = SCRIPT_PROPS.getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    try {
      return SpreadsheetApp.openById(spreadsheetId);
    } catch (err) {
      SCRIPT_PROPS.deleteProperty('SPREADSHEET_ID');
    }
  }
  const ss = SpreadsheetApp.create(DB_FILE_NAME);
  SCRIPT_PROPS.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function loadData_() {
  const ss = getSpreadsheet_();
  const data = {
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    products: readRows_('Products'),
    customers: readRows_('Customers'),
    suppliers: readRows_('Suppliers'),
    transactions: readRows_('Transactions'),
    transactionItems: readRows_('TransactionItems'),
    stockMovements: readRows_('StockMovements'),
    expenses: readRows_('Expenses'),
    serviceOrders: readRows_('ServiceOrders')
  };
  data.settings = getSettingsObject_();
  return data;
}

function saveProduct_(product) {
  const now = nowIso_();
  const isNew = !product.id;
  const record = {
    id: product.id || id_('prd'),
    sku: clean_(product.sku) || makeSku_(product.category, product.name),
    name: clean_(product.name),
    category: clean_(product.category) || 'Aksesoris',
    type: clean_(product.type) || 'Barang',
    price: number_(product.price),
    cost: number_(product.cost),
    stock: product.type === 'Jasa' ? '' : number_(product.stock),
    minStock: product.type === 'Jasa' ? '' : number_(product.minStock),
    unit: clean_(product.unit) || 'pcs',
    active: product.active === false ? false : true,
    notes: clean_(product.notes),
    createdAt: product.createdAt || now,
    updatedAt: now
  };
  if (!record.name) throw new Error('Nama produk wajib diisi.');
  upsertRow_('Products', record.id, record);
  if (isNew && record.type !== 'Jasa' && number_(record.stock) > 0) {
    appendRow_('StockMovements', {
      id: id_('stk'),
      date: now,
      productId: record.id,
      sku: record.sku,
      productName: record.name,
      type: 'STOK_AWAL',
      qty: number_(record.stock),
      beforeStock: 0,
      afterStock: number_(record.stock),
      reference: 'Produk baru',
      note: 'Stok awal saat input produk'
    });
  }
  return loadData_();
}

function deleteProduct_(id) {
  if (!id) throw new Error('ID produk kosong.');
  const product = findById_('Products', id);
  if (!product) throw new Error('Produk tidak ditemukan.');
  product.active = false;
  product.updatedAt = nowIso_();
  upsertRow_('Products', id, product);
  return loadData_();
}

function saveCustomer_(customer) {
  const now = nowIso_();
  const record = {
    id: customer.id || id_('cus'),
    name: clean_(customer.name),
    phone: clean_(customer.phone),
    address: clean_(customer.address),
    points: number_(customer.points),
    totalSpend: number_(customer.totalSpend),
    createdAt: customer.createdAt || now,
    updatedAt: now
  };
  if (!record.name) throw new Error('Nama pelanggan wajib diisi.');
  upsertRow_('Customers', record.id, record);
  return loadData_();
}

function saveSupplier_(supplier) {
  const now = nowIso_();
  const record = {
    id: supplier.id || id_('sup'),
    name: clean_(supplier.name),
    phone: clean_(supplier.phone),
    address: clean_(supplier.address),
    notes: clean_(supplier.notes),
    createdAt: supplier.createdAt || now,
    updatedAt: now
  };
  if (!record.name) throw new Error('Nama supplier wajib diisi.');
  upsertRow_('Suppliers', record.id, record);
  return loadData_();
}

function createTransaction_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const items = payload.items || [];
    if (!items.length) throw new Error('Keranjang masih kosong.');
    const now = nowIso_();
    const products = readRows_('Products');
    const txId = id_('trx');
    const invoice = nextInvoice_();
    let subtotal = 0;
    let totalCost = 0;
    const normalizedItems = items.map(function (item) {
      const product = item.productId ? products.find(function (p) { return p.id === item.productId; }) : null;
      if (item.productId && !product) throw new Error('Produk tidak ditemukan: ' + item.name);
      const qty = number_(item.qty);
      if (qty <= 0) throw new Error('Qty tidak valid untuk ' + (item.name || 'item'));
      const type = product ? product.type : (item.type || 'Jasa');
      const beforeStock = product ? number_(product.stock) : 0;
      if (product && type !== 'Jasa' && beforeStock < qty) {
        throw new Error('Stok ' + product.name + ' tidak cukup. Tersedia ' + beforeStock + '.');
      }
      const price = number_(item.price || (product && product.price));
      const cost = number_(item.cost || (product && product.cost));
      const discount = number_(item.discount);
      const total = Math.max(0, qty * price - discount);
      subtotal += total;
      totalCost += qty * cost;
      if (product && type !== 'Jasa') {
        product.stock = beforeStock - qty;
        product.updatedAt = now;
        upsertRow_('Products', product.id, product);
        appendRow_('StockMovements', {
          id: id_('stk'),
          date: now,
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          type: 'TERJUAL',
          qty: qty * -1,
          beforeStock: beforeStock,
          afterStock: beforeStock - qty,
          reference: invoice,
          note: 'Transaksi penjualan'
        });
      }
      return {
        id: id_('itm'),
        transactionId: txId,
        productId: product ? product.id : '',
        sku: product ? product.sku : clean_(item.sku),
        name: product ? product.name : clean_(item.name),
        category: product ? product.category : clean_(item.category),
        type: type,
        qty: qty,
        price: price,
        cost: cost,
        discount: discount,
        total: total
      };
    });
    const discount = number_(payload.discount);
    const tax = number_(payload.tax);
    const total = Math.max(0, subtotal - discount + tax);
    const paid = number_(payload.paid);
    const transaction = {
      id: txId,
      invoice: invoice,
      date: payload.date || now,
      customerId: clean_(payload.customerId),
      customerName: clean_(payload.customerName) || 'Umum',
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      total: total,
      paid: paid,
      change: Math.max(0, paid - total),
      paymentMethod: clean_(payload.paymentMethod) || 'Tunai',
      cashier: clean_(payload.cashier) || 'Kasir',
      note: clean_(payload.note),
      status: 'Lunas',
      createdAt: now
    };
    appendRow_('Transactions', transaction);
    normalizedItems.forEach(function (item) {
      appendRow_('TransactionItems', item);
    });
    if (transaction.customerId) {
      const customer = findById_('Customers', transaction.customerId);
      if (customer) {
        customer.totalSpend = number_(customer.totalSpend) + total;
        customer.points = number_(customer.points) + Math.floor(total / 10000);
        customer.updatedAt = now;
        upsertRow_('Customers', customer.id, customer);
      }
    }
    return { transaction: transaction, items: normalizedItems, totalCost: totalCost, data: loadData_() };
  } finally {
    lock.releaseLock();
  }
}

function adjustStock_(payload) {
  const product = findById_('Products', payload.productId);
  if (!product) throw new Error('Produk tidak ditemukan.');
  if (product.type === 'Jasa') throw new Error('Jasa tidak memakai stok.');
  const now = nowIso_();
  const before = number_(product.stock);
  const rawQty = number_(payload.qty);
  let after = before;
  let movementQty = rawQty;
  const mode = payload.mode || 'in';
  if (mode === 'out') {
    after = before - rawQty;
    movementQty = rawQty * -1;
  } else if (mode === 'set') {
    after = rawQty;
    movementQty = after - before;
  } else {
    after = before + rawQty;
  }
  if (after < 0) throw new Error('Stok tidak boleh minus.');
  product.stock = after;
  product.updatedAt = now;
  upsertRow_('Products', product.id, product);
  appendRow_('StockMovements', {
    id: id_('stk'),
    date: now,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    type: mode === 'in' ? 'MASUK' : (mode === 'out' ? 'KELUAR' : 'KOREKSI'),
    qty: movementQty,
    beforeStock: before,
    afterStock: after,
    reference: clean_(payload.reference),
    note: clean_(payload.note)
  });
  return loadData_();
}

function saveExpense_(expense) {
  const now = nowIso_();
  const record = {
    id: expense.id || id_('exp'),
    date: expense.date || now,
    category: clean_(expense.category) || 'Operasional',
    description: clean_(expense.description),
    amount: number_(expense.amount),
    paymentMethod: clean_(expense.paymentMethod) || 'Tunai',
    note: clean_(expense.note),
    createdAt: expense.createdAt || now
  };
  if (!record.description) throw new Error('Deskripsi pengeluaran wajib diisi.');
  upsertRow_('Expenses', record.id, record);
  return loadData_();
}

function saveServiceOrder_(order) {
  const now = nowIso_();
  const isNew = !order.id;
  const record = {
    id: order.id || id_('srv'),
    ticketNo: order.ticketNo || nextTicket_(),
    date: order.date || now,
    customerId: clean_(order.customerId),
    customerName: clean_(order.customerName) || 'Umum',
    phone: clean_(order.phone),
    device: clean_(order.device),
    serviceType: clean_(order.serviceType) || 'Jasa Lem',
    description: clean_(order.description),
    status: clean_(order.status) || 'Masuk',
    price: number_(order.price),
    cost: number_(order.cost),
    deposit: number_(order.deposit),
    dueDate: clean_(order.dueDate),
    note: clean_(order.note),
    createdAt: order.createdAt || now,
    updatedAt: now
  };
  if (!record.device && isNew) record.device = '-';
  upsertRow_('ServiceOrders', record.id, record);
  return loadData_();
}

function saveSettings_(settings) {
  const now = nowIso_();
  Object.keys(settings).forEach(function (key) {
    upsertRow_('Settings', key, {
      id: key,
      key: key,
      value: settings[key],
      updatedAt: now
    });
  });
  return loadData_();
}

function seedData_() {
  if (readRows_('Settings').length === 0) {
    saveSettings_({
      storeName: STORE_NAME,
      storePhone: '08xx-xxxx-xxxx',
      storeAddress: 'Alamat konter',
      defaultCashier: 'Kasir 1',
      receiptFooter: 'Terima kasih. Barang yang sudah dibeli tidak dapat ditukar kecuali ada perjanjian.',
      taxRate: '0',
      printerMode: 'system',
      paperWidth: '58',
      printerBaudRate: '9600',
      autoPrintReceipt: 'off'
    });
  }
  if (readRows_('Products').length > 0) return;
  const now = nowIso_();
  const products = [
    ['ACC-TG-001', 'Tempered Glass 9D', 'Aksesoris', 'Barang', 25000, 9000, 30, 5, 'pcs'],
    ['ACC-CS-001', 'Softcase Bening Universal', 'Aksesoris', 'Barang', 35000, 14000, 22, 5, 'pcs'],
    ['ACC-CH-020', 'Charger Fast Charging 20W', 'Aksesoris', 'Barang', 85000, 52000, 12, 3, 'pcs'],
    ['PKT-TRI-5GB', 'Paket Data 5GB', 'Paket Data', 'Paket', 25000, 22500, 50, 10, 'trx'],
    ['PKT-TSEL-10GB', 'Paket Data 10GB', 'Paket Data', 'Paket', 55000, 51000, 40, 10, 'trx'],
    ['SRV-LEM-001', 'Jasa Lem LCD / Backdoor', 'Jasa', 'Jasa', 50000, 12000, '', '', 'jasa'],
    ['SRV-LAGU-001', 'Isi Lagu / File Musik', 'Jasa', 'Jasa', 15000, 0, '', '', 'jasa'],
    ['SRV-TG-001', 'Pasang Tempered Glass', 'Jasa', 'Jasa', 10000, 0, '', '', 'jasa']
  ];
  products.forEach(function (row) {
    const id = id_('prd');
    appendRow_('Products', {
      id: id,
      sku: row[0],
      name: row[1],
      category: row[2],
      type: row[3],
      price: row[4],
      cost: row[5],
      stock: row[6],
      minStock: row[7],
      unit: row[8],
      active: true,
      notes: '',
      createdAt: now,
      updatedAt: now
    });
    if (row[3] !== 'Jasa' && number_(row[6]) > 0) {
      appendRow_('StockMovements', {
        id: id_('stk'),
        date: now,
        productId: id,
        sku: row[0],
        productName: row[1],
        type: 'STOK_AWAL',
        qty: row[6],
        beforeStock: 0,
        afterStock: row[6],
        reference: 'Seed data',
        note: 'Data contoh'
      });
    }
  });
  appendRow_('Customers', {
    id: id_('cus'),
    name: 'Pelanggan Umum',
    phone: '',
    address: '',
    points: 0,
    totalSpend: 0,
    createdAt: now,
    updatedAt: now
  });
  appendRow_('Suppliers', {
    id: id_('sup'),
    name: 'Supplier Aksesoris',
    phone: '08xx-xxxx-xxxx',
    address: '',
    notes: 'Contoh supplier',
    createdAt: now,
    updatedAt: now
  });
}

function migrateStoreName_() {
  const settings = getSettingsObject_();
  if (!settings.storeName || settings.storeName === 'Konter HP Modern') {
    upsertRow_('Settings', 'storeName', {
      id: 'storeName',
      key: 'storeName',
      value: STORE_NAME,
      updatedAt: nowIso_()
    });
  }
}

function readRows_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = SHEET_HEADERS[sheetName];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values
    .filter(function (row) { return row.some(function (value) { return value !== ''; }); })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (header, index) {
        obj[header] = row[index] instanceof Date ? row[index].toISOString() : row[index];
      });
      return obj;
    });
}

function appendRow_(sheetName, record) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  const headers = SHEET_HEADERS[sheetName];
  sheet.appendRow(headers.map(function (header) {
    return record[header] !== undefined ? record[header] : '';
  }));
}

function upsertRow_(sheetName, id, record) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  const headers = SHEET_HEADERS[sheetName];
  const rows = readRows_(sheetName);
  const index = rows.findIndex(function (row) { return row.id === id; });
  const values = headers.map(function (header) {
    return record[header] !== undefined ? record[header] : '';
  });
  if (index === -1) {
    sheet.appendRow(values);
  } else {
    sheet.getRange(index + 2, 1, 1, headers.length).setValues([values]);
  }
}

function deleteRowById_(sheetName, id) {
  if (!id) throw new Error('ID kosong.');
  const rows = readRows_(sheetName);
  const index = rows.findIndex(function (row) { return row.id === id; });
  if (index === -1) throw new Error('Data tidak ditemukan.');
  getSpreadsheet_().getSheetByName(sheetName).deleteRow(index + 2);
  return loadData_();
}

function findById_(sheetName, id) {
  return readRows_(sheetName).find(function (row) {
    return row.id === id;
  });
}

function getSettingsObject_() {
  const settings = {};
  readRows_('Settings').forEach(function (row) {
    settings[row.key] = row.value;
  });
  return settings;
}

function nextInvoice_() {
  const tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
  const prefix = 'INV-' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  const count = readRows_('Transactions').filter(function (row) {
    return String(row.invoice || '').indexOf(prefix) === 0;
  }).length + 1;
  return prefix + '-' + String(count).padStart(4, '0');
}

function nextTicket_() {
  const tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
  const prefix = 'SRV-' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  const count = readRows_('ServiceOrders').filter(function (row) {
    return String(row.ticketNo || '').indexOf(prefix) === 0;
  }).length + 1;
  return prefix + '-' + String(count).padStart(4, '0');
}

function makeSku_(category, name) {
  const cat = String(category || 'PRD').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'PRD';
  const slug = String(name || 'ITEM').replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'ITEM';
  return cat + '-' + slug + '-' + String(Math.floor(Math.random() * 9999)).padStart(4, '0');
}

function id_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function nowIso_() {
  return new Date().toISOString();
}

function clean_(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function number_(value) {
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
