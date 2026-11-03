'use strict';

const { MongoClient, GridFSBucket } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'mobileum_portals';
let clientPromise;
let clientInstance;
let database;
let bucket;
let lastWrite = null;
let lastError = null;

function configured() {
  return typeof uri === 'string' && uri.trim().length > 0;
}

async function connect() {
  if (!configured()) {
    throw new Error('MongoDB storage is selected but MONGODB_URI is not configured.');
  }
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    });
    clientPromise = client.connect().then(connected => {
      clientInstance = connected;
      return connected;
    }).catch(error => {
      clientPromise = null;
      lastError = error.message;
      throw error;
    });
  }
  try {
    const client = await clientPromise;
    database = client.db(dbName);
    bucket = new GridFSBucket(database, { bucketName: 'logos' });
    lastError = null;
    return database;
  } catch (error) {
    lastError = error.message;
    throw error;
  }
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection('packages').createIndex({ packageId: 1 }, { unique: true }),
    db.collection('requests').createIndex({ requestId: 1 }, { unique: true }),
    db.collection('numbers').createIndex({ numberId: 1 }, { unique: true }),
    db.collection('numbers').createIndex({ phoneE164: 1 }),
    db.collection('files').createIndex({ fileId: 1 }, { unique: true })
  ]);
}

async function initialize(seed, fileBuffers = new Map()) {
  const db = await connect();
  await ensureIndexes(db);
  const migrations = db.collection('migrations');
  let marker = await migrations.findOne({ _id: 'workbook-seed-v1' });
  if (!marker) {
    const names = ['packages', 'requests', 'numbers', 'files'];
    const counts = await Promise.all(names.map(name => db.collection(name).countDocuments()));
    const migration = {
      _id: 'workbook-seed-v1',
      status: counts.every(count => count === 0) ? 'seeding' : 'skipped-existing-data'
    };
    try {
      await migrations.insertOne(migration);
      marker = migration;
    } catch (error) {
      if (error.code !== 11000) throw error;
      marker = await migrations.findOne({ _id: 'workbook-seed-v1' });
    }
  }
  if (!marker || marker.status !== 'seeding') return;

  await importSnapshot(seed, fileBuffers);
  await migrations.updateOne(
    { _id: 'workbook-seed-v1' },
    { $set: { status: 'completed', completedAt: new Date().toISOString() } }
  );
}

function clean(row) {
  const result = { ...row };
  delete result._id;
  delete result.dataUrl;
  delete result.preview;
  delete result.logoLink;
  return result;
}

async function saveGridFile(file, content) {
  if (!file) return;
  let buffer;
  if (Buffer.isBuffer(content)) {
    buffer = content;
  } else {
    const match = typeof content === 'string' && content.match(/^data:[^;]+;base64,([\s\S]+)$/);
    if (!match) throw new Error(`Uploaded file content is missing for ${file.fileId}.`);
    buffer = Buffer.from(match[1], 'base64');
  }
  const existing = await database.collection('files').findOne({ fileId: file.fileId });
  if (existing && existing.gridFsId) {
    try { await bucket.delete(existing.gridFsId); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const stream = bucket.openUploadStream(file.storedName || file.originalName || file.fileId, {
    metadata: { fileId: file.fileId, mimeType: file.mimeType }
  });
  await new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.once('finish', resolve);
    stream.end(buffer);
  });
  const metadata = clean(file);
  metadata.gridFsId = stream.id;
  await database.collection('files').updateOne(
    { fileId: file.fileId },
    { $set: metadata },
    { upsert: true }
  );
}

async function importSnapshot(snapshot, fileBuffers = new Map()) {
  const db = await connect();
  await ensureIndexes(db);
  for (const [name, rows, key] of [
    ['packages', snapshot.packages, 'packageId'],
    ['requests', snapshot.requests, 'requestId'],
    ['numbers', snapshot.numbers, 'numberId'],
    ['files', snapshot.files, 'fileId']
  ]) {
    if (rows.length) {
      await db.collection(name).bulkWrite(rows.map(row => ({
        updateOne: {
          filter: { [key]: row[key] },
          update: { $setOnInsert: clean(row) },
          upsert: true
        }
      })), { ordered: false });
    }
  }
  for (const file of snapshot.files) {
    const buffer = fileBuffers.get(file.fileId);
    if (buffer) await saveGridFile(file, buffer);
  }
}

