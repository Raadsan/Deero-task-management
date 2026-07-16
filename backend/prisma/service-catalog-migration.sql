ALTER TABLE `services`
  ADD COLUMN `iconUrl` TEXT NULL,
  ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN `externalId` VARCHAR(191) NULL,
  ADD COLUMN `lastSyncedAt` DATETIME(3) NULL,
  ADD UNIQUE INDEX `services_source_externalId_key` (`source`, `externalId`);

ALTER TABLE `subservices`
  ADD COLUMN `price` DOUBLE NULL,
  ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
  ADD COLUMN `features` JSON NULL,
  ADD COLUMN `externalId` VARCHAR(191) NULL,
  ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0,
  ADD UNIQUE INDEX `subservices_categoryId_externalId_key` (`categoryId`, `externalId`);
