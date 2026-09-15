import express from 'express';
import {
  generateInvoice,
  getInvoices,
  getInvoice,
  getInvoicePdf,
  updateInvoiceStatus,
} from '../controllers/invoice.controllers';
import { protect } from '../middlewares/auth.middlewares';
import { validate } from '../middlewares/validate';
import { invoiceStatusSchema } from '../zodSchemas';

const router = express.Router();

router.use(protect);

// Generate + backfill; doctor (treating), staff, or admin only.
router.post('/consultation/:consultationId', generateInvoice);

router.get('/', getInvoices);

router.get('/:id/pdf', getInvoicePdf);
router.get('/:id', getInvoice);

router.patch('/:id/status', validate(invoiceStatusSchema), updateInvoiceStatus);

export default router;