async function runWithOptionalSession(fn) {
  let session = null;
  try {
    session = clientInstance ? clientInstance.startSession() : null;
    if (session) {
      try {
        let result;
        await session.withTransaction(async () => {
          result = await fn(session);
        });
        return result;
      } catch (txErr) {
        // If standalone mongod without replica set, transactions are not allowed
        if (txErr.code === 20 || /transaction numbers are only allowed on a replica set/i.test(txErr.message)) {
          return await fn(undefined);
        }
        throw txErr;
      }
    } else {
      return await fn(undefined);
    }
  } finally {
    if (session) {
      try { await session.endSession(); } catch (e) {}
    }
  }
}

async function enqueue(entry) {
  const db = await connect();
  if (entry.t === 'pkg') {
    await db.collection('packages').updateOne(
      { packageId: entry.row.packageId },
      { $setOnInsert: clean(entry.row) },
      { upsert: true }
    );
  } else if (entry.t === 'pkg-update') {
    const row = clean(entry.row);
    delete row.packageId;
    delete row.status;
    delete row.createdAt;
    await db.collection('packages').updateOne(
      { packageId: entry.row.packageId, status: { $ne: 'removed' } },
      { $set: row }
    );
  } else if (entry.t === 'pkg-remove') {
    await db.collection('packages').updateOne(
      { packageId: entry.packageId },
      { $set: { status: 'removed' } }
    );
  } else if (entry.t === 'req') {
    if (entry.file) await saveGridFile(entry.file, entry.file.dataUrl);
    await runWithOptionalSession(async (session) => {
      const opts = session ? { session } : undefined;
      await db.collection('requests').updateOne(
        { requestId: entry.row.requestId },
        { $setOnInsert: clean(entry.row) },
        { upsert: true, ...opts }
      );
      if (entry.numbers && entry.numbers.length) {
        await db.collection('numbers').bulkWrite(entry.numbers.map(row => ({
          updateOne: {
            filter: { numberId: row.numberId },
            update: { $setOnInsert: clean(row) },
            upsert: true
          }
        })), { ordered: false, ...opts });
      }
    });
  } else if (entry.t === 'number-decisions') {
    await runWithOptionalSession(async (session) => {
      const opts = session ? { session } : undefined;
      const at = entry.at || new Date().toISOString();
      for (const d of entry.decisions || []) {
        const filter = d.numberId ? { numberId: d.numberId } : { requestId: entry.requestId, phoneE164: d.phoneE164 };
        await db.collection('numbers').updateOne(
          filter,
          { $set: { status: d.status, remarks: d.remarks || '', decidedAt: at } },
          opts
        );
      }
      const allNums = await db.collection('numbers').find({ requestId: entry.requestId }, opts).toArray();
      const statuses = allNums.map(n => String(n.status || 'pending').toLowerCase().trim());
      let finalStatus = 'partially approved';
      if (statuses.length && statuses.every(s => s === 'approved')) finalStatus = 'approved';
      else if (statuses.length && statuses.every(s => s === 'rejected')) finalStatus = 'rejected';
      else if (statuses.length && statuses.every(s => s === 'pending')) finalStatus = 'pending';
      const updateFields = { status: finalStatus };
      if (entry.remarks !== undefined) updateFields.remarks = entry.remarks;
      await db.collection('requests').updateOne(
        { requestId: entry.requestId },
        { $set: updateFields },
        opts
      );
    });
  } else if (entry.t === 'resubmit-numbers') {
    await runWithOptionalSession(async (session) => {
      const opts = session ? { session } : undefined;
      for (const item of entry.numbers || []) {
        const filter = item.numberId ? { numberId: item.numberId } : { requestId: entry.requestId, phoneE164: item.phoneE164 };
        const setFields = { status: 'pending', remarks: '', decidedAt: null };
        if (item.department) setFields.department = item.department;
        if (item.phoneDisplay) setFields.phoneDisplay = item.phoneDisplay;
        await db.collection('numbers').updateOne(filter, { $set: setFields }, opts);
      }
      const allNums = await db.collection('numbers').find({ requestId: entry.requestId }, opts).toArray();
      const statuses = allNums.map(n => String(n.status || 'pending').toLowerCase().trim());
      let finalStatus = 'partially approved';
      if (statuses.length && statuses.every(s => s === 'approved')) finalStatus = 'approved';
      else if (statuses.length && statuses.every(s => s === 'rejected')) finalStatus = 'rejected';
      else if (statuses.length && statuses.every(s => s === 'pending')) finalStatus = 'pending';
      await db.collection('requests').updateOne(
        { requestId: entry.requestId },
        { $set: { status: finalStatus } },
        opts
      );
    });
  } else if (entry.t === 'status') {
    await runWithOptionalSession(async (session) => {
      const opts = session ? { session } : undefined;
      const at = entry.at || new Date().toISOString();
      if (entry.decisions && Array.isArray(entry.decisions)) {
        for (const d of entry.decisions) {
          const filter = d.numberId ? { numberId: d.numberId } : { requestId: entry.requestId, phoneE164: d.phoneE164 };
          await db.collection('numbers').updateOne(
            filter,
            { $set: { status: d.status, remarks: d.remarks || '', decidedAt: at } },
            opts
          );
        }
        const allNums = await db.collection('numbers').find({ requestId: entry.requestId }, opts).toArray();
        const statuses = allNums.map(n => String(n.status || 'pending').toLowerCase().trim());
        let finalStatus = 'partially approved';
        if (statuses.length && statuses.every(s => s === 'approved')) finalStatus = 'approved';
        else if (statuses.length && statuses.every(s => s === 'rejected')) finalStatus = 'rejected';
        else if (statuses.length && statuses.every(s => s === 'pending')) finalStatus = 'pending';
        const updateFields = { status: finalStatus };
        if (entry.remarks !== undefined) updateFields.remarks = entry.remarks;
        await db.collection('requests').updateOne(
          { requestId: entry.requestId },
          { $set: updateFields },
          opts
        );
      } else {
        await db.collection('requests').updateOne(
          { requestId: entry.requestId },
          { $set: { status: entry.status, remarks: entry.remarks || '' } },
          opts
        );
        const numSet = { status: entry.status, decidedAt: at };
        if (entry.status === 'rejected' && entry.remarks) numSet.remarks = entry.remarks;
        await db.collection('numbers').updateMany(
          { requestId: entry.requestId },
          { $set: numSet },
          opts
        );
      }
    });
  } else if (entry.t === 'req-delete') {
    await runWithOptionalSession(async (session) => {
      const opts = session ? { session } : undefined;
      await db.collection('requests').deleteOne({ requestId: entry.requestId }, opts);
      await db.collection('numbers').deleteMany({ requestId: entry.requestId }, opts);
      // Remove associated file metadata (GridFS cleanup)
      if (entry.logoFileId) {
        const fileDoc = await db.collection('files').findOne({ fileId: entry.logoFileId }, opts);
        if (fileDoc && fileDoc.gridFsId) {
          try { await bucket.delete(fileDoc.gridFsId); } catch (e) {}
        }
        await db.collection('files').deleteOne({ fileId: entry.logoFileId }, opts);
      }
    });
  } else if (entry.t === 'reset-demo') {
    // Delete ALL requests, numbers, and files (not packages)
    const allReqs = await db.collection('requests').find({}, { projection: { requestId: 1, logoFileId: 1 } }).toArray();
    for (const r of allReqs) {
      if (r.logoFileId) {
        const fileDoc = await db.collection('files').findOne({ fileId: r.logoFileId });
        if (fileDoc && fileDoc.gridFsId) {
          try { await bucket.delete(fileDoc.gridFsId); } catch (e) {}
        }
        await db.collection('files').deleteOne({ fileId: r.logoFileId });
      }
    }
    await db.collection('requests').deleteMany({});
    await db.collection('numbers').deleteMany({});
  } else {
    throw new Error(`Unsupported database change type: ${entry.t}`);
  }
  lastWrite = new Date().toISOString();
}

