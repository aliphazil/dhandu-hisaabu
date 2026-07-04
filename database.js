// Database and Storage Engine for "ދަނޑު ހިސާބު" (Dhandu Hisaabu)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD4nLy63w9FnhjF3UYwCBn9VD5jvI8ztK4",
  authDomain: "dhandu-hisaabu.firebaseapp.com",
  projectId: "dhandu-hisaabu",
  storageBucket: "dhandu-hisaabu.firebasestorage.app",
  messagingSenderId: "401937768714",
  appId: "1:401937768714:web:cf6ec6374a515900f2daf3"
};

let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (err) {
  console.error("Firebase init failed:", err);
}

// Seed Data
const DEFAULT_FARMS = [];

const DEFAULT_USERS = [
  // Platform Admin (No Farm ID, cannot access farm business data)
  { username: "sysadmin", password: "sysadminpassword", role: "platform_admin", name: "ޕްލެޓްފޯމް މެނޭޖަރ", farmId: null, status: "active" }
];

const DEFAULT_INVENTORY = [];
const DEFAULT_CROPS = [];
const DEFAULT_TRANSACTIONS = [];
const DEFAULT_FERTILIZERS = [];
const DEFAULT_HARVESTS = [];

const DEFAULT_AUDIT_LOGS = [
  { id: "log_1", farmId: null, timestamp: "2026-06-29T08:00:00Z", username: "sysadmin", eventType: "LOGIN", message: "ޕްލެޓްފޯމް އެޑްމިނިސްޓްރޭޓަރ ލޮގިން ވެއްޖެ", type: "system" }
];

const DEFAULT_TREATMENT_PRODUCTS = [];
const DEFAULT_TREATMENT_APPLICATIONS = [];

export function initDB() {
  // Wipe out legacy database containing default demo farms
  let existingServer = localStorage.getItem("dhandu_hisaabu_server_db");
  if (existingServer && existingServer.includes('"farm_1"')) {
    localStorage.removeItem("dhandu_hisaabu_server_db");
    localStorage.removeItem("dhandu_hisaabu_local_db");
  }

  let serverDB;
  if (!localStorage.getItem("dhandu_hisaabu_server_db")) {
    serverDB = {
      farms: DEFAULT_FARMS,
      users: DEFAULT_USERS,
      crops: DEFAULT_CROPS,
      transactions: DEFAULT_TRANSACTIONS,
      fertilizer_records: DEFAULT_FERTILIZERS,
      harvest_records: DEFAULT_HARVESTS,
      inventory: DEFAULT_INVENTORY,
      audit_logs: DEFAULT_AUDIT_LOGS,
      treatment_products: DEFAULT_TREATMENT_PRODUCTS,
      treatment_applications: DEFAULT_TREATMENT_APPLICATIONS
    };
    localStorage.setItem("dhandu_hisaabu_server_db", JSON.stringify(serverDB));
  } else {
    serverDB = JSON.parse(localStorage.getItem("dhandu_hisaabu_server_db") || "{}");
    if (serverDB.users) {
      DEFAULT_USERS.forEach(defUser => {
        const exists = serverDB.users.some(u => u.username === defUser.username);
        if (!exists) {
          serverDB.users.push(defUser);
        }
      });
      localStorage.setItem("dhandu_hisaabu_server_db", JSON.stringify(serverDB));
    }
  }
  
  // Local cache mirrors server db initially
  if (!localStorage.getItem("dhandu_hisaabu_local_db")) {
    localStorage.setItem("dhandu_hisaabu_local_db", localStorage.getItem("dhandu_hisaabu_server_db"));
  } else {
    const localDB = JSON.parse(localStorage.getItem("dhandu_hisaabu_local_db") || "{}");
    if (localDB.users) {
      DEFAULT_USERS.forEach(defUser => {
        const exists = localDB.users.some(u => u.username === defUser.username);
        if (!exists) {
          localDB.users.push(defUser);
        }
      });
      localStorage.setItem("dhandu_hisaabu_local_db", JSON.stringify(localDB));
    }
  }
  
  // Pending synchronizations outbox
  if (!localStorage.getItem("dhandu_hisaabu_outbox")) {
    localStorage.setItem("dhandu_hisaabu_outbox", JSON.stringify([]));
  }
  
  // Pull from Firestore in background if online
  pullFromFirestore();
}

