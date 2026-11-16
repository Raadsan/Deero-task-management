ALTER TABLE `contracts`
  ADD COLUMN `contractType` VARCHAR(20) NULL DEFAULT 'MONTHLY',
  ADD COLUMN `billingPeriodMonths` INT NULL;

ALTER TABLE `client_installments`
  ADD COLUMN `percentage` DOUBLE NULL,
  ADD COLUMN `dueMilestone` VARCHAR(64) NULL;

UPDATE `contracts` SET `contractType` = 'MONTHLY' WHERE `contractType` IS NULL;
