-- Safe migration: main service registration fields (preserve existing rows)
ALTER TABLE `services`
  ADD COLUMN `serviceCode` VARCHAR(32) NULL AFTER `id`,
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true AFTER `description`,
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `isActive`,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER `createdAt`,
  ADD COLUMN `createdById` VARCHAR(191) NULL AFTER `updatedAt`,
  ADD COLUMN `updatedById` VARCHAR(191) NULL AFTER `createdById`;

CREATE UNIQUE INDEX `services_serviceCode_key` ON `services` (`serviceCode`);

ALTER TABLE `services`
  ADD CONSTRAINT `services_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `staffs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `services`
  ADD CONSTRAINT `services_updatedById_fkey`
  FOREIGN KEY (`updatedById`) REFERENCES `staffs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

SET @row_num := 0;
UPDATE `services`
SET `serviceCode` = CONCAT('SRV-', LPAD(@row_num := @row_num + 1, 3, '0'))
WHERE `serviceCode` IS NULL
ORDER BY `createdAt` ASC, `id` ASC;