// Seeding helper to push default data to Firestore
export async function pushAllToFirestore() {
  if (!db) return;
  try {
    const serverDB = getStore("server");
    const tables = ["farms", "users", "crops", "transactions", "fertilizer_records", "harvest_records", "inventory", "audit_logs", "treatment_products", "treatment_applications"];
    for (const table of tables) {
      const records = serverDB[table] || [];
      for (const record of records) {
        const docId = record.id || record.username;
        if (docId) {
          await setDoc(doc(db, table, docId), record);
        }
      }
    }
    console.log("Successfully seeded Firestore with default data.");
  } catch (err) {
    console.error("Failed to seed Firestore:", err);
  }
}

// Background pull sync helper
export async function pullFromFirestore() {
  if (!db) return;
  try {
    const tables = ["farms", "users", "crops", "transactions", "fertilizer_records", "harvest_records", "inventory", "audit_logs", "treatment_products", "treatment_applications"];
    const serverDB = {};
    for (const table of tables) {
      const querySnapshot = await getDocs(collection(db, table));
      serverDB[table] = [];
      querySnapshot.forEach((doc) => {
        serverDB[table].push(doc.data());
      });
    }

    let hasData = false;
    for (const table of tables) {
      if (serverDB[table] && serverDB[table].length > 0) {
        hasData = true;
        break;
      }
    }

    if (hasData) {
      if (!serverDB.users) serverDB.users = [];
      DEFAULT_USERS.forEach(defUser => {
        const exists = serverDB.users.some(u => u.username === defUser.username);
        if (!exists) {
          serverDB.users.push(defUser);
        }
      });
      localStorage.setItem("dhandu_hisaabu_server_db", JSON.stringify(serverDB));
      const outbox = getOutbox();
      if (outbox.length === 0) {
        localStorage.setItem("dhandu_hisaabu_local_db", JSON.stringify(serverDB));
        // Force app refresh if views are open
        if (window.app && typeof window.app.showView === "function" && window.app.currentView) {
          window.app.showView(window.app.currentView);
        }
      }
      console.log("Pulled fresh state from Firestore (preserved default users).");
    } else {
      console.log("Firestore is empty. Seeding with default data...");
      await pushAllToFirestore();
    }
  } catch (err) {
    console.error("Firestore pull failed:", err);
  }
}

// Get Database from Local Storage
function getStore(type = "local") {
  const key = type === "local" ? "dhandu_hisaabu_local_db" : "dhandu_hisaabu_server_db";
  return JSON.parse(localStorage.getItem(key) || "{}");
}

// Save Database to Local Storage
function saveStore(store, type = "local") {
  const key = type === "local" ? "dhandu_hisaabu_local_db" : "dhandu_hisaabu_server_db";
  localStorage.setItem(key, JSON.stringify(store));
}

// Get Outbox
export function getOutbox() {
  return JSON.parse(localStorage.getItem("dhandu_hisaabu_outbox") || "[]");
}

// Save Outbox
function saveOutbox(outbox) {
  localStorage.setItem("dhandu_hisaabu_outbox", JSON.stringify(outbox));
}

// Active user helper
export function getActiveUser() {
  return JSON.parse(sessionStorage.getItem("dhandu_hisaabu_session") || "null");
}

