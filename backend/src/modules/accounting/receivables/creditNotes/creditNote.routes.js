import express from 'express'
import {
  cancel,
  create,
  getAll,
  getById,
  getCreditableInvoice,
  post,
  recordRefund,
  remove,
  update,
} from './creditNote.controller.js'
import { checkPermission, protect } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()
router.use(protect)
router.get('/creditable-invoices/:invoiceId', checkPermission('/credit-notes', 'canView'), getCreditableInvoice)
router.route('/')
  .get(checkPermission('/credit-notes', 'canView'), getAll)
  .post(checkPermission('/credit-notes', 'canAdd'), create)
router.route('/:id')
  .get(checkPermission('/credit-notes', 'canView'), getById)
  .put(checkPermission('/credit-notes', 'canEdit'), update)
  .delete(checkPermission('/credit-notes', 'canDelete'), remove)
router.patch('/:id/post', checkPermission('/credit-notes', 'canAdd'), post)
router.post('/:id/post', checkPermission('/credit-notes', 'canAdd'), post)
router.patch('/:id/cancel', checkPermission('/credit-notes', 'canEdit'), cancel)
router.post('/:id/cancel', checkPermission('/credit-notes', 'canEdit'), cancel)
router.patch('/:id/refund', checkPermission('/credit-notes', 'canEdit'), recordRefund)
router.post('/:id/refund', checkPermission('/credit-notes', 'canEdit'), recordRefund)

export default router
