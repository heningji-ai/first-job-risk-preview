import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
const file=`data/payment-order-migration-${Date.now()}.db`;process.env.GOAL_FIT_DB_PATH=file;
const { initializeDatabase,db,databasePath }=await import("./db.js");
try{initializeDatabase();const names=()=>new Set((db.prepare("PRAGMA table_info(orders)").all() as any[]).map(x=>x.name));for(const name of ["platformIdentityId","assessmentId","reportSnapshotId","orderPurpose","expiresAt"])assert.ok(names().has(name));const indexes=(db.prepare("PRAGMA index_list(orders)").all() as any[]).map(x=>x.name);for(const name of ["idx_orders_platform_identity","idx_orders_assessment","idx_orders_report_snapshot"])assert.ok(indexes.includes(name));initializeDatabase();console.log("Goal Fit miniapp payment order migration tests passed.");}finally{db.close();for(const x of ["","-wal","-shm"])try{fs.rmSync(`${databasePath}${x}`,{force:true})}catch{}}