// Validate Role & Tenancy Access (Backend Security Guard)
function validateSecurity(table, action) {
  const user = getActiveUser();
  if (!user) throw new Error("Security Exception: Unauthorized access. Please log in.");
  
  const platformAdminOnly = ["farms"];
  const farmBusinessOnly = ["crops", "transactions", "fertilizer_records", "harvest_records", "inventory", "treatment_products", "treatment_applications"];
  
  // 1. Platform Admin restrictions
  if (user.role === "platform_admin") {
    if (farmBusinessOnly.includes(table)) {
      throw new Error(`Security Exception: Platform Administrator is strictly forbidden from accessing farm business records (${table}).`);
    }
  }
  
  // 2. Farm Users restrictions
  if (user.role === "farm_admin" || user.role === "staff") {
    if (platformAdminOnly.includes(table)) {
      if (table === "farms") {
        if (action === "write" && user.role !== "farm_admin") {
          throw new Error("Security Exception: Only Farm Administrators can update farm details.");
        }
      } else {
        throw new Error("Security Exception: Farm users cannot access platform management tables.");
      }
    }
    
    // 3. Staff specific write restrictions
    if (user.role === "staff" && action === "write") {
      // Staff can ONLY write Income, Fertilizer, and Treatment Applications
      if (!["transactions", "fertilizer_records", "treatment_applications"].includes(table)) {
        throw new Error("Security Exception: Staff can only record Income, Fertilizer, and Treatment applications.");
      }
    }
  }
}

// Log an audit event
export function logAuditEvent(eventType, message, isSystem = false) {
  const user = getActiveUser();
  const serverDB = getStore("server");
  const localDB = getStore("local");
  
  const logItem = {
    id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    farmId: isSystem ? null : (user ? user.farmId : null),
    timestamp: new Date().toISOString(),
    username: user ? user.username : "guest",
    eventType: eventType,
    message: message,
    type: isSystem ? "system" : "farm"
  };
  
  // Push to server & local db logs
  serverDB.audit_logs.push(logItem);
  localDB.audit_logs.push(logItem);
  
  saveStore(serverDB, "server");
  saveStore(localDB, "local");
}

// Query Table API with Tenancy Filtering
export function queryTable(table) {
  validateSecurity(table, "read");
  
  const user = getActiveUser();
  const localDB = getStore("local");
  const data = localDB[table] || [];
  
  // Platform Admin gets everything in platform tables (like farms), but filters audit logs
  if (user.role === "platform_admin") {
    if (table === "audit_logs") {
      return data.filter(log => log.type === "system");
    }
    return data;
  }
  
  // Farm user: Filter by Farm ID
  if (table === "audit_logs") {
    return data.filter(log => log.farmId === user.farmId);
  }
  
  if (table === "farms") {
    return data.filter(record => record.id === user.farmId);
  }
  
  return data.filter(record => record.farmId === user.farmId);
}

// Insert Record API with Tenancy Validation and Auto-Audit
export function insertRecord(table, recordData, isOnline = true) {
  validateSecurity(table, "write");
  const user = getActiveUser();
  
  const newRecord = {
    id: table.charAt(0) + "_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    farmId: user.farmId,
    createdBy: user.username,
    createdDate: new Date().toISOString(),
    updatedBy: user.username,
    updatedDate: new Date().toISOString(),
    ...recordData
  };
  
  // Format numeric values
  if (newRecord.amount !== undefined) newRecord.amount = parseFloat(newRecord.amount) || 0;
  if (newRecord.quantity !== undefined) newRecord.quantity = parseFloat(newRecord.quantity) || 0;
  if (newRecord.cost !== undefined) newRecord.cost = parseFloat(newRecord.cost) || 0;
  if (newRecord.pricePerUnit !== undefined) newRecord.pricePerUnit = parseFloat(newRecord.pricePerUnit) || 0;
  
  // Inventory Auto-Deduct Check: when recording a fertilizer application
  if (table === "fertilizer_records") {
    deductInventoryFertilizer(newRecord.fertilizerName, newRecord.quantity, isOnline);
  }
  
  if (isOnline) {
    // 1. Save directly to Server DB
    const serverDB = getStore("server");
    if (!serverDB[table]) serverDB[table] = [];
    serverDB[table].push(newRecord);
    saveStore(serverDB, "server");
    
    // 2. Save directly to Local DB
    const localDB = getStore("local");
    if (!localDB[table]) localDB[table] = [];
    localDB[table].push(newRecord);
    saveStore(localDB, "local");
    
    // Async push to Firestore
    if (db) {
      setDoc(doc(db, table, newRecord.id), newRecord).catch(err => {
        console.error(`Firestore insert to ${table} failed:`, err);
      });
    }
    
    logAuditEvent("INSERT_RECORD", `Inserted record in ${table} (ID: ${newRecord.id})`);
  } else {
    // Write locally to mirror cache immediately
    const localDB = getStore("local");
    if (!localDB[table]) localDB[table] = [];
    localDB[table].push(newRecord);
    saveStore(localDB, "local");
    
    // Queue write in outbox
    const outbox = getOutbox();
    outbox.push({ action: "insert", table, data: newRecord });
    saveOutbox(outbox);
    
    logAuditEvent("INSERT_RECORD_OFFLINE", `Recorded offline entry in ${table} (Queued: ${newRecord.id})`);
  }
  
  return newRecord;
}

