ALTER TABLE `projects`
  ADD COLUMN `projectCode` VARCHAR(32) NULL,
  ADD COLUMN `billingMode` VARCHAR(32) NOT NULL DEFAULT 'ONE_TIME',
  ADD COLUMN `lifecycleStatus` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `contractId` VARCHAR(191) NULL,
  ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isDraft` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `scheduleConfig` JSON NULL;

CREATE UNIQUE INDEX `projects_projectCode_key` ON `projects` (`projectCode`);
CREATE INDEX `projects_contractId_fkey` ON `projects` (`contractId`);

ALTER TABLE `projects`
  ADD CONSTRAINT `projects_contractId_fkey`
  FOREIGN KEY (`contractId`) REFERENCES `contracts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `task_transfer_history`
  ADD COLUMN `reason` VARCHAR(191) NULL,
  ADD COLUMN `note` TEXT NULL;

CREATE TABLE `project_service_links` (
  `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `projectId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `serviceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_service_links_project_service` (`projectId`, `serviceId`),
  KEY `project_service_links_serviceId` (`serviceId`),
  CONSTRAINT `project_service_links_project_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_service_links_service_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services` (`id`)
);

CREATE TABLE `project_sub_services` (
  `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `projectServiceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `unit` VARCHAR(64) NOT NULL DEFAULT 'Items',
  `targetQuantity` INTEGER NOT NULL DEFAULT 1,
  `assigneeId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  PRIMARY KEY (`id`),
  KEY `project_sub_services_link` (`projectServiceId`),
  KEY `project_sub_services_assignee` (`assigneeId`),
  CONSTRAINT `project_sub_services_link_fkey` FOREIGN KEY (`projectServiceId`) REFERENCES `project_service_links` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_sub_services_assignee_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `staffs` (`id`) ON DELETE SET NULL
);

CREATE TABLE `project_cycles` (
  `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `projectId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` VARCHAR(64) NOT NULL,
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `project_cycles_projectId` (`projectId`),
  CONSTRAINT `project_cycles_project_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE
);

CREATE TABLE `project_extra_requests` (
  `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `projectId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `subServiceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` INTEGER NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `requestedById` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `project_extra_requests_project` (`projectId`),
  KEY `project_extra_requests_sub` (`subServiceId`),
  CONSTRAINT `project_extra_requests_project_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_extra_requests_sub_fkey` FOREIGN KEY (`subServiceId`) REFERENCES `project_sub_services` (`id`),
  CONSTRAINT `project_extra_requests_user_fkey` FOREIGN KEY (`requestedById`) REFERENCES `staffs` (`id`) ON DELETE SET NULL
);