async function readAll() {
  const db = await connect();
  const [packages, requests, numbers, files] = await Promise.all([
    db.collection('packages').find({}, { projection: { _id: 0 } }).toArray(),
    db.collection('requests').find({}, { projection: { _id: 0 } }).toArray(),
    db.collection('numbers').find({}, { projection: { _id: 0 } }).toArray(),
    db.collection('files').find({}, { projection: { _id: 0, gridFsId: 0 } }).toArray()
  ]);
  return { packages, requests, numbers, files };
}

async function getFile(fileId) {
  const db = await connect();
  const metadata = await db.collection('files').findOne({ fileId }, { projection: { _id: 0 } });
  if (!metadata || !metadata.gridFsId) return null;
  const chunks = [];
  await new Promise((resolve, reject) => {
    bucket.openDownloadStream(metadata.gridFsId)
      .on('data', chunk => chunks.push(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return { ...metadata, buffer: Buffer.concat(chunks) };
}

function status() {
  return {
    database: `MongoDB: ${dbName}`,
    backend: 'mongodb',
    pending: 0,
    lastFlush: lastWrite,
    error: configured() ? lastError : 'Set MONGODB_URI to connect the Vercel deployment to MongoDB Atlas.',
    readError: null
  };
}

module.exports = { configured, initialize, importSnapshot, enqueue, readAll, getFile, status };