// Update Record API
export function updateRecord(table, id, updatedFields, isOnline = true) {
  validateSecurity(table, "write");
  const user = getActiveUser();
  
  if (isOnline) {
    // Server DB update
    const serverDB = getStore("server");
    const serverIndex = serverDB[table].findIndex(r => r.id === id);
    if (serverIndex !== -1) {
      const targetFarmId = table === "farms" ? serverDB[table][serverIndex].id : serverDB[table][serverIndex].farmId;
      if (targetFarmId !== user.farmId) {
        throw new Error("Security Exception: Access denied.");
      }
      serverDB[table][serverIndex] = {
        ...serverDB[table][serverIndex],
        ...updatedFields,
        updatedBy: user.username,
        updatedDate: new Date().toISOString()
      };
      saveStore(serverDB, "server");
      
      // Async push to Firestore
      if (db) {
        const docRef = doc(db, table, id);
        setDoc(docRef, serverDB[table][serverIndex], { merge: true }).catch(err => {
          console.error(`Firestore update to ${table} failed:`, err);
        });
      }
    }
    
    // Local DB update
    const localDB = getStore("local");
    const localIndex = localDB[table].findIndex(r => r.id === id);
    if (localIndex !== -1) {
      localDB[table][localIndex] = {
        ...localDB[table][localIndex],
        ...updatedFields,
        updatedBy: user.username,
        updatedDate: new Date().toISOString()
      };
      saveStore(localDB, "local");
    }
    
    logAuditEvent("UPDATE_RECORD", `Updated record in ${table} (ID: ${id})`);
  } else {
    // Queue local update
    const localDB = getStore("local");
    const localIndex = localDB[table].findIndex(r => r.id === id);
    if (localIndex !== -1) {
      localDB[table][localIndex] = {
        ...localDB[table][localIndex],
        ...updatedFields,
        updatedBy: user.username,
        updatedDate: new Date().toISOString()
      };
      saveStore(localDB, "local");
    }
    
    const outbox = getOutbox();
    outbox.push({ action: "update", table, id, data: updatedFields });
    saveOutbox(outbox);
    
    logAuditEvent("UPDATE_RECORD_OFFLINE", `Updated offline entry in ${table} (ID: ${id})`);
  }
}

