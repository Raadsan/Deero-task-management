ALTER TABLE `client_installments`
  ADD COLUMN `paidAt` DATETIME(3) NULL AFTER `paidAmount`;