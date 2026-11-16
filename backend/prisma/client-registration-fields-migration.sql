-- Safe migration: client registration fields (preserve existing rows)
ALTER TABLE `clients`
  ADD COLUMN `clientCode` VARCHAR(32) NULL AFTER `id`,
  ADD COLUMN `alternativePhone` VARCHAR(64) NULL AFTER `phone`,
  ADD COLUMN `createdById` VARCHAR(191) NULL AFTER `accountManagerId`;

CREATE UNIQUE INDEX `clients_clientCode_key` ON `clients` (`clientCode`);

ALTER TABLE `clients`
  ADD CONSTRAINT `clients_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `staffs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill client codes in creation order
SET @row_num := 0;
UPDATE `clients`
SET `clientCode` = CONCAT('CL-', LPAD(@row_num := @row_num + 1, 4, '0'))
WHERE `clientCode` IS NULL
ORDER BY `createdAt` ASC, `id` ASC;