// Delete Record API
export function deleteRecord(table, id, isOnline = true) {
  validateSecurity(table, "write");
  const user = getActiveUser();
  
  if (user.role === "staff") {
    throw new Error("Security Exception: Staff members are not permitted to delete records.");
  }
  
  if (isOnline) {
    // Server DB delete
    const serverDB = getStore("server");
    const serverIndex = serverDB[table].findIndex(r => r.id === id);
    if (serverIndex !== -1) {
      if (serverDB[table][serverIndex].farmId !== user.farmId) {
        throw new Error("Security Exception: Access denied.");
      }
      serverDB[table].splice(serverIndex, 1);
      saveStore(serverDB, "server");
      
      // Async delete from Firestore
      if (db) {
        deleteDoc(doc(db, table, id)).catch(err => {
          console.error(`Firestore delete from ${table} failed:`, err);
        });
      }
    }
    
    // Local DB delete
    const localDB = getStore("local");
    const localIndex = localDB[table].findIndex(r => r.id === id);
    if (localIndex !== -1) {
      localDB[table].splice(localIndex, 1);
      saveStore(localDB, "local");
    }
    
    logAuditEvent("DELETE_RECORD", `Deleted record from ${table} (ID: ${id})`);
  } else {
    // Remove locally
    const localDB = getStore("local");
    const localIndex = localDB[table].findIndex(r => r.id === id);
    if (localIndex !== -1) {
      localDB[table].splice(localIndex, 1);
      saveStore(localDB, "local");
    }
    
    const outbox = getOutbox();
    outbox.push({ action: "delete", table, id });
    saveOutbox(outbox);
    
    logAuditEvent("DELETE_RECORD_OFFLINE", `Deleted offline record from ${table} (ID: ${id})`);
  }
}

// Automatically deduct stock from inventory when fertilizer is recorded
function deductInventoryFertilizer(fertilizerName, quantity, isOnline) {
  const user = getActiveUser();
  const localDB = getStore("local");
  
  const fertItem = localDB.inventory.find(
    item => item.farmId === user.farmId && 
    item.category === "Fertilizer" && 
    item.name.toLowerCase() === fertilizerName.toLowerCase()
  );
  
  if (fertItem) {
    const updatedStock = Math.max(0, fertItem.currentStock - quantity);
    
    // Perform update
    updateRecord("inventory", fertItem.id, { currentStock: updatedStock }, isOnline);
    logAuditEvent("AUTO_INVENTORY_DEDUCTION", `Automatically deducted ${quantity} ${fertItem.unit} of ${fertilizerName} from inventory. Remaining: ${updatedStock}`);
  }
}

// Authentication Logic
export async function authenticate(username, password) {
  initDB();
  const serverStore = getStore("server");
  let user = serverStore.users.find(u => u.username === username && u.password === password);
  
  // If user is not found locally, fetch directly from remote Firestore
  if (!user && db) {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList = [];
      querySnapshot.forEach((doc) => {
        usersList.push(doc.data());
      });
      
      if (usersList.length > 0) {
        // Preserve default users
        DEFAULT_USERS.forEach(defUser => {
          const exists = usersList.some(u => u.username === defUser.username);
          if (!exists) {
            usersList.push(defUser);
          }
        });
        serverStore.users = usersList;
        saveStore(serverStore, "server");
        
        const localStore = getStore("local");
        localStore.users = usersList;
        saveStore(localStore, "local");
      }
      
      // Try finding again with remote data
      user = usersList.find(u => u.username === username && u.password === password);
      
      if (user) {
        console.log("User authenticated via remote Firestore. Pulling full database sync...");
        pullFromFirestore();
      }
    } catch (err) {
      console.error("Firestore authenticate check failed:", err);
    }
  }
  
  if (user) {
    if (user.status !== "active") {
      throw new Error("Security Exception: This user account has been suspended.");
    }
    
    // Audit log login
    const session = { username: user.username, role: user.role, name: user.name, farmId: user.farmId };
    sessionStorage.setItem("dhandu_hisaabu_session", JSON.stringify(session));
    
    logAuditEvent("LOGIN", `User ${user.username} logged in successfully`, user.role === "platform_admin");
    return session;
  }
  
  throw new Error("ޔޫޒަރނޭމް ނުވަތަ ޕާސްވޯޑް ރަނގަޅެއް ނޫން!");
}

