ALTER TABLE `client_installments`
  ADD COLUMN `installmentNumber` INT NULL AFTER `contractId`;

CREATE INDEX `client_installments_installmentNumber_idx` ON `client_installments` (`contractId`, `installmentNumber`);
