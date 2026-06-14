const { onSchedule } = require('firebase-functions/v2/scheduler')
const { logger } = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()
const db = admin.firestore()
const bucketName = `${process.env.GCLOUD_PROJECT}.firebasestorage.app`

// Runs daily and permanently deletes expired media (fixed retention windows):
//   • Driver's-license photos — 30 days after the event date
//   • Videos (walkthrough/testimonial) — 20 days after upload
//   • Setup/event photos — 60 days after upload
// Clocks run off event/upload dates, never off order status.
exports.purgeDlPhotos = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'America/Los_Angeles',
    region: 'us-east4',
  },
  async () => {
    const nowIso = new Date().toISOString()
    const snap = await db
      .collection('orders')
      .where('dlPurgeAfter', '<=', nowIso)
      .get()

    const bucket = admin.storage().bucket(bucketName)
    let fileCount = 0
    let orderCount = 0

    for (const doc of snap.docs) {
      const o = doc.data()
      if (!o.dlPhotos || o.dlPhotos.length === 0) continue
      const [files] = await bucket.getFiles({ prefix: `dl/${doc.id}/` })
      for (const f of files) {
        try {
          await f.delete()
          fileCount++
        } catch (e) {
          logger.warn(`Failed to delete ${f.name}: ${e.message}`)
        }
      }
      await doc.ref.update({ dlPhotos: [], dlPurgeAfter: null })
      orderCount++
    }

    logger.info(`DL purge complete: ${fileCount} files across ${orderCount} orders`)

    // Videos: each clip has its own purgeAfter (upload + 20 days). Scan all
    // orders that have videos and remove the expired ones.
    let vFiles = 0
    let vOrders = 0
    const all = await db.collection('orders').get()
    for (const doc of all.docs) {
      const o = doc.data()
      if (!o.videos || o.videos.length === 0) continue
      const keep = o.videos.filter((v) => v.purgeAfter > nowIso)
      const expired = o.videos.filter((v) => v.purgeAfter <= nowIso)
      if (expired.length === 0) continue
      for (const v of expired) {
        try {
          await bucket.file(v.storagePath).delete()
          vFiles++
        } catch (e) {
          logger.warn(`Failed to delete ${v.storagePath}: ${e.message}`)
        }
      }
      await doc.ref.update({ videos: keep })
      vOrders++
    }
    logger.info(`Video purge complete: ${vFiles} files across ${vOrders} orders`)

    // Setup/event photos: marketing assets, deleted 60 days after upload so the
    // bucket doesn't accumulate forever. Clock is the upload date (not order
    // status), so they expire even if an order is never marked completed.
    const SETUP_RETENTION_DAYS = 60
    const setupCutoff = new Date(Date.now() - SETUP_RETENTION_DAYS * 86400000).toISOString()
    let sFiles = 0
    let sOrders = 0
    for (const doc of all.docs) {
      const o = doc.data()
      if (!o.setupPhotos || o.setupPhotos.length === 0) continue
      const expired = o.setupPhotos.filter((p) => p.uploadedAt && p.uploadedAt <= setupCutoff)
      if (expired.length === 0) continue
      const keep = o.setupPhotos.filter((p) => !(p.uploadedAt && p.uploadedAt <= setupCutoff))
      for (const p of expired) {
        try {
          await bucket.file(p.storagePath).delete()
          sFiles++
        } catch (e) {
          logger.warn(`Failed to delete ${p.storagePath}: ${e.message}`)
        }
      }
      await doc.ref.update({ setupPhotos: keep })
      sOrders++
    }
    logger.info(`Setup photo purge complete: ${sFiles} files across ${sOrders} orders`)
  },
)