// Synchronization Manager
export async function syncOfflineData() {
  const outbox = getOutbox();
  if (outbox.length === 0) return { success: true, count: 0 };
  
  const serverDB = getStore("server");
  
  try {
    for (const operation of outbox) {
      const { action, table, id, data } = operation;
      const docId = id || (data && data.username);
      if (!docId) continue;
      
      const docRef = doc(db, table, docId);
      
      if (action === "insert") {
        await setDoc(docRef, data);
        if (!serverDB[table]) serverDB[table] = [];
        serverDB[table].push(data);
      } else if (action === "update") {
        await setDoc(docRef, data, { merge: true });
        const idx = serverDB[table].findIndex(r => (r.id === id || r.username === id));
        if (idx !== -1) {
          serverDB[table][idx] = { ...serverDB[table][idx], ...data };
        }
      } else if (action === "delete") {
        await deleteDoc(docRef);
        const idx = serverDB[table].findIndex(r => (r.id === id || r.username === id));
        if (idx !== -1) {
          serverDB[table].splice(idx, 1);
        }
      }
    }
    
    saveStore(serverDB, "server");
    
    // Clear outbox
    const count = outbox.length;
    saveOutbox([]);
    
    // Pull fresh server DB state into local DB
    localStorage.setItem("dhandu_hisaabu_local_db", JSON.stringify(serverDB));
    
    logAuditEvent("DATA_SYNC", `Synchronized ${count} offline operations from outbox to Firestore.`);
    
    return { success: true, count };
  } catch (err) {
    console.error("Firestore sync failed:", err);
    throw err;
  }
}

// Platform Administrator Specific: Create Farm
export function createFarm(farmData) {
  const user = getActiveUser();
  if (!user || user.role !== "platform_admin") {
    throw new Error("Security Exception: Only Platform Administrators can create new farms.");
  }
  
  const serverDB = getStore("server");
  const localDB = getStore("local");
  
  const newFarmId = "farm_" + Date.now();
  const newFarm = {
    id: newFarmId,
    status: "active",
    createdDate: new Date().toISOString(),
    ...farmData
  };
  
  // Create Farm Admin Account
  const newAdmin = {
    username: farmData.adminUsername,
    password: farmData.adminPassword,
    role: "farm_admin",
    name: farmData.owner + " (Admin)",
    email: farmData.email || "",
    farmId: newFarmId,
    status: "active"
  };
  
  // Store
  serverDB.farms.push(newFarm);
  serverDB.users.push(newAdmin);
  saveStore(serverDB, "server");
  
  localDB.farms.push(newFarm);
  localDB.users.push(newAdmin);
  saveStore(localDB, "local");
  
  // Async push to Firestore
  if (db) {
    setDoc(doc(db, "farms", newFarm.id), newFarm).catch(err => console.error(err));
    setDoc(doc(db, "users", newAdmin.username), newAdmin).catch(err => console.error(err));
  }
  
  logAuditEvent("CREATE_FARM", `Created new farm: ${farmData.name} (ID: ${newFarmId})`, true);
  return { success: true, farmId: newFarmId };
}

// Public self-registration for new farms
export function registerFarmSelf(farmData) {
  const serverDB = getStore("server");
  const localDB = getStore("local");
  
  const duplicate = serverDB.users.find(u => u.username === farmData.adminUsername);
  if (duplicate) {
    throw new Error("Username already taken. Please choose another username.");
  }
  
  const newFarmId = "farm_" + Date.now();
  const newFarm = {
    id: newFarmId,
    status: "active",
    createdDate: new Date().toISOString(),
    name: farmData.name,
    owner: farmData.owner,
    island: farmData.island,
    size: farmData.size,
    contact: farmData.contact,
    email: farmData.email || "",
    gpsLocation: farmData.gpsLocation || ""
  };
  
  // Create Farm Admin Account
  const newAdmin = {
    username: farmData.adminUsername,
    password: farmData.adminPassword,
    role: "farm_admin",
    name: farmData.owner + " (Admin)",
    email: farmData.email || "",
    farmId: newFarmId,
    status: "active"
  };
  
  // Seed default inventory
  const defaultSeeds = { id: "inv_s_" + Date.now(), farmId: newFarmId, category: "Seeds", name: "ކަރާ އޮށް", currentStock: 10, unit: "ޕެކެޓް", minimumStock: 2, createdDate: new Date().toISOString() };
  const defaultFert = { id: "inv_f_" + Date.now(), farmId: newFarmId, category: "Fertilizer", name: "އެން.ޕީ.ކޭ 15-15-15 ގަސްކާނާ", currentStock: 100, unit: "ކިލޯ", minimumStock: 20, createdDate: new Date().toISOString() };
  
  // Store
  serverDB.farms.push(newFarm);
  serverDB.users.push(newAdmin);
  serverDB.inventory.push(defaultSeeds);
  serverDB.inventory.push(defaultFert);
  saveStore(serverDB, "server");
  
  localDB.farms.push(newFarm);
  localDB.users.push(newAdmin);
  localDB.inventory.push(defaultSeeds);
  localDB.inventory.push(defaultFert);
  saveStore(localDB, "local");
  
  // Log event with system context
  const logItem = {
    id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    farmId: null,
    timestamp: new Date().toISOString(),
    username: farmData.adminUsername,
    eventType: "REGISTER_FARM",
    message: `Self-registered new farm: ${farmData.name} (ID: ${newFarmId})`,
    type: "system"
  };
  serverDB.audit_logs.push(logItem);
  localDB.audit_logs.push(logItem);
  saveStore(serverDB, "server");
  saveStore(localDB, "local");

  // Async push to Firestore
  if (db) {
    setDoc(doc(db, "farms", newFarm.id), newFarm).catch(err => console.error(err));
    setDoc(doc(db, "users", newAdmin.username), newAdmin).catch(err => console.error(err));
    setDoc(doc(db, "inventory", defaultSeeds.id), defaultSeeds).catch(err => console.error(err));
    setDoc(doc(db, "inventory", defaultFert.id), defaultFert).catch(err => console.error(err));
    setDoc(doc(db, "audit_logs", logItem.id), logItem).catch(err => console.error(err));
  }

  return { success: true, farmId: newFarmId };
}

// Platform Administrator Specific: Toggle Farm Status
export function toggleFarmStatus(farmId) {
  const user = getActiveUser();
  if (!user || user.role !== "platform_admin") {
    throw new Error("Security Exception: Only Platform Administrators can manage farm statuses.");
  }
  
  const serverDB = getStore("server");
  const localDB = getStore("local");
  
  const farmIdx = serverDB.farms.findIndex(f => f.id === farmId);
  if (farmIdx !== -1) {
    const currentStatus = serverDB.farms[farmIdx].status;
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    
    serverDB.farms[farmIdx].status = newStatus;
    localDB.farms[farmIdx].status = newStatus;
    
    // Suspend all users in that farm as well
    serverDB.users.forEach(u => {
      if (u.farmId === farmId) u.status = newStatus;
    });
    localDB.users.forEach(u => {
      if (u.farmId === farmId) u.status = newStatus;
    });
    
    saveStore(serverDB, "server");
    saveStore(localDB, "local");
    
    // Async push status changes to Firestore
    if (db) {
      const updatedFarm = serverDB.farms[farmIdx];
      setDoc(doc(db, "farms", farmId), updatedFarm, { merge: true }).catch(err => console.error(err));
      
      serverDB.users.forEach(u => {
        if (u.farmId === farmId) {
          setDoc(doc(db, "users", u.username), u, { merge: true }).catch(err => console.error(err));
        }
      });
    }
    
    logAuditEvent("TOGGLE_FARM_STATUS", `Toggled farm ${farmId} status to ${newStatus}`, true);
  }
}

// Reset User Password (Platform Admin can reset Farm Admins, Farm Admins can reset Staff)
export function resetPassword(username, newPassword) {
  const currentUser = getActiveUser();
  if (!currentUser) throw new Error("Unauthorized.");
  
  const serverDB = getStore("server");
  const localDB = getStore("local");
  
  const targetUserIdx = serverDB.users.findIndex(u => u.username === username);
  if (targetUserIdx !== -1) {
    const targetUser = serverDB.users[targetUserIdx];
    
    // Security check
    if (currentUser.role === "platform_admin" && targetUser.role === "farm_admin") {
      // Platform Admin resets Farm Admin
    } else if (currentUser.role === "farm_admin" && targetUser.farmId === currentUser.farmId && targetUser.role === "staff") {
      // Farm Admin resets their Staff
    } else {
      throw new Error("Security Exception: Insufficient permissions to reset password for this user.");
    }
    
    serverDB.users[targetUserIdx].password = newPassword;
    localDB.users[targetUserIdx].password = newPassword;
    
    saveStore(serverDB, "server");
    saveStore(localDB, "local");
    
    // Async push to Firestore
    if (db) {
      setDoc(doc(db, "users", username), serverDB.users[targetUserIdx], { merge: true }).catch(err => console.error(err));
    }
    
    logAuditEvent("RESET_PASSWORD", `Password reset for user: ${username}`, currentUser.role === "platform_admin");
    return { success: true };
  }
  
  throw new Error("User not found.");
}

// Password recovery via registered email validation
export function recoverPassword(username, email, newPassword) {
  const serverDB = getStore("server");
  const localDB = getStore("local");

  const user = serverDB.users.find(u => u.username === username);
  if (!user) {
    throw new Error("މި ޔޫޒަރނޭމްގެ އެކައުންޓެއް ނެތް.");
  }

  let matched = false;
  if (user.role === "platform_admin") {
    // Default email for platform admin
    if (email.toLowerCase() === "admin@example.com" || email.toLowerCase() === "sysadmin@example.com") {
      matched = true;
    }
  } else {
    const farm = serverDB.farms.find(f => f.id === user.farmId);
    if (farm && farm.email && farm.email.toLowerCase() === email.toLowerCase()) {
      matched = true;
    }
  }

  if (!matched) {
    throw new Error("ޔޫޒަރނޭމް ނުވަތަ އީމެއިލް އެޑްރެސް ދިމައެއް ނުވޭ.");
  }

  // Update password in server and local DBs
  const serverUserIdx = serverDB.users.findIndex(u => u.username === username);
  if (serverUserIdx !== -1) serverDB.users[serverUserIdx].password = newPassword;

  const localUserIdx = localDB.users.findIndex(u => u.username === username);
  if (localUserIdx !== -1) localDB.users[localUserIdx].password = newPassword;

  saveStore(serverDB, "server");
  saveStore(localDB, "local");

  // Push to Firestore
  pushAllToFirestore();

  logAuditEvent("FORGOT_PASSWORD_RESET", `Password self-reset for user: ${username}`, user.role === "platform_admin");
  return { success: true };
}

// Change password for currently logged in user
export function changePassword(currentPassword, newPassword) {
  const currentUser = getActiveUser();
  if (!currentUser) throw new Error("Unauthorized.");

  const serverDB = getStore("server");
  const localDB = getStore("local");

  const serverUserIdx = serverDB.users.findIndex(u => u.username === currentUser.username);
  if (serverUserIdx === -1) {
    throw new Error("ޔޫޒަރ ފެންނާކަށް ނެތް.");
  }

  const user = serverDB.users[serverUserIdx];
  if (user.password !== currentPassword) {
    throw new Error("މިހާރުގެ ޕާސްވޯޑް ރަނގަޅެއް ނޫން.");
  }

  // Update password
  serverDB.users[serverUserIdx].password = newPassword;
  
  const localUserIdx = localDB.users.findIndex(u => u.username === currentUser.username);
  if (localUserIdx !== -1) {
    localDB.users[localUserIdx].password = newPassword;
  }

  saveStore(serverDB, "server");
  saveStore(localDB, "local");

  // Push to Firestore
  pushAllToFirestore();

  logAuditEvent("CHANGE_PASSWORD", `Password changed by user: ${currentUser.username}`, currentUser.role === "platform_admin");
  return { success: true };
}
